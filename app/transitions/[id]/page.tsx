import { auth } from "@clerk/nextjs/server";
import { SignUpButton } from "@clerk/nextjs";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/prismaSingleton";
import {
  transitionOutputSchema,
  type TransitionOutput,
} from "@/app/lib/schemas/transitionOutput";
import { planCta, type PlanCta } from "@/app/lib/planCta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TransitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await auth();
  const cookieStore = await cookies();
  const anonSessionId = cookieStore.get("anon_session")?.value ?? null;

  const transition = await db.transition.findUnique({
    where: { id },
    include: { project: { select: { id: true } } },
  });
  if (!transition) notFound();

  // A signed-in owner owns via userId; an anonymous owner via the session cookie.
  // Both may view the analysis, but only a signed-in owner can plan a Project
  // (Projects are userId-owned, transitive through the Transition — D-034).
  const isSignedInOwner = userId !== null && transition.userId === userId;
  const isOwner =
    isSignedInOwner ||
    (anonSessionId !== null && transition.anonymousSessionId === anonSessionId);
  if (!isOwner) notFound();

  const cta = planCta({
    transitionId: id,
    isSignedInOwner,
    projectExists: transition.project !== null,
  });

  const output = transitionOutputSchema.parse({
    summary: transition.summary,
    timeline: transition.timeline,
    stackRecommendation: transition.stackRecommendation,
    skillBridge: transition.skillBridge,
    newConcepts: transition.newConcepts,
    projectInspirations: transition.projectInspirations,
  });

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-16">
      <SummarySection output={output} />
      <SkillBridgeSection skillBridge={output.skillBridge} />
      <NewConceptsSection newConcepts={output.newConcepts} />
      <TimelineSection timeline={output.timeline} />
      <ProjectInspirationsSection inspirations={output.projectInspirations} />
      <PlanCtaSection cta={cta} />
    </main>
  );
}

// ─── Stage 2 entry point ──────────────────────────────────────────────────────

