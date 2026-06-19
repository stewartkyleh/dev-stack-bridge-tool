"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { phaseProgress } from "@/app/lib/phaseProgress";

// Serializable shape passed down from the Server Component. Rows arrive already
// ordered by the page's `orderBy: { order: "asc" }` query, so this island just
// renders them in array order — it never re-sorts.
export type PlanPhase = {
  id: string;
  name: string;
  weekRange: string;
  goal: string;
  learningCallouts: string[];
  milestones: {
    id: string;
    title: string;
    tasks: { id: string; title: string; description: string | null }[];
  }[];
};

export function PlanPhases({ phases }: { phases: PlanPhase[] }) {
  // Checkbox state is session-only this phase (D-016 / issue #14). Cross-session
  // persistence (`PATCH /api/tasks/[id]/toggle`) is Phase 4 — deliberately no
  // network call here. A Set of completed task ids keeps toggling O(1).
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggle(taskId: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  // type="multiple": phases open and close independently (any number at once).
  // The first phase starts open so the plan isn't a wall of collapsed headers.
  return (
    <Accordion
      type="multiple"
      defaultValue={phases.length > 0 ? [phases[0].id] : []}
      className="rounded-lg border px-4"
    >
      {phases.map((phase) => {
        const progress = phaseProgress(phase.milestones, (id) => done.has(id));
        return (
          <AccordionItem key={phase.id} value={phase.id}>
            <AccordionTrigger>
              <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">{phase.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {phase.weekRange}
                  </span>
                </span>
                {progress.allComplete ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 font-normal text-green-800"
                  >
                    done
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="font-normal tabular-nums">
                    {progress.completed} / {progress.total}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-5">
              <p className="text-sm text-muted-foreground">{phase.goal}</p>

              {phase.learningCallouts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Learning callouts
                  </p>
                  <ul className="space-y-1">
                    {phase.learningCallouts.map((callout, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        {callout}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-5">
                {phase.milestones.map((milestone, milestoneIndex) => {
                  // Tasks are numbered continuously across the phase, so the
                  // count carries over from earlier milestones.
                  const taskOffset = phase.milestones
                    .slice(0, milestoneIndex)
                    .reduce((n, m) => n + m.tasks.length, 0);

                  return (
                    <div key={milestone.id} className="space-y-2">
                      <h4 className="text-sm font-medium">{milestone.title}</h4>
                      <ul className="space-y-2">
                        {milestone.tasks.map((task, taskIndex) => {
                          const checked = done.has(task.id);
                          const number = taskOffset + taskIndex + 1;
                          return (
                            <li key={task.id}>
                              <label className="flex cursor-pointer items-start gap-3">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggle(task.id)}
                                  className="mt-0.5"
                                />
                                <span className="flex flex-col gap-0.5">
                                  <span className="flex items-baseline gap-2">
                                    <span className="text-sm tabular-nums text-muted-foreground">
                                      {number}.
                                    </span>
                                    <span
                                      className={
                                        checked
                                          ? "text-sm font-medium text-muted-foreground line-through"
                                          : "text-sm font-medium"
                                      }
                                    >
                                      {task.title}
                                    </span>
                                  </span>
                                  {task.description && (
                                    <span className="block text-sm text-muted-foreground">
                                      {task.description}
                                    </span>
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
