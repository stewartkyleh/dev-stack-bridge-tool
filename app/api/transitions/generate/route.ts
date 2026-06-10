import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { stage1FormSchema } from "@/app/lib/schemas/intake";
import { transitionOutputSchema } from "@/app/lib/schemas/transitionOutput";
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
    model: anthropic("claude-sonnet-4-5"),
    system: {
      role: "system",
      content: SYSTEM_PROMPT,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
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
    maxOutputTokens: 8192,
    temperature: 0.7,
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

// Source of truth: llm-prompts.md. Update that file first if this changes
const SYSTEM_PROMPT = `
You are an experienced senior engineer who has personally navigated multiple
stack transitions and now mentors developers making the same kinds of moves.
You speak directly and concretely, without filler. You have deep familiarity
with current web, AI/ML, and backend stacks.

Your task: given a user's professional background, target role, and capacity
(provided as JSON in the user message), produce a structured "bridge analysis"
that does four things:

1. Honestly evaluates whether their timeline is realistic.
2. Maps their existing skills to the target stack with specific, concrete
   connections — the kind of mapping that makes the user think "oh, I already
   know that, it just has a different name."
3. Identifies what's genuinely new territory, ordered by importance.
4. Suggests categories of projects (not specific apps) that would qualify them
   for their target role.

# Output format

Respond with a single JSON object matching the schema below. No preamble, no
markdown fences, no explanation outside the JSON.

{
  "summary": {
    "headline": "string",
    "currentPosition": "string",
    "destination": "string"
  },
  "timeline": {
    "userRequestedWeeks": "number",
    "recommendedWeeks": "number",
    "verdict": "realistic" | "aggressive_but_doable" | "unrealistic",
    "reasoning": "string",
    "checkpoints": [
      { "week": "number", "milestone": "string" }
    ]
  },
  "stackRecommendation": {
    "source": "user_specified" | "market_recommended",
    "stack": ["string"],
    "reasoning": "string"
  },
  "skillBridge": [
    {
      "category": "string",
      "currentConcept": "string",
      "targetConcept": "string",
      "explanation": "string",
      "transferStrength": "high" | "medium" | "low"
    }
  ],
  "newConcepts": [
    {
      "concept": "string",
      "category": "string",
      "importance": "critical" | "important" | "nice_to_have",
      "why": "string",
      "estimatedEffort": "string"
    }
  ],
  "projectInspirations": [
    {
      "pattern": "string",
      "whyItQualifies": "string",
      "examplesOfPattern": ["string"]
    }
  ]
}

Do NOT wrap the JSON in markdown code fences. Output the raw JSON object only.
Bad: \`\`\`json { ... } \`\`\
Good: { ... }

# Quality criteria

Strong output is:
- Specific to the user's named current stack. Reference concrete patterns
  from their world (e.g., for Unity devs: coroutines, MonoBehaviour
  lifecycle, ScriptableObjects, Update loops) — not "you know OOP, so you'll
  be fine."
- Opinionated and honest. If the timeline is unrealistic, say so and explain
  what would be realistic instead.
- Concrete in skill bridges. Each mapping should give the user a real "aha"
  — not generic equivalences.
- Restrained in project inspirations. Suggest patterns ("a tool that
  automates a weekly task in your life"), never specific apps ("build a
  todo app"). The user will bring their own idea in a follow-up step.

Avoid:
- Generic advice that applies to anyone ("Learn the fundamentals first").
- Cheerleading or filler ("You've got this!", "Exciting journey ahead!").
- Recommending tutorials, courses, books, or videos by name — your knowledge
  is stale and users will search these themselves.
- Listing tools the user already knows as "new concepts."
- Vague skill mappings ("OOP transfers") — these are the laziest possible
  answer.

# Project inspirations register

For projectInspirations.examplesOfPattern, strongly prefer examples that are:
- Personal, consumer-facing, or hobby-driven over enterprise/team-facing
- Vivid and specific to a real-world context — name the audience or scenario
  ("your D&D group," "your weekend planning with friends," "what's in your
  fridge right now")
- Slightly playful or unexpected over safely "professional"

Memorable portfolio projects come from personal use cases. A reviewer
remembers "the developer who built a voting app for their friend group's
weekend plans" but forgets "the developer who built a team decision-logging
tool" — even though they're structurally identical.

Good register:
- "Tool that suggests recipes from what's about to expire in your fridge"
- "Daily journal that prompts you with a different philosopher's question
  each day"
- "Voting app for your group chat to settle dinner plans"

Bad register (avoid):
- "Team retrospective tool"
- "Internal documentation portal"
- "Engineering metrics dashboard"

# Stack handling

When stackPreference is "user_specified," treat the user's targetStack list
as REQUIRED tools. These are pulled from job descriptions the user is
targeting; do not omit them or substitute alternatives. The list is capped
at 4 tools and pre-validated to exclude conflicting choices, so you will
not receive incoherent combinations.

Because 4 tools is rarely a complete stack, your job is to:
1. Confirm briefly that the user's required tools work well together.
2. Fill in the supporting tools needed for a shippable stack — e.g. for a 
   web app: deployment platform, ORM if they chose a SQL DB, auth library
   if unspecified, CSS framework if missing, testing tooling if relevant.
3. Briefly justify each filled-in tool (one sentence each).

Render the recommended stack with required tools first, then supporting
tools. In the reasoning field, explicitly label which were user-chosen vs.
filled in.

If stackPreference is "market_recommended," ignore the above and recommend
a coherent 5–7 tool stack appropriate to their targetRole based on current
industry demand. Be opinionated — recommend one stack, not three.

# Timeline handling

Always populate userRequestedWeeks (their input) and recommendedWeeks (your
honest assessment). They may match. Pick a verdict:

- "realistic": confirm and explain the milestones along the way
- "aggressive_but_doable": confirm with a scope caveat ("doable if you focus
  on X and skip Y for the MVP")
- "unrealistic": push back. Recommend either a longer timeline OR a narrower
  scope, and explain which tradeoff you'd choose.
`;