// The next step out of the analysis. A signed-in owner gets a link into the plan
// form (or their existing plan); an anonymous owner gets a contextual sign-up
// prompt rather than a link that would bounce to sign-in — the account gate as a
// value moment (issue #15). Copy + placement here had a human design review.
function PlanCtaSection({ cta }: { cta: PlanCta }) {
  if (cta.kind === "signup") {
    return (
      <section className="rounded-lg border p-6 text-center space-y-3">
        <h2 className="text-xl font-semibold">Get a step-by-step build plan</h2>
        <p className="text-sm text-muted-foreground">
          Sign up to turn this bridge analysis into phases, milestones, and tasks.
        </p>
        {/* Once claim-on-sign-up (ADR 0001) is wired, returning here flips this
            section to the plan link below. */}
        <SignUpButton>
          <Button size="lg">Create free account</Button>
        </SignUpButton>
      </section>
    );
  }

  const existing = cta.kind === "plan-existing";
  return (
    <section className="rounded-lg border p-6 text-center space-y-3">
      <h2 className="text-xl font-semibold">Ready to build?</h2>
      <p className="text-sm text-muted-foreground">
        {existing
          ? "Pick up your project plan where you left off."
          : "Turn this analysis into a phased project plan."}
      </p>
      <Button asChild size="lg">
        <Link href={cta.href}>
          {existing ? "View your project plan" : "Plan a project"}
        </Link>
      </Button>
    </section>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function SummarySection({ output }: { output: TransitionOutput }) {
  const { summary, timeline, stackRecommendation } = output;

  const verdictStyles: Record<typeof timeline.verdict, string> = {
    realistic: "bg-green-100 text-green-800",
    aggressive_but_doable: "bg-amber-100 text-amber-800",
    unrealistic: "bg-red-100 text-red-800",
  };
  const verdictLabel: Record<typeof timeline.verdict, string> = {
    realistic: "Realistic",
    aggressive_but_doable: "Aggressive but doable",
    unrealistic: "Unrealistic",
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{summary.headline}</h1>
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <span>{summary.currentPosition}</span>
        <span>→</span>
        <span className="text-foreground font-medium">{summary.destination}</span>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className={verdictStyles[timeline.verdict]}>
            {verdictLabel[timeline.verdict]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {timeline.userRequestedWeeks}w requested · {timeline.recommendedWeeks}w recommended
          </span>
        </div>
        <p className="text-sm">{timeline.reasoning}</p>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {stackRecommendation.source === "market_recommended"
            ? "Market-recommended stack"
            : "Your target stack"}
        </p>
        <div className="flex flex-wrap gap-2">
          {stackRecommendation.stack.map((tool) => (
            <Badge key={tool} variant="secondary">{tool}</Badge>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{stackRecommendation.reasoning}</p>
      </div>
    </section>
  );
}

// ─── Skill Bridge ─────────────────────────────────────────────────────────────

const strengthStyles: Record<"high" | "medium" | "low", string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

function SkillBridgeSection({
  skillBridge,
}: {
  skillBridge: TransitionOutput["skillBridge"];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Skill bridge</h2>
        <p className="text-sm text-muted-foreground mt-1">
          What you already know and how it maps to your target stack.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>You know</TableHead>
            <TableHead>Maps to</TableHead>
            <TableHead>Transfer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skillBridge.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-sm text-muted-foreground">{row.category}</TableCell>
              <TableCell className="font-medium">{row.currentConcept}</TableCell>
              <TableCell>{row.targetConcept}</TableCell>
              <TableCell>
                <Badge variant="outline" className={strengthStyles[row.transferStrength]}>
                  {row.transferStrength}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="space-y-2">
        {skillBridge.map((row, i) => (
          <p key={i} className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {row.currentConcept} → {row.targetConcept}:{" "}
            </span>
            {row.explanation}
          </p>
        ))}
      </div>
    </section>
  );
}

// ─── New Concepts ─────────────────────────────────────────────────────────────

const importanceStyles: Record<"critical" | "important" | "nice_to_have", string> = {
  critical: "bg-red-100 text-red-800",
  important: "bg-amber-100 text-amber-800",
  nice_to_have: "bg-slate-100 text-slate-700",
};
const importanceLabel: Record<"critical" | "important" | "nice_to_have", string> = {
  critical: "Critical",
  important: "Important",
  nice_to_have: "Nice to have",
};

function NewConceptsSection({
  newConcepts,
}: {
  newConcepts: TransitionOutput["newConcepts"];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">New territory</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Concepts you&apos;ll need to learn from scratch.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {newConcepts.map((item, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{item.concept}</CardTitle>
                <Badge
                  variant="outline"
                  className={importanceStyles[item.importance]}
                >
                  {importanceLabel[item.importance]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {item.category} · {item.estimatedEffort}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.why}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineSection({
  timeline,
}: {
  timeline: TransitionOutput["timeline"];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Timeline checkpoints</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Week-by-week milestones across {timeline.recommendedWeeks} weeks.
        </p>
      </div>

      <div className="relative pl-8">
        <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
        {timeline.checkpoints.map((cp, i) => (
          <div key={i} className="relative mb-6 last:mb-0">
            <div className="absolute left-[1.35rem] top-1 w-3 h-3 rounded-full border-2 border-primary bg-background" />
            <p className="text-sm font-medium">Week {cp.week}</p>
            <p className="text-sm text-muted-foreground">{cp.milestone}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Project Inspirations ─────────────────────────────────────────────────────

function ProjectInspirationsSection({
  inspirations,
}: {
  inspirations: TransitionOutput["projectInspirations"];
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Project patterns</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Approaches that will resonate with hiring engineers in your target role.
        </p>
      </div>

      <div className="space-y-4">
        {inspirations.map((item, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <h3 className="font-medium">{item.pattern}</h3>
            <p className="text-sm text-muted-foreground">{item.whyItQualifies}</p>
            {item.examplesOfPattern.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {item.examplesOfPattern.map((ex, j) => (
                  <Badge key={j} variant="secondary" className="text-xs">
                    {ex}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}