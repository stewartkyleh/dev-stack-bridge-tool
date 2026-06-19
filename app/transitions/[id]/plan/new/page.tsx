import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/app/lib/prismaSingleton";
import { PlanForm } from "./PlanForm";

// Stage 2 intake entry point. Server Component: ownership-check the Transition,
// never let the owner create a duplicate Project (D-034), and pass display-only
// context to the client form. The generate route always re-fetches the Transition
// server-side and never trusts client-sent context.
export default async function NewPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  // Ownership is userId-only and transitive through the Transition (D-034). A
  // missing/foreign Transition and an unauthenticated caller all 404. Middleware
  // already gates this route to signed-in users; this is the same check the
  // generate route enforces, kept here so a non-owner can't see the form.
  const transition = await db.transition.findUnique({
    where: { id },
    select: {
      userId: true,
      targetRole: true,
      targetStack: true,
      stackRecommendation: true,
      project: { select: { id: true } },
    },
  });

  const isOwner =
    transition !== null && userId !== null && transition.userId === userId;
  if (!isOwner) notFound();

  // One Project per Transition: if a plan already exists, send the owner to it
  // rather than letting them generate a second one.
  if (transition.project) redirect(`/transitions/${id}/plan`);

  // Display-only context (target role + target stack). On the market-recommended
  // path targetStack is empty, so fall back to the stack the analysis actually
  // recommended so the form still shows what the plan will be built around.
  const stack =
    transition.targetStack.length > 0
      ? transition.targetStack
      : (transition.stackRecommendation as { stack?: string[] } | null)?.stack ?? [];

  return (
    <PlanForm
      transitionId={id}
      targetRole={transition.targetRole}
      targetStack={stack}
    />
  );
}
