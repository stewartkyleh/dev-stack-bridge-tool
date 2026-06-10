import { z } from "zod";

export const transitionOutputSchema = z.object({
  summary: z.object({
    headline: z.string(),
    currentPosition: z.string(),
    destination: z.string(),
  }),
  timeline: z.object({
    userRequestedWeeks: z.number(),
    recommendedWeeks: z.number(),
    verdict: z.enum(["realistic", "aggressive_but_doable", "unrealistic"]),
    reasoning: z.string(),
    checkpoints: z.array(
      z.object({
        week: z.number(),
        milestone: z.string(),
      })
    ),
  }),
  stackRecommendation: z.object({
    source: z.enum(["user_specified", "market_recommended"]),
    stack: z.array(z.string()),
    reasoning: z.string(),
  }),
  skillBridge: z.array(
    z.object({
      category: z.string(),
      currentConcept: z.string(),
      targetConcept: z.string(),
      explanation: z.string(),
      transferStrength: z.enum(["high", "medium", "low"]),
    })
  ),
  newConcepts: z.array(
    z.object({
      concept: z.string(),
      category: z.string(),
      importance: z.enum(["critical", "important", "nice_to_have"]),
      why: z.string(),
      estimatedEffort: z.string(),
    })
  ),
  projectInspirations: z.array(
    z.object({
      pattern: z.string(),
      whyItQualifies: z.string(),
      examplesOfPattern: z.array(z.string()),
    })
  ),
});

export type TransitionOutput = z.infer<typeof transitionOutputSchema>;