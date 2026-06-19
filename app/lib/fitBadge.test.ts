import { describe, it, expect } from "vitest";
import { fitBadge } from "@/app/lib/fitBadge";

describe("fitBadge", () => {
  it("reads a strong stack-coverage verdict as a positive (green) badge", () => {
    const badge = fitBadge("stackCoverage", "high");
    expect(badge.label).toBe("High");
    expect(badge.className).toContain("green");
  });

  it("reads a poor stack-coverage verdict as a negative (red) badge", () => {
    const badge = fitBadge("stackCoverage", "low");
    expect(badge.label).toBe("Low");
    expect(badge.className).toContain("red");
  });

  it("reads a middling stack-coverage verdict as a caution (amber) badge", () => {
    const badge = fitBadge("stackCoverage", "medium");
    expect(badge.label).toBe("Medium");
    expect(badge.className).toContain("amber");
  });

  it("maps the four scope verdicts to the right tone, only realistic being positive", () => {
    expect(fitBadge("scope", "realistic").className).toContain("green");
    expect(fitBadge("scope", "too_modest").className).toContain("amber");
    expect(fitBadge("scope", "aggressive").className).toContain("amber");
    expect(fitBadge("scope", "too_ambitious").className).toContain("red");
  });

  it("renders a multi-word scope verdict as a human label", () => {
    expect(fitBadge("scope", "too_ambitious").label).toBe("Too ambitious");
  });

  it("maps hiring-signal verdicts from strong (green) through to weak (red)", () => {
    expect(fitBadge("hiringSignal", "strong").className).toContain("green");
    expect(fitBadge("hiringSignal", "moderate").className).toContain("amber");
    expect(fitBadge("hiringSignal", "weak").className).toContain("red");
  });
});
