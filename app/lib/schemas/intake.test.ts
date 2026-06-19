import { describe, it, expect } from "vitest";
import { stage1FormSchema, projectIntakeSchema } from "@/app/lib/schemas/intake";

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

describe("projectIntakeSchema (Stage 2)", () => {
  const longEnough =
    "I want to build a meal-planning app that suggests recipes from what is in my fridge.";

  it("rejects a description under 50 characters", () => {
    const result = projectIntakeSchema.safeParse({ projectDescription: "Too short." });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((i) => i.path[0] === "projectDescription")).toBe(true);
  });

  it("accepts a valid description without specificRequirements", () => {
    const result = projectIntakeSchema.safeParse({ projectDescription: longEnough });
    expect(result.success).toBe(true);
  });

  it("accepts a valid description with specificRequirements", () => {
    const result = projectIntakeSchema.safeParse({
      projectDescription: longEnough,
      specificRequirements: "Must use my existing Postgres instance.",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes an empty-string specificRequirements to undefined", () => {
    // A cleared optional textarea submits "". Treat it as omitted so the value
    // the prompt sees and the value we persist agree (the route already drops a
    // falsy requirement from the prompt; the mapper turns undefined into null).
    const result = projectIntakeSchema.safeParse({
      projectDescription: longEnough,
      specificRequirements: "",
    });
    expect(result.success).toBe(true);
    expect(result.data!.specificRequirements).toBeUndefined();
  });
});
