"use client";

import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { projectIntakeSchema, type ProjectIntake } from "@/app/lib/schemas/intake";
import {
  useProjectStream,
  type ProjectStreamState,
} from "@/app/lib/hooks/useProjectStream";

// react-hook-form holds the pre-transform input ("" before the schema maps an
// empty requirements field to undefined); the submit handler receives the parsed
// output (ProjectIntake), which is what the generate route expects.
type PlanFormValues = z.input<typeof projectIntakeSchema>;

export function PlanForm({
  transitionId,
  targetRole,
  targetStack,
}: {
  transitionId: string;
  targetRole: string;
  targetStack: string[];
}) {
  const router = useRouter();
  const planUrl = `/transitions/${transitionId}/plan`;

  // A 409 means the plan already exists — replace (not push) so Back doesn't
  // bounce the user onto a dead intake form for a Transition that's now planned.
  const onExists = useCallback(() => router.replace(planUrl), [router, planUrl]);
  const { state, start } = useProjectStream(transitionId, onExists);
  const inFlight = state.status !== "idle";

  const form = useForm<PlanFormValues, unknown, ProjectIntake>({
    resolver: zodResolver(projectIntakeSchema),
    defaultValues: { projectDescription: "", specificRequirements: "" },
  });

  function onSubmit(data: ProjectIntake) {
    start(data);
  }

  if (inFlight) {
    return (
      <StreamingView
        state={state}
        onView={() => router.push(planUrl)}
        onRegenerate={() => start(projectIntakeSchema.parse(form.getValues()))}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Plan your project</h1>
        <p className="text-sm text-muted-foreground">
          Describe what you want to build. We&apos;ll scope it against your timeline
          and turn it into a phased plan.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Planning for:</span>
          <Badge variant="secondary">{targetRole}</Badge>
          {targetStack.map((tool) => (
            <Badge key={tool} variant="outline">
              {tool}
            </Badge>
          ))}
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Field data-invalid={!!form.formState.errors.projectDescription}>
          <FieldLabel htmlFor="projectDescription">
            What do you want to build? *
          </FieldLabel>
          <p className="text-sm text-muted-foreground">
            A few sentences on the project and what it should do. The more concrete,
            the better the plan.
          </p>
          <Textarea
            id="projectDescription"
            rows={6}
            aria-invalid={!!form.formState.errors.projectDescription}
            placeholder="e.g. A habit tracker where users log daily habits, see streaks, and get a weekly summary…"
            {...form.register("projectDescription")}
          />
          {form.formState.errors.projectDescription && (
            <FieldError errors={[form.formState.errors.projectDescription]} />
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="specificRequirements">
            Any specific requirements?{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <p className="text-sm text-muted-foreground">
            Constraints or must-use tools — anything the plan has to account for.
          </p>
          <Textarea
            id="specificRequirements"
            rows={3}
            placeholder="e.g. Must use Postgres; needs to work offline."
            {...form.register("specificRequirements")}
          />
        </Field>

        <Button type="submit">Generate my plan</Button>
      </form>
    </div>
  );
}

const SUBTITLE: Record<Exclude<ProjectStreamState["status"], "idle">, string> = {
  streaming: "Generating your plan…",
  confirming: "Finishing up — saving your plan…",
  ready: "Your plan is ready.",
  failed: "Something went wrong.",
};

function StreamingView({
  state,
  onView,
  onRegenerate,
}: {
  state: ProjectStreamState;
  onView: () => void;
  onRegenerate: () => void;
}) {
  // Navigation happens only on an explicit click below — never automatically —
  // so the user can read the streamed preview at their own pace (D-032).
  const parsed = "parsed" in state ? state.parsed : {};
  const subtitle = state.status === "idle" ? "" : SUBTITLE[state.status];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Building your project plan</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Sections render as they arrive. Polished layout is the plan view (#14). */}
      {parsed.fitEvaluation?.scope && (
        <section className="rounded-lg border p-4 space-y-1">
          <h2 className="font-medium">Fit</h2>
          <p className="text-sm">
            <span className="capitalize">
              {parsed.fitEvaluation.scope.verdict?.replace(/_/g, " ")}
            </span>
            {parsed.fitEvaluation.scope.reasoning
              ? ` — ${parsed.fitEvaluation.scope.reasoning}`
              : ""}
          </p>
        </section>
      )}

      {parsed.stackForProject && parsed.stackForProject.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="font-medium">Stack</h2>
          <div className="flex flex-wrap gap-2">
            {parsed.stackForProject.map((item, i) => (
              <Badge key={i} variant="secondary">
                {item.tool}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {parsed.phases && parsed.phases.length > 0 && (
        <section className="rounded-lg border p-4 space-y-3">
          <h2 className="font-medium">Phases</h2>
          {parsed.phases.map((phase, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-medium">
                {phase.name}
                {phase.weekRange ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {phase.weekRange}
                  </span>
                ) : null}
              </p>
              {phase.goal && (
                <p className="text-sm text-muted-foreground">{phase.goal}</p>
              )}
            </div>
          ))}
        </section>
      )}

      {parsed.definitionOfDone?.mustHave &&
        parsed.definitionOfDone.mustHave.length > 0 && (
          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="font-medium">Done means</h2>
            <ul className="list-disc pl-5 space-y-1">
              {parsed.definitionOfDone.mustHave.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

      {/* Action area — advance only on an explicit click. */}
      {state.status === "confirming" && (
        <div className="flex items-center gap-3 pt-2">
          <span className="text-sm text-muted-foreground animate-pulse">
            Still finalizing…
          </span>
          <Button type="button" disabled>
            View your plan
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="pt-2">
          <Button type="button" onClick={onView}>
            View your plan →
          </Button>
        </div>
      )}

      {state.status === "failed" && (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <p className="text-sm text-muted-foreground">
            Your description is kept — you can regenerate.
          </p>
          <Button type="button" onClick={onRegenerate}>
            Regenerate
          </Button>
        </div>
      )}
    </div>
  );
}
