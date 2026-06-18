import { describe, it, expect } from "vitest";
import { toggleTool, STACK_GROUPS } from "@/app/lib/stackPicker";

describe("toggleTool", () => {
  it("adds an unselected tool to the selection", () => {
    expect(toggleTool([], "Postgres")).toEqual(["Postgres"]);
  });

  it("removes a tool that is already selected", () => {
    expect(toggleTool(["Postgres", "Redis"], "Postgres")).toEqual(["Redis"]);
  });

  it("refuses to add a 5th tool (cap at 4)", () => {
    const four = ["Python", "Next.js", "Postgres", "AWS"];
    expect(toggleTool(four, "Docker")).toEqual(four);
  });

  it("still allows deselecting when at the 4-tool cap", () => {
    const four = ["Python", "Next.js", "Postgres", "AWS"];
    expect(toggleTool(four, "AWS")).toEqual(["Python", "Next.js", "Postgres"]);
  });

  it("replaces the current pick within a mutex group (app starting point)", () => {
    expect(toggleTool(["React SPA"], "Next.js")).toEqual(["Next.js"]);
  });

  it("replaces the current pick within a mutex group (language)", () => {
    expect(toggleTool(["Go", "Docker"], "Python")).toEqual(["Docker", "Python"]);
  });

  it("allows a mutex swap even at the 4-tool cap (net-zero)", () => {
    const four = ["Python", "Next.js", "Postgres", "AWS"];
    expect(toggleTool(four, "Go")).toEqual(["Next.js", "Postgres", "AWS", "Go"]);
  });
});

describe("app starting points (name-only storage)", () => {
  const group = STACK_GROUPS.find((g) => g.name === "App starting point")!;

  it("is a single pick-one (mutex) group", () => {
    expect(group).toBeDefined();
    expect(group.mutex).toBe(true);
  });

  it("stores the framework name only — never the implied library", () => {
    for (const chip of group.chips) {
      expect(chip.value).not.toMatch(/[()]/);
      expect(["React", "Vue", "Svelte", "Vite"]).not.toContain(chip.value);
    }
    expect(group.chips.map((c) => c.value)).toEqual([
      "Next.js",
      "Remix",
      "React SPA",
      "SvelteKit",
      "Nuxt",
      "Vue SPA",
      "Angular",
    ]);
  });

  it("names the underlying UI library on the chip the user sees", () => {
    expect(group.chips.find((c) => c.value === "Next.js")!.label).toBe(
      "Next.js (React)"
    );
    expect(group.chips.find((c) => c.value === "Nuxt")!.label).toBe(
      "Nuxt (Vue)"
    );
  });

  it("toggling an app starting point stores its framework name", () => {
    expect(toggleTool([], "Next.js")).toEqual(["Next.js"]);
  });
});
