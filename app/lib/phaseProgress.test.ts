import { describe, it, expect } from "vitest";
import { phaseProgress } from "@/app/lib/phaseProgress";

// Milestones carry the tasks; the caller supplies which task ids are checked.
const milestones = [
  { tasks: [{ id: "a" }, { id: "b" }] },
  { tasks: [{ id: "c" }] },
];

describe("phaseProgress", () => {
  it("counts checked tasks against the phase total across milestones", () => {
    const progress = phaseProgress(milestones, (id) => id === "a");
    expect(progress).toEqual({ completed: 1, total: 3, allComplete: false });
  });

  it("flags allComplete once every task in the phase is checked", () => {
    const progress = phaseProgress(milestones, () => true);
    expect(progress).toEqual({ completed: 3, total: 3, allComplete: true });
  });

  it("never calls an empty phase complete", () => {
    const progress = phaseProgress([], () => true);
    expect(progress).toEqual({ completed: 0, total: 0, allComplete: false });
  });
});
