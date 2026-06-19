import type { ProjectOutput } from "@/app/lib/schemas/projectOutput";

type FitEvaluation = ProjectOutput["fitEvaluation"];
type FitDimension = "stackCoverage" | "scope" | "hiringSignal";

const TONE_CLASS = {
  positive: "bg-green-100 text-green-800",
  caution: "bg-amber-100 text-amber-800",
  negative: "bg-red-100 text-red-800",
} as const;

type Tone = keyof typeof TONE_CLASS;

const VERDICT_TONE = {
  stackCoverage: { high: "positive", medium: "caution", low: "negative" },
  scope: {
    realistic: "positive",
    too_modest: "caution",
    aggressive: "caution",
    too_ambitious: "negative",
  },
  hiringSignal: { strong: "positive", moderate: "caution", weak: "negative" },
} as const satisfies {
  [D in FitDimension]: Record<FitEvaluation[D]["verdict"], Tone>;
};

function label(verdict: string): string {
  const spaced = verdict.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function fitBadge(
  dimension: "stackCoverage",
  verdict: FitEvaluation["stackCoverage"]["verdict"]
): { label: string; className: string };
export function fitBadge(
  dimension: "scope",
  verdict: FitEvaluation["scope"]["verdict"]
): { label: string; className: string };
export function fitBadge(
  dimension: "hiringSignal",
  verdict: FitEvaluation["hiringSignal"]["verdict"]
): { label: string; className: string };
export function fitBadge(
  dimension: FitDimension,
  verdict: string
): { label: string; className: string } {
  const tone = (VERDICT_TONE[dimension] as Record<string, Tone>)[verdict];
  return { label: label(verdict), className: TONE_CLASS[tone] };
}
