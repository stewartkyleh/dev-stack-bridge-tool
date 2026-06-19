import { describe, it, expect } from "vitest";
import { projectOutputSchema } from "@/app/lib/schemas/projectOutput";

// A minimal but complete Stage 2 output. Per D-033 it carries no `order` (the
// model emits ordered arrays) and no `completed` (Prisma owns the default).
const validOutput = {
  fitEvaluation: {
    stackCoverage: { verdict: "high", reasoning: "Covers it.", missingTools: [] },
    scope: { verdict: "realistic", reasoning: "Fits the timeline.", recommendations: [] },
    hiringSignal: { verdict: "strong", reasoning: "Demonstrable surface." },
  },
  stackForProject: [
    { tool: "Next.js", source: "user_target", purpose: "App framework" },
  ],
  phases: [
    {
      name: "Foundation",
      weekRange: "Week 1–3",
      goal: "Stand up the app and deploy pipeline.",
      milestones: [
        {
          title: "Scaffold and deploy",
          tasks: [{ title: "Init repo", description: "Create the Next.js app." }],
        },
      ],
      learningCallouts: ["Server Components — first encountered in this phase."],
    },
  ],
  definitionOfDone: {
    mustHave: ["Deployed and reachable"],
    stretchIfTimePermits: [],
  },
};

describe("projectOutputSchema", () => {
  it("accepts a well-formed plan output", () => {
    expect(projectOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("does not carry order or completed through (D-033)", () => {
    // Even if a model emits the dropped fields, they must not survive parsing —
    // order is derived at persist, completed is the DB default.
    const withDroppedFields = {
      ...validOutput,
      phases: [
        {
          ...validOutput.phases[0],
          order: 1,
          milestones: [
            {
              ...validOutput.phases[0].milestones[0],
              order: 1,
              tasks: [
                { ...validOutput.phases[0].milestones[0].tasks[0], order: 1, completed: false },
              ],
            },
          ],
        },
      ],
    };

    const parsed = projectOutputSchema.safeParse(withDroppedFields);
    expect(parsed.success).toBe(true);
    const phase = parsed.data!.phases[0] as Record<string, unknown>;
    const milestone = phase.milestones as Record<string, unknown>[];
    const task = (milestone[0].tasks as Record<string, unknown>[])[0];
    expect(phase).not.toHaveProperty("order");
    expect(milestone[0]).not.toHaveProperty("order");
    expect(task).not.toHaveProperty("order");
    expect(task).not.toHaveProperty("completed");
  });

  it("rejects output with a bad enum value", () => {
    const broken = {
      ...validOutput,
      fitEvaluation: {
        ...validOutput.fitEvaluation,
        scope: { ...validOutput.fitEvaluation.scope, verdict: "maybe" },
      },
    };
    expect(projectOutputSchema.safeParse(broken).success).toBe(false);
  });
});
