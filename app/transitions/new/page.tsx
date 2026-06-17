"use client";

import { useForm, UseFormReturn, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Field, FieldLabel, FieldError} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { stage1FormSchema, type Stage1FormData } from "@/app/lib/schemas/intake";
import { useRouter } from "next/navigation";
import { useTransitionStream, StreamState } from "@/app/lib/hooks/useTransitionStream";
import { shouldClearDraft } from "@/app/lib/streamState";

const STEPS = ["Your background", "Where you're going", "Your capacity", "Review"];
const DRAFT_KEY = "intake.stage1.draft";

export default function NewTransitionPage() {
  const router = useRouter();
  const { state, start } = useTransitionStream();
  const inFlight = state.status !== "idle";

  const [step, setStep] = useState(0);

  const form = useForm<Stage1FormData>({
    resolver: zodResolver(stage1FormSchema),
    defaultValues: {
      currentSkills: [],
      yearsExperience: "" as Stage1FormData["yearsExperience"],
      targetRole: "" as Stage1FormData["targetRole"],
      stackPreference: "" as Stage1FormData["stackPreference"],
      targetStack: undefined,
      timelineWeeks: "" as Stage1FormData["timelineWeeks"],
      hoursPerWeek: "" as Stage1FormData["hoursPerWeek"],
    },
  });

  // Restore draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        form.reset(JSON.parse(saved));
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  // Save draft on every change
  useEffect(() => {
    const subscription = form.watch((values) => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Clear the draft only once persistence is confirmed (`ready`) — never at
  // submit. A failed generation keeps the user's intake answers for a retry.
  useEffect(() => {
    if (shouldClearDraft(state)) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [state]);

  async function advanceStep() {
    // fields to validate for each step before advancing
    const stepFields: (keyof Stage1FormData)[][] = [
      ["currentSkills", "yearsExperience"],
      ["targetRole", "stackPreference", "targetStack"],
      ["timelineWeeks", "hoursPerWeek"],
    ];

    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep((s) => s + 1);
  }

  function onSubmit(data: Stage1FormData) {
    start(data);
  }

  if (inFlight) {
    return (
      <StreamingView
        state={state}
        onView={(id) => router.push(`/transitions/${id}`)}
        onRegenerate={() => start(form.getValues())}
      />
    );
  }
  return (
    <div>
      {/* Progress indicator */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className={`h-1 flex-1 rounded ${i <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      <div className="max-w-2x1 mx-auto px-6 py-12">
        <h1 className="text-xl font-semibold mb-6">{STEPS[step]}</h1>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          {step === 0 && <Step1 form={form} />}
          {step === 1 && <Step2 form={form} />}
          {step === 2 && <Step3 form={form} />}
          {step === 3 && <Step4 form={form} />}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button type="button" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={advanceStep}>
                Continue
              </Button>
            ) : (
              <Button type="submit">
                Generate my analysis
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Current skills, experience level
function Step1({ form }: { form: UseFormReturn<Stage1FormData> }) {
  const [freeText, setFreeText] = useState("");
  const selected = form.watch("currentSkills") ?? [];

  function toggleChip(chip: string) {
    const next = selected.includes(chip)
      ? selected.filter((s) => s !== chip)
      : [...selected, chip];
    form.setValue("currentSkills", next, { shouldValidate: true });
  }

  function addFreeText() {
    const trimmed = freeText.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    form.setValue("currentSkills", [...selected, trimmed], { shouldValidate: true });
    setFreeText("");
  }

  const CHIP_GROUPS = {
    Languages: ["C#", "Java", "Python", "JavaScript", "TypeScript", "Go", "Rust", "Swift", "Kotlin", "Ruby", "PHP", "C++"],
    "Game dev": ["Unity", "Unreal", "Godot"],
    Mobile: ["iOS native", "Android native", "React Native", "Flutter"],
    Backend: ["Node.js", "Django", "Flask", "FastAPI", "Spring", "Rails", ".NET"],
    Frontend: ["React", "Vue", "Angular", "Svelte"],
    Data: ["SQL", "Pandas", "R", "Spark"],
    Cloud: ["AWS", "GCP", "Azure"],
    Misc: ["Docker", "Kubernetes", "Git"],
  };

  return (
    <div className="space-y-8">
      <Controller
        control={form.control}
        name="currentSkills"
        render={({ fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Current skills *</FieldLabel>
            <p className="text-sm text-muted-foreground">
              Select the tools and languages you've used professionally. Add anything missing from the list.
            </p>
            <div className="space-y-4">
              {Object.entries(CHIP_GROUPS).map(([group, chips]) => (
                <div key={group}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => toggleChip(chip)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          selected.includes(chip)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFreeText())}
                  placeholder="Add something else..."
                  className="border rounded px-3 py-1 text-sm flex-1"
                />
                <button type="button" onClick={addFreeText} className="px-3 py-1 text-sm border rounded">
                  Add
                </button>
              </div>
            </div>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="yearsExperience"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>How long have you been building software professionally? *</FieldLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-invalid={fieldState.invalid}
            >
              {[
                { value: "0-1", label: "Less than 1 year" },
                { value: "2-4", label: "Mid-level (2–4 years)" },
                { value: "5-9", label: "Senior / experienced (5–9 years)" },
                { value: "10+", label: "Veteran (10+ years)" },
              ].map(({ value, label }) => (
                <Field key={value} orientation="horizontal">
                  <RadioGroupItem value={value} id={`years-${value}`} />
                  <FieldLabel htmlFor={`years-${value}`} className="font-normal">
                    {label}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </div>
  );
}

// Target role, stack preference, target stack (conditional)
function Step2({ form }: { form: UseFormReturn<Stage1FormData> }) {
  const stackPreference = form.watch("stackPreference");

  return (
    <div className="space-y-8">
      {/* Target role */}
      <Controller
        control={form.control}
        name="targetRole"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>What kind of role are you targeting next? *</FieldLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-invalid={fieldState.invalid}
            >
              {[
                "Full-stack web",
                "AI/LLM engineering",
                "ML engineering",
                "Backend",
                "Frontend",
              ].map((role) => (
                <Field key={role} orientation="horizontal">
                  <RadioGroupItem value={role} id={`role-${role}`} />
                  <FieldLabel htmlFor={`role-${role}`} className="font-normal">
                    {role}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* Stack preference toggle */}
      <Controller
        control={form.control}
        name="stackPreference"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Do you have specific tools you want to learn, or would you like a recommendation? *</FieldLabel>
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              aria-invalid={fieldState.invalid}
            >
              <Field orientation="horizontal">
                <RadioGroupItem value="user_specified" id="pref-specific" />
                <FieldLabel htmlFor="pref-specific" className="font-normal">
                  I have specific tools in mind
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <RadioGroupItem value="market_recommended" id="pref-recommend" />
                <FieldLabel htmlFor="pref-recommend" className="font-normal">
                  Recommend based on current job market
                </FieldLabel>
              </Field>
            </RadioGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      {/* Target stack — conditional */}
      {stackPreference === "user_specified" && <TargetStackPicker form={form} />}
    </div>
  );
}

const MUTEX_GROUPS = {
  Language: ["Python", "TypeScript", "JavaScript", "Go"],
  "Web framework": ["React", "Vue", "Next.js", "Remix", "Svelte", "Angular"],
  Backend: ["Express", "FastAPI", "Django", "NestJS", "Flask"],
  Database: ["Postgres", "MySQL", "MongoDB", "DynamoDB", "SQLite"],
  "Cloud / hosting": ["AWS", "GCP", "Azure", "Vercel"],
};

const NON_MUTEX = ["Tailwind", "Docker", "GraphQL", "Redis", "Kubernetes"];

function TargetStackPicker({ form }: { form: UseFormReturn<Stage1FormData> }) {
  const selected = form.watch("targetStack") ?? [];

  function toggle(tool: string, isMutex: boolean, groupTools?: string[]) {
    let next: string[];
    if (selected.includes(tool)) {
      next = selected.filter((s) => s !== tool);
    } else if (selected.length >= 4) {
      return; // cap at 4
    } else if (isMutex && groupTools) {
      // remove any other selection from the same mutex group, then add
      next = [...selected.filter((s) => !groupTools.includes(s)), tool];
    } else {
      next = [...selected, tool];
    }
    form.setValue("targetStack", next, { shouldValidate: true });
  }

  return (
    <Controller
      control={form.control}
      name="targetStack"
      render={({ fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel>
            Pick the tools you want to learn. We'll fill in the supporting pieces. *{" "}
            <span className="font-normal text-muted-foreground">
              Selected: {selected.length} / 4
            </span>
          </FieldLabel>

          <div className="space-y-4">
            {Object.entries(MUTEX_GROUPS).map(([group, tools]) => (
              <div key={group}>
                <p className="text-xs font-medium text-muted-foreground mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool) => {
                    const isSelected = selected.includes(tool);
                    const groupHasSelection = tools.some((t) => selected.includes(t));
                    const isDisabled = !isSelected && groupHasSelection;
                    return (
                      <button
                        key={tool}
                        type="button"
                        disabled={isDisabled || (!isSelected && selected.length >= 4)}
                        onClick={() => toggle(tool, true, tools)}
                        title={isDisabled ? `${group} — pick the one you're seeing in job listings you're targeting` : undefined}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary"
                        }`}
                      >
                        {tool}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Additional tools (pick up to 2)</p>
              <div className="flex flex-wrap gap-2">
                {NON_MUTEX.map((tool) => {
                  const isSelected = selected.includes(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      disabled={!isSelected && selected.length >= 4}
                      onClick={() => toggle(tool, false)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary"
                      }`}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

// Timeline, hours per week
function Step3({ form }: { form: UseFormReturn<Stage1FormData> }) {
  return (
    <div className="space-y-8">
      <div className="flex gap-12">
        {/* Timeline */}
        <Controller
          control={form.control}
          name="timelineWeeks"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>How many weeks do you have? *</FieldLabel>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                aria-invalid={fieldState.invalid}
              >
                {[
                  { value: "3", label: "3 weeks — Sprint" },
                  { value: "6", label: "6 weeks — Short" },
                  { value: "9", label: "9 weeks — Medium" },
                  { value: "12", label: "12 weeks — Extended" },
                ].map(({ value, label }) => (
                  <Field key={value} orientation="horizontal">
                    <RadioGroupItem value={value} id={`timeline-${value}`} />
                    <FieldLabel htmlFor={`timeline-${value}`} className="font-normal">
                      {label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {/* Hours per week */}
        <Controller
          control={form.control}
          name="hoursPerWeek"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>How many hours per week can you dedicate? *</FieldLabel>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                aria-invalid={fieldState.invalid}
              >
                {[
                  { value: "5-10", label: "5–10 hrs — Light" },
                  { value: "10-20", label: "10–20 hrs — Moderate" },
                  { value: "20+", label: "20+ hrs — Heavy" },
                ].map(({ value, label }) => (
                  <Field key={value} orientation="horizontal">
                    <RadioGroupItem value={value} id={`hours-${value}`} />
                    <FieldLabel htmlFor={`hours-${value}`} className="font-normal">
                      {label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
    </div>
  );
}

// Review all inputs
function Step4({ form }: { form: UseFormReturn<Stage1FormData> }) {
  const values = form.getValues();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3 text-sm">
        <div>
          <span className="font-medium">Current skills: </span>
          {values.currentSkills.join(", ")}
        </div>
        <div>
          <span className="font-medium">Experience: </span>
          {values.yearsExperience}
        </div>
        <div>
          <span className="font-medium">Target role: </span>
          {values.targetRole}
        </div>
        <div>
          <span className="font-medium">Stack: </span>
          {values.stackPreference === "market_recommended"
            ? "Market recommendation"
            : values.targetStack?.join(", ")}
        </div>
        <div>
          <span className="font-medium">Timeline: </span>
          {values.timelineWeeks} weeks
        </div>
        <div>
          <span className="font-medium">Hours per week: </span>
          {values.hoursPerWeek}
        </div>
      </div>
    </div>
  );
}

const SUBTITLE: Record<Exclude<StreamState["status"], "idle">, string> = {
  streaming: "Generating…",
  confirming: "Finishing up — saving your analysis…",
  ready: "Your analysis is ready.",
  failed: "Something went wrong.",
};

function StreamingView({
  state,
  onView,
  onRegenerate,
}: {
  state: StreamState;
  onView: (transitionId: string) => void;
  onRegenerate: () => void;
}) {
  // Navigation happens only on an explicit click below — never automatically —
  // so the user can finish reading the streamed preview at their own pace.
  const parsed = "parsed" in state ? state.parsed : {};
  const subtitle = state.status === "idle" ? "" : SUBTITLE[state.status];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Building your bridge analysis</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Sections render as they arrive. Polished layout is Milestone 3, Task 3. */}
      {parsed.summary && (
        <section className="rounded-lg border p-4 space-y-1">
          <h2 className="font-medium">Summary</h2>
          <p className="text-sm font-semibold">{parsed.summary.headline}</p>
          <p className="text-sm text-muted-foreground">{parsed.summary.currentPosition}</p>
          <p className="text-sm text-muted-foreground">{parsed.summary.destination}</p>
        </section>
      )}

      {parsed.timeline && (
        <section className="rounded-lg border p-4 space-y-1">
          <h2 className="font-medium">Timeline</h2>
          <p className="text-sm">
            <span className="capitalize">{parsed.timeline.verdict?.replace(/_/g, " ")}</span>
            {" — "}
            {parsed.timeline.reasoning}
          </p>
        </section>
      )}

      {parsed.stackRecommendation && (
        <section className="rounded-lg border p-4 space-y-1">
          <h2 className="font-medium">Recommended stack</h2>
          <p className="text-sm">{parsed.stackRecommendation.stack?.join(", ")}</p>
        </section>
      )}

      {parsed.skillBridge && parsed.skillBridge.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="font-medium">Skill bridge</h2>
          {parsed.skillBridge.map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{item.currentConcept}</span>
              {" → "}
              <span>{item.targetConcept}</span>
            </div>
          ))}
        </section>
      )}

      {parsed.newConcepts && parsed.newConcepts.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="font-medium">New territory</h2>
          {parsed.newConcepts.map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{item.concept}</span>
              <span className="text-muted-foreground ml-2">{item.importance}</span>
            </div>
          ))}
        </section>
      )}

      {parsed.projectInspirations && parsed.projectInspirations.length > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="font-medium">Project patterns</h2>
          {parsed.projectInspirations.map((item, i) => (
            <div key={i} className="text-sm">{item.pattern}</div>
          ))}
        </section>
      )}

      {/* Action area — advance only on an explicit click. */}
      {state.status === "confirming" && (
        <div className="flex items-center gap-3 pt-2">
          <span className="text-sm text-muted-foreground animate-pulse">
            Still finalizing…
          </span>
          <Button type="button" disabled>
            View your bridge analysis
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <div className="pt-2">
          <Button type="button" onClick={() => onView(state.transitionId)}>
            View your bridge analysis →
          </Button>
        </div>
      )}

      {state.status === "failed" && (
        <div className="space-y-3 pt-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <p className="text-sm text-muted-foreground">
            Your intake answers are saved — you can regenerate.
          </p>
          <Button type="button" onClick={onRegenerate}>
            Regenerate
          </Button>
        </div>
      )}
    </div>
  );
}