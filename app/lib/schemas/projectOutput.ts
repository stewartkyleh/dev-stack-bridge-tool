import { z } from "zod";

/**
 * Stage 2 — "Scope & Plan" — output schema.
 *
 * Created ahead of Phase 3 (no Stage 2 route, form, or persistence exists yet)
 * so that, per D-030, `app/lib/prompts/stage2.ts` can generate its embedded JSON
 * schema from a single Zod source of truth rather than a hand-copied one.
 * Mirrors the Stage 2 output schema documented in the retired llm-prompts.md.
 */
export const projectOutputSchema = z.object({
  fitEvaluation: z.object({
    stackCoverage: z.object({
      verdict: z.enum(["high", "medium", "low"]),
      reasoning: z.string(),
      missingTools: z.array(z.string()),
    }),
    scope: z.object({
      verdict: z.enum(["too_modest", "realistic", "aggressive", "too_ambitious"]),
      reasoning: z.string(),
      recommendations: z.array(z.string()),
    }),
    hiringSignal: z.object({
      verdict: z.enum(["weak", "moderate", "strong"]),
      reasoning: z.string(),
    }),
  }),
  stackForProject: z.array(
    z.object({
      tool: z.string(),
      source: z.enum(["user_target", "supporting", "project_specific"]),
      purpose: z.string(),
    })
  ),
  phases: z.array(
    z.object({
      order: z.number(),
      name: z.string(),
      weekRange: z.string(),
      goal: z.string(),
      milestones: z.array(
        z.object({
          order: z.number(),
          title: z.string(),
          tasks: z.array(
            z.object({
              order: z.number(),
              title: z.string(),
              description: z.string(),
              // Fresh LLM output: every task starts incomplete. The documented
              // schema pins this to `false`; the app flips it later (post-Phase 3).
              completed: z.literal(false),
            })
          ),
        })
      ),
      learningCallouts: z.array(z.string()),
    })
  ),
  definitionOfDone: z.object({
    mustHave: z.array(z.string()),
    stretchIfTimePermits: z.array(z.string()),
  }),
});

export type ProjectOutput = z.infer<typeof projectOutputSchema>;
