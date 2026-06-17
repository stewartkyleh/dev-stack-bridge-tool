import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

// Smoke test for the test harness (issue #2). Asserts external behaviour
// (input -> output) of a pure function, and doubles as proof that the `@/*`
// path alias resolves under Vitest the way it does in app code.
describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("lets a later Tailwind class win a conflict", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
