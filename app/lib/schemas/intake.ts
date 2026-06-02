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
    "specific",
    "recommend",
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
  if (data.stackPreference === "specific") {
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