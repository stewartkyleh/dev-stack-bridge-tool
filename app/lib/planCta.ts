// Decides the Stage 2 entry-point CTA shown on a Bridge analysis view. Returns a
// routing decision only — the component owns all display copy (the anonymous
// prompt's wording is HITL). Projects are userId-owned and transitive through the
// Transition (D-034), so an anonymous owner can never reach a plan route; they get
// the sign-up prompt instead of a link that would merely bounce to sign-in.
export type PlanCta =
  | { kind: "plan-new"; href: string }
  | { kind: "plan-existing"; href: string }
  | { kind: "signup" };

export function planCta(input: {
  transitionId: string;
  isSignedInOwner: boolean;
  projectExists: boolean;
}): PlanCta {
  if (!input.isSignedInOwner) return { kind: "signup" };

  const base = `/transitions/${input.transitionId}/plan`;
  return input.projectExists
    ? { kind: "plan-existing", href: base }
    : { kind: "plan-new", href: `${base}/new` };
}
