/**
 * Per-phase task progress for the plan view's accordion header. Pure so the
 * "done when every task is checked" semantics are pinned directly rather than
 * through the client island. Tasks live under milestones; the caller decides
 * which ids are checked (session-only `useState` this phase).
 */
export function phaseProgress(
  milestones: { tasks: { id: string }[] }[],
  isComplete: (taskId: string) => boolean
): { completed: number; total: number; allComplete: boolean } {
  const taskIds = milestones.flatMap((m) => m.tasks.map((t) => t.id));
  const total = taskIds.length;
  const completed = taskIds.filter(isComplete).length;
  return { completed, total, allComplete: total > 0 && completed === total };
}
