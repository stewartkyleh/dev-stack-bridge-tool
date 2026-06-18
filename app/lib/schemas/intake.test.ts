import { describe, it, expect } from "vitest";
import { stage1FormSchema } from "@/app/lib/schemas/intake";

// A complete, valid intake save for every field except stack preference, which
// each test sets. Keeps the focus on the conditional Target-stack rule.
const base = {
  currentSkills: ["C#"],
  yearsExperience: "2-4" as const,
  targetRole: "Full-stack web" as const,
  timelineWeeks: "6" as const,
  hoursPerWeek: "10-20" as const,
};

describe("stage1FormSchema conditional target stack (superRefine)", () => {
  it("accepts user_specified with at least two tools", () => {
    const result = stage1FormSchema.safeParse({
      ...base,
      stackPreference: "user_specified",
      targetStack: ["Next.js", "Postgres"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects user_specified with no target stack", () => {
    const result = stage1FormSchema.safeParse({
      ...base,
      stackPreference: "user_specified",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((i) => i.path[0] === "targetStack")).toBe(true);
  });

  it("rejects user_specified with only one tool", () => {
    const result = stage1FormSchema.safeParse({
      ...base,
      stackPreference: "user_specified",
      targetStack: ["Next.js"],
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((i) => i.path[0] === "targetStack")).toBe(true);
  });

  it("accepts market_recommended without any target stack", () => {
    const result = stage1FormSchema.safeParse({
      ...base,
      stackPreference: "market_recommended",
    });
    expect(result.success).toBe(true);
  });
});
