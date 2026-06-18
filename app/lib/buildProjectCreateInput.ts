import type { ProjectOutput } from "@/app/lib/schemas/projectOutput";
import type { ProjectIntake } from "@/app/lib/schemas/intake";

/**
 * Pure mapper from a validated Stage 2 `ProjectOutput` to the nested
 * `prisma.project.create` data — Project → Phase → Milestone → Task in one
 * write. Intentionally Prisma-free so it is directly unit-testable; the route
 * spreads the result and adds `rawLlmOutput`.
 *
 * Per D-033 the `order` for every row is assigned 1-based from its array index
 * (not emitted by the model), making the `@@unique([parentId, order])`
 * constraints impossible to violate via a model numbering glitch. `completed` is
 * never set — Prisma's `@default(false)` owns it.
 */
export function buildProjectCreateInput(
  output: ProjectOutput,
  transitionId: string,
  intake: ProjectIntake
) {
  return {
    transitionId,
    projectDescription: intake.projectDescription,
    specificRequirements: intake.specificRequirements ?? null,
    // Display-only JSONB, persisted as the model emitted them.
    fitEvaluation: output.fitEvaluation,
    stackForProject: output.stackForProject,
    definitionOfDone: output.definitionOfDone,
    phases: {
      create: output.phases.map((phase, phaseIndex) => ({
        order: phaseIndex + 1,
        name: phase.name,
        weekRange: phase.weekRange,
        goal: phase.goal,
        learningCallouts: phase.learningCallouts,
        milestones: {
          create: phase.milestones.map((milestone, milestoneIndex) => ({
            order: milestoneIndex + 1,
            title: milestone.title,
            tasks: {
              create: milestone.tasks.map((task, taskIndex) => ({
                order: taskIndex + 1,
                title: task.title,
                description: task.description,
              })),
            },
          })),
        },
      })),
    },
  };
}
