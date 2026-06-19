import { describe, it, expect } from "vitest";
import { buildProjectCreateInput } from "@/app/lib/buildProjectCreateInput";
import type { ProjectOutput } from "@/app/lib/schemas/projectOutput";
import type { ProjectIntake } from "@/app/lib/schemas/intake";

// Two phases (named out of any alphabetical order to prove order tracks array
// index, not content), with differing milestone/task counts to prove ordering
// resets per parent.
const output: ProjectOutput = {
  fitEvaluation: {
    stackCoverage: { verdict: "high", reasoning: "Covers it.", missingTools: [] },
    scope: { verdict: "realistic", reasoning: "Fits.", recommendations: [] },
    hiringSignal: { verdict: "strong", reasoning: "Demonstrable." },
  },
  stackForProject: [{ tool: "Next.js", source: "user_target", purpose: "App" }],
  phases: [
    {
      name: "Phase B",
      weekRange: "Week 1–2",
      goal: "Foundation",
      milestones: [
        {
          title: "M1",
          tasks: [
            { title: "T1", description: "d1" },
            { title: "T2", description: "d2" },
          ],
        },
        { title: "M2", tasks: [{ title: "T3", description: "d3" }] },
      ],
      learningCallouts: ["c1"],
    },
    {
      name: "Phase A",
      weekRange: "Week 3–4",
      goal: "Ship",
      milestones: [{ title: "M3", tasks: [{ title: "T4", description: "d4" }] }],
      learningCallouts: [],
    },
  ],
  definitionOfDone: { mustHave: ["Deployed"], stretchIfTimePermits: [] },
};

const intake: ProjectIntake = {
  projectDescription:
    "A meal-planning app that suggests recipes from what is in my fridge.",
  specificRequirements: "Must use Postgres.",
};

describe("buildProjectCreateInput", () => {
  it("assigns 1-based order from array index across phases, milestones, and tasks", () => {
    const data = buildProjectCreateInput(output, "t-1", intake);

    const phases = data.phases.create;
    expect(phases.map((p) => [p.order, p.name])).toEqual([
      [1, "Phase B"],
      [2, "Phase A"],
    ]);

    // Milestone order resets within each phase.
    expect(phases[0].milestones.create.map((m) => [m.order, m.title])).toEqual([
      [1, "M1"],
      [2, "M2"],
    ]);
    expect(phases[1].milestones.create.map((m) => [m.order, m.title])).toEqual([
      [1, "M3"],
    ]);

    // Task order resets within each milestone.
    expect(
      phases[0].milestones.create[0].tasks.create.map((t) => [t.order, t.title])
    ).toEqual([
      [1, "T1"],
      [2, "T2"],
    ]);
    expect(
      phases[0].milestones.create[1].tasks.create.map((t) => [t.order, t.title])
    ).toEqual([[1, "T3"]]);
  });

  it("never sets completed on tasks (the DB default owns it)", () => {
    const data = buildProjectCreateInput(output, "t-1", intake);
    const task = data.phases.create[0].milestones.create[0].tasks.create[0];
    expect(task).not.toHaveProperty("completed");
    expect(task.description).toBe("d1");
  });

  it("maps the transition id, intake, and display-only fields through", () => {
    const data = buildProjectCreateInput(output, "t-99", intake);
    expect(data.transitionId).toBe("t-99");
    expect(data.projectDescription).toBe(intake.projectDescription);
    expect(data.specificRequirements).toBe("Must use Postgres.");
    expect(data.fitEvaluation).toEqual(output.fitEvaluation);
    expect(data.stackForProject).toEqual(output.stackForProject);
    expect(data.definitionOfDone).toEqual(output.definitionOfDone);
    expect(data.phases.create[0].weekRange).toBe("Week 1–2");
    expect(data.phases.create[0].goal).toBe("Foundation");
    expect(data.phases.create[0].learningCallouts).toEqual(["c1"]);
  });

  it("stores null specificRequirements when the user omits it", () => {
    const data = buildProjectCreateInput(
      output,
      "t-1",
      { projectDescription: intake.projectDescription }
    );
    expect(data.specificRequirements).toBeNull();
  });
});
