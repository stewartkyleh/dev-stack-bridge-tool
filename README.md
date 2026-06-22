# Dev Stack Bridge Tool

A web app that helps software developers moving between tech stacks see what
transfers from what they already know, then turns their own project idea into a
phased, portfolio-ready build plan in the target stack.

It is LLM-driven but deliberately *not* an idea generator: the user brings the
project; the system maps concepts across stacks, evaluates scope, and structures
the build. Mapping concepts between skill sets is the thing LLMs are genuinely
good at, so the product is built around that strength and stays out of the way
of the things they're bad at (inventing personally compelling projects).

## Why this project exists (the hiring narrative)

This is a self-referential portfolio piece: it was built by a developer
transitioning from C#/Unity into full-stack web and AI engineering — using the
exact stack and patterns the product recommends. The app's existence is itself
evidence of competence with the target stack, and every decision below is one
I can defend in an interview. That framing is intentional, not incidental.

## The two-stage flow

The product is split into two distinct LLM-generated stages, each with its own
prompt, schema, and view:

- **Stage 1 — Bridge & Orient.** From the user's current skills, target role,
  stack preferences, timeline, and weekly hours, the model returns a bridge
  analysis: concrete mappings between current and target concepts, the genuinely
  new territory ranked by importance, a realistic timeline, and pattern
  categories of qualifying projects (sparks for the user's own idea, never
  prescriptions). This stage runs autonomously.
- **Stage 2 — Scope & Plan.** The user brings their own project idea. The model
  evaluates fit (stack coverage, scope realism, hiring signal), then produces a
  phased plan — foundation → core build → polish → ship — with milestones,
  right-sized 1–4h tasks, and learning callouts that tie back to Stage 1.

The split lets each stage play to a different model strength. One omnibus prompt
doing both jobs is mushy at both; more than two stages adds clicks for marginal
benefit.

## Tech stack and why each choice

The "why" matters more than the "what" here — these are the decisions a hiring
engineer would probe.

- **Next.js (single app, App Router).** The whole product — UI, Server
  Components, and API Route Handlers — is one Next.js application rather than a
  separate backend plus an SPA. On a two-week build, splitting across two
  services doubles the setup, deploy, and context-switching cost for zero
  functional gain at this scale. The Route Handlers are thin enough to extract
  into their own service later if the product ever outgrows this shape.

- **Anthropic Claude.** Sonnet drives the main generations, Haiku the auxiliary
  ones. The prompts are provider-agnostic, so this is a swap-the-SDK-and-key
  decision, but Claude won on its reliability at structured-JSON output during
  testing (the whole app depends on parsing the model's JSON against a Zod
  schema). Self-hosting an open model was out of scope — the operational
  overhead doesn't pay back at portfolio scale.

- **Postgres (Neon).** The core data model is relational by nature
  (User → Transition → Project → Phase → Milestone → Task), so Postgres fit
  better than a document store; JSONB columns hold the model's display-only JSON
  outputs without giving up relational guarantees everywhere else. Neon is
  genuinely free at this scale, autosuspends to zero when idle, and its
  serverless connection model suits Vercel.

- **Prisma.** A single schema file generates a fully-typed TypeScript client and
  first-class migrations. For a project where I'm sharpening TypeScript, the
  strongest possible type safety at the data boundary was worth more than the
  SQL transparency of a lighter query builder.

- **Clerk.** Hosted auth with a polished sign-in UI, OAuth, sessions, password
  reset, and webhooks in ~15 minutes of setup. Authentication isn't this
  product's differentiator — the AI integration is — so spending two to three
  days hand-rolling auth would be effort in the wrong place. The free tier is
  far beyond any portfolio-scale traffic.

- **Vercel.** `git push` → live URL with effectively zero configuration, which
  is the right call when the goal is to actually ship in two weeks. AWS exposure
  can be added later as a targeted signal (e.g. swapping the LLM call to
  Bedrock) without blocking the MVP.

Supporting cast: **Zod** (the single source of truth for LLM output schemas — the
prompt's JSON schema is generated from it), the **Vercel AI SDK** (streaming),
**Upstash Redis** (rate limiting), and **Tailwind CSS** with **shadcn/ui** for the
interface.

The deeper rationale and the trail of decisions that were reconsidered along the
way live in [`docs/plans/decisions-log.md`](docs/plans/decisions-log.md).

## Running locally

Prerequisites: Node 18+ and accounts for Neon (Postgres), Clerk, Anthropic, and
Upstash Redis.

1. Install dependencies (a `postinstall` hook runs `prisma generate`):

   ```bash
   npm install
   ```

2. Create `.env.local` from the template and fill in every value:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Purpose |
   | --- | --- |
   | `DATABASE_URL` | Neon Postgres connection string (pooled) |
   | `DIRECT_DATABASE_URL` | Direct connection, used for Prisma migrations |
   | `CLERK_SECRET_KEY` | Clerk server-side key |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client-side key |
   | `CLERK_WEBHOOK_SECRET` | Verifies Clerk webhook signatures |
   | `ANTHROPIC_API_KEY` | Anthropic API access |
   | `UPSTASH_REDIS_REST_URL` | Rate-limit store |
   | `UPSTASH_REDIS_REST_TOKEN` | Rate-limit store |
   | `CRON_SECRET` | Protects the anonymous-cleanup cron endpoint |

3. Apply the schema to your database:

   ```bash
   npx prisma migrate dev
   ```

4. Start the dev server at [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Testing

Tests run on Vitest and assert external behaviour, not implementation details:

```bash
npm test
```

See [`docs/testing.md`](docs/testing.md) for the convention and the two seams
(route handlers and pure logic).
