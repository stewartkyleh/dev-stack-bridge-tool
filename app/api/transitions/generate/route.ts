import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { stage1FormSchema } from "@/app/lib/schemas/intake";
import { transitionOutputSchema } from "@/app/lib/schemas/transitionOutput";
import { stage1SystemPrompt, stage1CallSettings } from "@/app/lib/prompts/stage1";
import { ratelimit } from "@/app/lib/ratelimit";
import { db } from "@/app/lib/prismaSingleton";

export async function POST(req: NextRequest) {
  // 1. Identify caller
  const { userId } = await auth();
  const anonSessionId =
    req.cookies.get("anon_session")?.value ??
    req.headers.get("x-anon-session") ??
    null;

  if (!userId && !anonSessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit anonymous users
  if (!userId) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "rate_limit", message: "3 analyses per day for anonymous users. Sign in for unlimited access." },
        { status: 429 }
      );
    }
  }

  // 3. Validate payload
  const body = await req.json();
  const parsed = stage1FormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error }, { status: 400 });
  }
  const formData = parsed.data;

  // 4. Stream from Claude, accumulate, validate, persist
  const transitionId = crypto.randomUUID();

  const result = streamText({
    model: anthropic(stage1CallSettings.model),
    system: {
      role: "system",
      content: stage1SystemPrompt,
      providerOptions: {
        anthropic: { cacheControl: stage1CallSettings.cacheControl },
      },
    },
    messages: [
      {
        role: "user",
        // timelineWeeks coerced to number.
        content: JSON.stringify({
          currentSkills: formData.currentSkills,
          yearsExperience: formData.yearsExperience,
          targetRole: formData.targetRole,
          stackPreference: formData.stackPreference,
          targetStack: formData.targetStack ?? [],
          timelineWeeks: Number(formData.timelineWeeks),
          hoursPerWeek: formData.hoursPerWeek,
        }),
      },
    ],
    maxOutputTokens: stage1CallSettings.maxOutputTokens,
    temperature: stage1CallSettings.temperature,
    onFinish: async ({ text, finishReason }) => {
      console.log("[generate] finishReason:", finishReason);
      console.log("[generate] raw text:", text);
      try {
        const clean = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
        const parsed = JSON.parse(clean);
        const validated = transitionOutputSchema.safeParse(parsed);

        if (!validated.success) {
          console.error("[generate] Zod validation failed:", validated.error);
          console.error("[generate] Raw LLM output:", text);
          return;
        }

        const output = validated.data;

        await db.transition.create({
          data: {
            id: transitionId,
            userId: userId ?? null,
            anonymousSessionId: !userId ? anonSessionId : null,
            // Form intake fields
            currentSkills: formData.currentSkills,
            yearsExperience: formData.yearsExperience,
            targetRole: formData.targetRole,
            stackPreference: formData.stackPreference,
            targetStack: formData.targetStack ?? [],
            timelineWeeks: Number(formData.timelineWeeks),
            hoursPerWeek: formData.hoursPerWeek,
            // LLM output fields
            summary: output.summary,
            timeline: output.timeline,
            stackRecommendation: output.stackRecommendation,
            skillBridge: output.skillBridge,
            newConcepts: output.newConcepts,
            projectInspirations: output.projectInspirations,
            rawLlmOutput: text,
          },
        });
      } catch (e) {
        console.error("[generate] onFinish error:", e);
      }
    },
    onError: ({ error }) => {
      console.error("[generate] streamText error:", error);
    },
  });

  // Pipe stream to browser. Add X-Transition-Id so the client can redirect
  // to /transitions/[id] after the stream completes.
  const streamResponse = result.toTextStreamResponse();
  return new Response(streamResponse.body, {
    status: 200,
    headers: {
      ...Object.fromEntries(streamResponse.headers.entries()),
      "X-Transition-Id": transitionId,
    },
  });
}