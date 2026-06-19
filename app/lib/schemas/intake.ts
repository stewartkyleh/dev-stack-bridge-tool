import { z } from "zod";

export const stage1FormSchema = z.object({
  // string array, at least one entry required
  currentSkills: z.array(z.string()).min(1, "Select at least one skill"),

  // enum — only these four string values are valid
  yearsExperience: z.enum(["0-1", "2-4", "5-9", "10+"], {
    error: () => ({ message: "Required" }),
  }),

  // enum
  targetRole: z.enum([
    "Full-stack web",
    "AI/LLM engineering",
    "ML engineering",
    "Backend",
    "Frontend",
  ], {
    error: () => ({ message: "Required" }),
  }),

  // enum — drives conditional visibility of targetStack
  stackPreference: z.enum([
    "user_specified",
    "market_recommended",
  ], {
    error: () => ({ message: "Required" }),
  }),

  // string array, 2–4 selections — optional at this level
  targetStack: z.array(z.string()).min(2, "Pick at least 2 tools").max(4, "Maximum 4 tools").optional(),

  // enums for capacity
  timelineWeeks: z.enum(["3", "6", "9", "12"], {
    error: () => ({ message: "Required" }),
  }),

  hoursPerWeek: z.enum(["5-10", "10-20", "20+"], {
    error: () => ({ message: "Required" }),
  }),
}).superRefine((data, ctx) => {
  if (data.stackPreference === "user_specified") {
    if (!data.targetStack || data.targetStack.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Pick at least 2 tools",
        path: ["targetStack"],
      });
    }
  }
});

export type Stage1FormData = z.infer<typeof stage1FormSchema>;

// Stage 2 intake — the project description the plan is generated from. The
// 50-char floor keeps a one-line idea from producing a vague plan;
// specificRequirements is an optional free-text nudge (constraints, must-use
// tools) the user can omit entirely.
export const projectIntakeSchema = z.object({
  projectDescription: z
    .string()
    .min(50, "Describe your project in at least 50 characters"),
  // A cleared textarea submits ""; normalize it to undefined so "omitted" has a
  // single representation. Otherwise "" is dropped from the prompt (falsy) yet
  // persisted verbatim, storing a requirement the model never saw.
  specificRequirements: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export type ProjectIntake = z.infer<typeof projectIntakeSchema>;