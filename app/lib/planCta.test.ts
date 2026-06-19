import { describe, it, expect } from "vitest";
import { planCta } from "@/app/lib/planCta";

describe("planCta", () => {
  it("sends a signed-in owner without a plan yet to the plan form", () => {
    const cta = planCta({
      transitionId: "t1",
      isSignedInOwner: true,
      projectExists: false,
    });
    expect(cta).toEqual({ kind: "plan-new", href: "/transitions/t1/plan/new" });
  });

  it("sends a signed-in owner with an existing plan straight to it", () => {
    const cta = planCta({
      transitionId: "t1",
      isSignedInOwner: true,
      projectExists: true,
    });
    expect(cta).toEqual({ kind: "plan-existing", href: "/transitions/t1/plan" });
  });

  it("shows an anonymous owner the sign-up prompt instead of a plan link", () => {
    const cta = planCta({
      transitionId: "t1",
      isSignedInOwner: false,
      // Anonymous owners can't have a Project (D-034); pin the gate anyway so a
      // non-signed-in viewer never gets a link that bounces to sign-in.
      projectExists: true,
    });
    expect(cta).toEqual({ kind: "signup" });
  });
});
