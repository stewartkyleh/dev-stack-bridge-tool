/**
 * Stage 1 scaffold-level stack picker (D-027).
 *
 * Pure selection logic, extracted from the intake form so it can be unit-tested
 * without rendering. The form renders {@link STACK_GROUPS} and routes every chip
 * click through {@link toggleTool}; the function owns mutex exclusion and the
 * 4-tool cap so the component stays declarative.
 */

/** Total tools a Target stack may hold. */
export const STACK_CAP = 4;

/**
 * One selectable chip. `value` is what gets stored in the Target stack and sent
 * to the LLM; `label` is what the user sees. For app starting points the label
 * names the implied UI library in parentheses (e.g. "Next.js (React)") while the
 * value is the framework name only ("Next.js") — D-027's "name-only" storage.
 */
export type StackChip = {
  value: string;
  label: string;
};

/** A category of chips. Mutex groups are pick-one; non-mutex allow several. */
export type StackGroup = {
  name: string;
  mutex: boolean;
  chips: StackChip[];
};

/** Chip whose stored value equals its label (the common case). */
const plain = (value: string): StackChip => ({ value, label: value });

export const STACK_GROUPS: StackGroup[] = [
  {
    name: "Language",
    mutex: true,
    chips: ["Python", "TypeScript", "JavaScript", "Go"].map(plain),
  },
  {
    // D-027: scaffold-level "app starting point", pick-one. Each chip names its
    // UI library; only the framework name (the value) is stored.
    name: "App starting point",
    mutex: true,
    chips: [
      { value: "Next.js", label: "Next.js (React)" },
      { value: "Remix", label: "Remix (React)" },
      { value: "React SPA", label: "React SPA (Vite)" },
      { value: "SvelteKit", label: "SvelteKit (Svelte)" },
      { value: "Nuxt", label: "Nuxt (Vue)" },
      { value: "Vue SPA", label: "Vue SPA (Vite)" },
      { value: "Angular", label: "Angular" },
    ],
  },
  {
    name: "Backend",
    mutex: true,
    chips: ["Express", "FastAPI", "Django", "NestJS", "Flask"].map(plain),
  },
  {
    name: "Database",
    mutex: true,
    chips: ["Postgres", "MySQL", "MongoDB", "DynamoDB", "SQLite"].map(plain),
  },
  {
    name: "Cloud / hosting",
    mutex: true,
    chips: ["AWS", "GCP", "Azure", "Vercel"].map(plain),
  },
  {
    name: "Additional tools",
    mutex: false,
    chips: ["Tailwind", "Docker", "GraphQL", "Redis", "Kubernetes"].map(plain),
  },
];

/** Values of the mutex group that `value` belongs to, or `null` if non-mutex. */
function mutexSiblingsOf(value: string): string[] | null {
  const group = STACK_GROUPS.find(
    (g) => g.mutex && g.chips.some((c) => c.value === value)
  );
  return group ? group.chips.map((c) => c.value) : null;
}

export function toggleTool(selected: string[], value: string): string[] {
  if (selected.includes(value)) {
    return selected.filter((s) => s !== value);
  }
  // Drop any current pick from the same mutex group first, so a swap is
  // net-zero on the count and stays allowed even at the cap.
  const siblings = mutexSiblingsOf(value);
  const base = siblings
    ? selected.filter((s) => !siblings.includes(s))
    : selected;
  if (base.length >= STACK_CAP) {
    return selected;
  }
  return [...base, value];
}
