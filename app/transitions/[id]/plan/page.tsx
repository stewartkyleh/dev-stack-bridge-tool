import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/prismaSingleton";
import { projectOutputSchema } from "@/app/lib/schemas/projectOutput";
import { fitBadge } from "@/app/lib/fitBadge";
import { Badge } from "@/components/ui/badge";
import { PlanPhases, type PlanPhase } from "./PlanPhases";

// Stage 2 plan view. Server Component shell: run the ordered include query
// (Project → Phase → Milestone → Task, each by `order`), ownership-check, then
// render the fit evaluation and definition of done. The phases accordion + task
// checkboxes are a Client island (`PlanPhases`); checkbox state is session-only
// this phase (Phase 4 wires `PATCH /api/tasks/[id]/toggle`).
export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();

  // Same ownership-checked read as `GET /api/transitions/[id]/plan`. Ownership is
  // userId-only and transitive through the Transition (D-034); a non-owner, an
  // unauthenticated caller, and a not-yet-persisted Project all 404 — never 403.
  const project = await db.project.findUnique({
    where: { transitionId: id },
    include: {
      transition: { select: { userId: true, targetRole: true } },
      phases: {
        orderBy: { order: "asc" },
        include: {
          milestones: {
            orderBy: { order: "asc" },
            include: { tasks: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  const isOwner =
    project !== null && userId !== null && project.transition.userId === userId;
  if (!isOwner) notFound();

  // Display-only JSONB parsed back into typed shapes (mirrors the Stage 1 view's
  // `transitionOutputSchema.parse`). The generate route persists these straight
  // from validated model output, so this is a safe re-read, not re-validation.
  const fitEvaluation = projectOutputSchema.shape.fitEvaluation.parse(
    project.fitEvaluation
  );
  const definitionOfDone = projectOutputSchema.shape.definitionOfDone.parse(
    project.definitionOfDone
  );
  const stackForProject = projectOutputSchema.shape.stackForProject.parse(
    project.stackForProject
  );

  const phases: PlanPhase[] = project.phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    weekRange: phase.weekRange,
    goal: phase.goal,
    learningCallouts: phase.learningCallouts,
    milestones: phase.milestones.map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      tasks: milestone.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
      })),
    })),
  }));

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-16">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Project plan · {project.transition.targetRole}
        </p>
        <h1 className="text-2xl font-bold">Your project plan</h1>
        <p className="text-sm text-muted-foreground">
          {project.projectDescription}
        </p>
      </header>

      <FitEvaluationSection fitEvaluation={fitEvaluation} />

      {stackForProject.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Project stack</h2>
          <div className="flex flex-wrap gap-2">
            {stackForProject.map((item, i) => (
              <Badge key={i} variant="secondary" title={item.purpose}>
                {item.tool}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <DefinitionOfDoneSection definitionOfDone={definitionOfDone} />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Phases</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Work through them top to bottom — tick tasks as you go.
          </p>
        </div>
        <PlanPhases phases={phases} />
      </section>
    </main>
  );
}

// ─── Fit evaluation ───────────────────────────────────────────────────────────

type FitEvaluation = ReturnType<
  typeof projectOutputSchema.shape.fitEvaluation.parse
>;

function FitEvaluationSection({
  fitEvaluation,
}: {
  fitEvaluation: FitEvaluation;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Fit evaluation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          How your idea measures against your target stack, timeline, and the
          hiring bar.
        </p>
      </div>

      <div className="grid gap-4">
        <FitRow
          title="Stack coverage"
          badge={fitBadge("stackCoverage", fitEvaluation.stackCoverage.verdict)}
          reasoning={fitEvaluation.stackCoverage.reasoning}
          list={fitEvaluation.stackCoverage.missingTools}
          listLabel="Missing tools"
        />
        <FitRow
          title="Scope"
          badge={fitBadge("scope", fitEvaluation.scope.verdict)}
          reasoning={fitEvaluation.scope.reasoning}
          list={fitEvaluation.scope.recommendations}
          listLabel="Recommendations"
        />
        <FitRow
          title="Hiring signal"
          badge={fitBadge("hiringSignal", fitEvaluation.hiringSignal.verdict)}
          reasoning={fitEvaluation.hiringSignal.reasoning}
        />
      </div>
    </section>
  );
}

function FitRow({
  title,
  badge,
  reasoning,
  list,
  listLabel,
}: {
  title: string;
  badge: { label: string; className: string };
  reasoning: string;
  list?: string[];
  listLabel?: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <Badge variant="outline" className={badge.className}>
          {badge.label}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{reasoning}</p>
      {list && list.length > 0 && (
        <div className="pt-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {listLabel}
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {list.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Definition of done ───────────────────────────────────────────────────────

type DefinitionOfDone = ReturnType<
  typeof projectOutputSchema.shape.definitionOfDone.parse
>;

function DefinitionOfDoneSection({
  definitionOfDone,
}: {
  definitionOfDone: DefinitionOfDone;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Definition of done</h2>
        <p className="text-sm text-muted-foreground mt-1">
          What &ldquo;shipped&rdquo; means for this project.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-medium">Must have</h3>
          <ul className="list-disc pl-5 space-y-1">
            {definitionOfDone.mustHave.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {definitionOfDone.stretchIfTimePermits.length > 0 && (
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-medium">Stretch if time permits</h3>
            <ul className="list-disc pl-5 space-y-1">
              {definitionOfDone.stretchIfTimePermits.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
