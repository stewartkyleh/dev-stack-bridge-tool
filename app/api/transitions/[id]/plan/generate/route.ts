import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { projectIntakeSchema } from "@/app/lib/schemas/intake";
import { projectOutputSchema } from "@/app/lib/schemas/projectOutput";
import { stage2SystemPrompt, stage2CallSettings } from "@/app/lib/prompts/stage2";
import { buildProjectCreateInput } from "@/app/lib/buildProjectCreateInput";
import { userRatelimit } from "@/app/lib/ratelimit";
import { db } from "@/app/lib/prismaSingleton";

// Stage 2 generate: stream a Project plan for a Transition, then persist it in
// onFinish. Mirrors the Stage 1 generate route but is authenticated-only and
// userId-keyed throughout (no anonymous path) — a Project is owned transitively
// through its Transition (D-034).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();

  // 1. Ownership gate (userId-only). A missing/foreign Transition and an
  // unauthenticated caller all look identical: 404. We read the Stage 1 output
  // columns here too, to rebuild `bridgeAnalysis` for the prompt.
  const transition = await db.transition.findUnique({
    where: { id },
    select: {
      userId: true,
      summary: true,
      timeline: true,
      stackRecommendation: true,
      skillBridge: true,
      newConcepts: true,
      projectInspirations: true,
    },
  });

  const isOwner =
    transition !== null && userId !== null && transition.userId === userId;
  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // 2. One Project per Transition (D-034). Block a second plan with 409 *before*
  // the rate limiter so a re-POST to an already-planned transition (a permanent
  // no-op) neither spends tokens nor erodes the user's daily cap.
  const existing = await db.project.findUnique({
    where: { transitionId: id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "conflict", message: "A plan already exists for this transition." },
      { status: 409 }
    );
  }

  // 3. Per-user daily cap (D-031), keyed by user id.
  const { success } = await userRatelimit.limit(userId);
  if (!success) {
    return NextResponse.json(
      { error: "rate_limit", message: "20 generations per day. Try again tomorrow." },
      { status: 429 }
    );
  }

  // 4. Validate the Stage 2 intake payload.
  const body = await req.json();
  const parsed = projectIntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error },
      { status: 400 }
    );
  }
  const intake = parsed.data;

  // 5. Stream from Claude. The user message passes the full Stage 1 output under
  // `bridgeAnalysis` (user-facing terminology — see stage2.ts).
  const bridgeAnalysis = {
    summary: transition.summary,
    timeline: transition.timeline,
    stackRecommendation: transition.stackRecommendation,
    skillBridge: transition.skillBridge,
    newConcepts: transition.newConcepts,
    projectInspirations: transition.projectInspirations,
  };

  const result = streamText({
    model: anthropic(stage2CallSettings.model),
    system: {
      role: "system",
      content: stage2SystemPrompt,
      providerOptions: {
        anthropic: { cacheControl: stage2CallSettings.cacheControl },
      },
    },
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          bridgeAnalysis,
          projectDescription: intake.projectDescription,
          ...(intake.specificRequirements
            ? { specificRequirements: intake.specificRequirements }
            : {}),
        }),
      },
    ],
    maxOutputTokens: stage2CallSettings.maxOutputTokens,
    temperature: stage2CallSettings.temperature,
    onFinish: async ({ text, finishReason }) => {
      console.log("[plan/generate] finishReason:", finishReason);
      try {
        const clean = text
          .replace(/^```(?:json)?\s*/m, "")
          .replace(/\s*```\s*$/m, "")
          .trim();
        const validated = projectOutputSchema.safeParse(JSON.parse(clean));

        if (!validated.success) {
          console.error("[plan/generate] Zod validation failed:", validated.error);
          console.error("[plan/generate] Raw LLM output:", text);
          return;
        }

        // Single nested write: Project → Phase → Milestone → Task. The mapper
        // derives every `order` from array index; we add the raw output here
        // since the mapper is Prisma-free and raw-text-free by design.
        await db.project.create({
          data: {
            ...buildProjectCreateInput(validated.data, id, intake),
            rawLlmOutput: text,
          },
        });
      } catch (e) {
        // Parse failure or write error: persist nothing. The client's confirm
        // poll times out into the regenerate affordance. No retry loop.
        console.error("[plan/generate] onFinish error:", e);
      }
    },
    onError: ({ error }) => {
      console.error("[plan/generate] streamText error:", error);
    },
  });

  // No id header (cf. Stage 1): the client already knows the Transition id and
  // navigates to /transitions/[id]/plan after the confirm poll succeeds (D-032).
  return result.toTextStreamResponse();
}
