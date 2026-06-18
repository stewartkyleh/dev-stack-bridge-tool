import { describe, it, expect } from "vitest";
import { z } from "zod";
import { transitionOutputSchema } from "@/app/lib/schemas/transitionOutput";

// A minimal but complete output that satisfies every required field. This is the
// contract the generate route enforces in onFinish before persisting.
const validOutput = {
  summary: {
    headline: "Unity dev to full-stack web in 12 weeks",
    currentPosition: "Gameplay engineer",
    destination: "Full-stack web engineer",
  },
  timeline: {
    userRequestedWeeks: 12,
    recommendedWeeks: 12,
    verdict: "realistic",
    reasoning: "Strong transferable fundamentals.",
    checkpoints: [{ week: 4, milestone: "Ship a CRUD app" }],
  },
  stackRecommendation: {
    source: "market_recommended",
    stack: ["Next.js", "Postgres", "Tailwind"],
    reasoning: "Commonly-paired default, not live job data.",
  },
  skillBridge: [
    {
      category: "State",
      currentConcept: "MonoBehaviour lifecycle",
      targetConcept: "React component lifecycle",
      explanation: "Both are event-driven update loops.",
      transferStrength: "high",
    },
  ],
  newConcepts: [
    {
      concept: "HTTP request/response",
      category: "Web fundamentals",
      importance: "critical",
      why: "The backbone of web apps.",
      estimatedEffort: "1 week",
    },
  ],
  projectInspirations: [
    {
      pattern: "A tool that automates a weekly chore",
      whyItQualifies: "Shows end-to-end product thinking.",
      examplesOfPattern: ["Recipe picker from your fridge"],
    },
  ],
};

describe("transitionOutputSchema", () => {
  it("accepts a well-formed analysis", () => {
    expect(transitionOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("rejects output with a bad enum value", () => {
    const broken = {
      ...validOutput,
      timeline: { ...validOutput.timeline, verdict: "maybe" },
    };
    expect(transitionOutputSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects output missing a required section", () => {
    const { projectInspirations, ...missingSection } = validOutput;
    void projectInspirations;
    expect(transitionOutputSchema.safeParse(missingSection).success).toBe(false);
  });
});

describe("z.toJSONSchema(transitionOutputSchema)", () => {
  it("produces an object schema exposing every top-level section", () => {
    const json = z.toJSONSchema(transitionOutputSchema) as {
      type?: string;
      properties?: Record<string, unknown>;
    };
    expect(json.type).toBe("object");
    expect(Object.keys(json.properties ?? {})).toEqual([
      "summary",
      "timeline",
      "stackRecommendation",
      "skillBridge",
      "newConcepts",
      "projectInspirations",
    ]);
  });
});
