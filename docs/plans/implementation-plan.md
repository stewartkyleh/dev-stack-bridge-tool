# Dev Stack Bridge Tool — Implementation Plan

## Fit Evaluation

**Stack coverage:** High. TypeScript runs end-to-end. React handles the multi-step form state and structured output rendering. Next.js is load-bearing: Server Components fetch saved Transitions and Projects from the database, Route Handlers proxy AI API calls with the key server-side, and the app/router structure maps directly to the two-stage UX. Postgres stores users, Transitions, and Projects with real schema design and foreign keys. The AI API integration adds a meaningful async data-flow challenge on top of the stack fundamentals.

**Scope:** Realistic. The core feature set — two-stage form flow, AI integration, auth, persistence, deploy — runs roughly 70–90 hours out of 240+ available. Without the recommended additions below, you'll be feature-complete by week 8 with weeks 9–12 returning diminishing hiring signal.

Recommended additions to fill the timeline:
- Streaming AI responses with token-by-token rendering (already planned as a core feature via the Vercel AI SDK — this note is a reminder that it's a distinct interview talking point, not just a UX nicety)
- Shareable public URLs for Transitions (`is_public` toggle with unauthenticated read support)
- Per-section plan regeneration — introduces optimistic UI updates and partial mutation patterns

**Hiring signal:** Strong. Multi-step form → AI-generated structured output → auth → per-user persistence is the highest-signal pattern from the Stage 1 analysis. The use case is immediately legible to a hiring engineer. The meta angle (a stack-transition tool built during a stack transition) makes for a natural interview narrative.

---

## Stack

| Tool | Role |
|------|------|
| TypeScript | End-to-end type safety across form inputs, AI response schemas, DB query results, and API contracts |
| React | Multi-step form state, controlled inputs, structured output rendering |
| Next.js 16 (App Router) | Full-stack framework: Server Components, Route Handlers, app/router |
| PostgreSQL (Neon) | Relational persistence. Neon's serverless connection model pairs cleanly with Vercel |
| Prisma ORM 7 | Schema-as-code, generated TypeScript types, migrations via `prisma migrate dev` |
| Clerk | Hosted auth UI, OAuth providers, session management, user lifecycle webhooks |
| Anthropic API (Claude) | LLM calls. Claude Sonnet for Stage 1 and Stage 2; Haiku for auxiliary calls. Static prompt portions use prompt caching |
| Vercel AI SDK | Streaming helper wrapping the Anthropic API with React-friendly hooks |
| Zod | Runtime validation at trust boundaries: form inputs and LLM JSON outputs |
| Upstash Redis | Anonymous generation rate limiting: 3/IP/day |
| Tailwind CSS + shadcn/ui | Utility-first styling and accessible component primitives |
| Vercel | Deployment, CI/CD, environment variables, cron scheduling |

---

## Notes on Using the Plan
1. Check off ([x]) tasks when they are completed.
2. Important decisions are to be logged in `decisions-log.md`. Read this file for historical decisions and justifications.
3. When implementation differs from the below plan, strikeout original instructions (~~) and add the implemented steps.

---

## Phase 1 — Foundation (Week 1–2)

**Goal:** A deployed Next.js app with working auth, a connected Postgres database, and a CI pipeline. No features yet — just the skeleton everything else builds on.

### Milestone 1: Project scaffolded and deployed to Vercel with a passing CI check

[x] 1. Initialize Next.js with TypeScript and Tailwind via `create-next-app`. Accept the app/router default. Verify `strict` mode is on in `tsconfig.json`.
[x] 2. Push to GitHub and connect the repo to Vercel. Confirm a preview deployment succeeds on the first push — this is your deploy pipeline baseline.
[x] 3. Add a GitHub Actions workflow that runs `tsc --noEmit` on every PR. One YAML file. This is your safety net for the rest of the build.

### Milestone 2: Postgres database connected and schema applied

[x] 1. Provision a Neon Postgres instance and add `DATABASE_URL` and `DIRECT_DATABASE_URL` to `.env.local`. Never commit this file — add it to `.gitignore` now. Add production values in Vercel's environment variable settings. `DIRECT_DATABASE_URL` is required by Prisma for migrations against Neon's serverless connection pooler.
[x] 2. Install Prisma and write the initial `schema.prisma` ~~with three models:
   - `User`: `id` (Clerk userId as string PK), `email`, `createdAt`
   - `Transition`: `id`, `userId` (nullable FK to User), `anonymousSessionId` (nullable string), `payload Json`, `createdAt` — with a CHECK constraint enforcing exactly one of `userId` or `anonymousSessionId` is non-null
   - `Project`: `id`, `transitionId` (FK to Transition), `payload Json`, `completedTasks` (string array), `createdAt`~~
   using the schema detailed in `database-schema.md`.
[x] 3. Update Prisma 7's `prisma.config.ts` file to reference `.env.local` and use the `DIRECT_DATABASE_URL`.
[x] 4. Run `prisma migrate dev` and confirm tables exist in the Neon console.
[x] 5. Add a CHECK constraint to guarantee for a `transitions` table entry either `userID` OR `anonymousSessionID` is present, but not both.

### Milestone 3: Auth working — users can sign in and sign out

[x] 1. Install Clerk and add `ClerkProvider` to the root layout. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local` and Vercel. Register a GitHub OAuth provider in the Clerk dashboard.
[x] 2. Add `proxy.ts` using Clerk's `clerkMiddleware()`. Protected paths: `/dashboard`, `/api/transitions/[id]/*`, `/api/tasks/*`. Public paths: `/`, `/sign-in`, `/sign-up`, `/transitions/new`, `/api/transitions/generate`. This file is also where the anonymous session cookie is issued for eligible paths — it's the single auth enforcement point, not per-route checks.
[x] 3. Create the `/api/webhooks/clerk` Route Handler. Verify the Svix signature using `CLERK_WEBHOOK_SECRET` before processing — return 401 if verification fails. On `user.created`: insert a User row keyed by the Clerk user ID. This is how users enter Postgres, not an upsert on sign-in.
[x] 4. Add sign-in and sign-out UI using Clerk's `<SignInButton>` and `<UserButton>` components. Confirm the `/dashboard` redirect works for unauthenticated users. Use `auth()` in Server Components to get the current user — not `getServerSession`.

### Learning callouts

**Web deployment: environment variables, hosting, and CI** — first encountered here. `.env.local`, Vercel secret injection, and the GitHub Actions check are your first hands-on reps. Note that both `DATABASE_URL` and `DIRECT_DATABASE_URL` are needed for Prisma on Neon.

**HTTP, REST, and statelessness** — first encountered here. Clerk session cookies are the concrete implementation of statelessness workarounds: the server issues a session token, stores nothing in memory between requests, and the token reconnects the request to the user. The `/api/webhooks/clerk` endpoint demonstrates a different HTTP pattern: Clerk calling *your* server (not the browser), with signature verification as the auth mechanism.

**Server/client boundary in Next.js** — first encountered here. `proxy.ts` (formerly `middleware.ts`) runs before every request and is your first non-component server-side code. The protected `/dashboard` route uses `auth()` in a Server Component — this is the pattern you'll use everywhere.

---

## Phase 2 — Stage 1 Core: Bridge Analysis (Week 3–5)

**Goal:** A user fills out the Stage 1 form, submits it, and receives a progressively-rendered bridge analysis from Claude — streamed to the browser and saved as a Transition row.

### Milestone 1: Stage 1 multi-step form collects and validates all required inputs

[x] 1. Define the Stage 1 Zod schema in `app/lib/schemas/intake.ts`. Fields: `currentSkills` (string array, min 1), `yearsExperience` (enum: "0-1" | "2-4" | "5-9" | "10+"), `targetRole` (enum), `stackPreference` (enum: "user_specified" | "market_recommended"), `targetStack` (string array, optional at schema level, conditionally required via `superRefine` when `stackPreference === "user_specified"`, 2–4 selections), `timelineWeeks` (enum: "3" | "6" | "9" | "12"), `hoursPerWeek` (enum: "5-10" | "10-20" | "20+"). Export `Stage1FormData` as `z.infer<typeof stage1FormSchema>`.
[x] 2. Build the Stage 1 form as a 4-step Client Component at `app/transitions/new/page.tsx`. Step index managed with `useState`. Each step validates its own fields via `form.trigger(fields)` before advancing. Steps: (1) current skills chip picker + years experience radio, (2) target role radio + stack preference toggle + conditional target stack mutex picker, (3) timeline + hours per week side-by-side radios, (4) review summary. Use shadcn `Field`, `RadioGroup`, and `Button` components with `react-hook-form` `Controller` for all fields.
[x] 3. Persist form state to `localStorage` under the key `intake.stage1.draft`. Restore on mount via `form.reset()`. Save on every change via `form.watch()` subscription. Clear on successful submission. Guard restore with `try/catch` in case of corrupted data.

### Milestone 2: AI API call streams a bridge analysis and saves it as a Transition row

[x] 1. Create `POST /api/transitions/generate`. Check Clerk session with `auth()` — if none, check for the `anon_session` cookie set by middleware. Rate-limit anonymous requests via Upstash Redis: 3/IP/day, return 429 if exceeded. Validate the form payload with Zod before calling the API.
[x] 2. Use the Stage 1 system prompt (see `llm-prompts.md`) to produce JSON matching the Transition schema. Mark the static portion with Anthropic's `cache_control` to enable prompt caching. **Note:** caching uses `providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } }` on the `system` object passed to `streamText`, not a separate `cache_control` parameter.
[x] 3. Use the Vercel AI SDK's `streamText` to call Claude Sonnet and pipe the response to the browser. Accumulate the full response server-side. On completion: parse JSON, validate with Zod, write a Transition row (`userId` from Clerk session, or `anonymousSessionId` from cookie), return the new Transition ID. On parse/validation failure: log raw output server-side, return 422 with a regenerate affordance. **Notes:** `maxOutputTokens: 8192` required — 4096 is insufficient for Stage 1 output (confirmed via `finishReason: "length"` in testing). Transition ID is pre-generated with `crypto.randomUUID()` before the stream and returned via `X-Transition-Id` response header (see D-023). LLM may wrap output in a markdown fence despite instructions; apply `stripFence()` before any `JSON.parse` call.

### Milestone 3: Analysis results render progressively and redirect to `/transitions/[id]`

[x] 1. ~~Build the streaming output Client Component using the AI SDK's `useCompletion` hook.~~ `useCompletion` ignores `data-*` stream parts, making it impossible to retrieve the Transition ID from the stream. Replaced with a custom fetch hook at `app/lib/hooks/useTransitionStream.ts` that reads `X-Transition-Id` from response headers immediately after the fetch resolves, then consumes the body as a `ReadableStream`. Uses `partial-json` (`import { parse }` — named export) to parse each accumulated chunk. Applies `stripFence()` before every parse call. See D-023.
[x] 2. On stream completion, redirect to `/transitions/[id]`. Redirect wired via `useRouter` + `router.push` in a `useEffect` watching `state.status === "complete"` inside `app/transitions/new/page.tsx`.
[x] 3. Render the skill bridge as a table, new concepts as a card grid, and timeline checkpoints as a vertical timeline. Use shadcn Table, Card, and Badge components.

### Learning callouts

**SQL and relational data modeling** — first encountered here. The `userId XOR anonymousSessionId` ownership invariant (enforced by CHECK constraint) is your first schema constraint that reflects a business rule, not just data shape.

**The browser as a runtime** — first encountered seriously here. The form is a Client Component; the Route Handler is server-only (API key stays server-side). The stream crosses the boundary: server writes to a ReadableStream, browser consumes it. Trace this data path before moving on.

**CSS layout: Flexbox and Grid** — first encountered seriously here. The skill bridge table, card grid, and timeline each require a different layout model. shadcn gives you structure; you still need to understand what the Tailwind flex/grid classes are doing.

---

## Phase 3 — Stage 2 Core: Project Plan (Week 6–8)

**Goal:** From a completed Transition, a user describes a project idea and receives a structured implementation plan — phases, milestones, tasks, done criteria — saved as a Project row linked to the Transition.

### Milestone 1: Stage 2 form collects project description with Transition context attached

[x] 1. Build `/transitions/[id]/plan/new` as a Server Component that reads the saved Transition from Postgres via Prisma. Pass it as a prop to the Client Component form. Data fetching stays on the server.
[x] 2. Build the Stage 2 form: project description textarea and optional specific requirements field. Validate that the description is at least 50 characters before allowing submission.

### Milestone 2: AI API call streams a structured project plan and saves it as a Project row

[x] 1. Create `POST /api/transitions/[id]/plan/generate`. Fetch the saved Transition from Postgres inside the Route Handler — don't trust the client to send the full context. Verify ownership: `transition.userId` must match the Clerk user ID ~~(or `anonymousSessionId` must match the cookie)~~ — Stage 2 is authenticated-only and userId-keyed throughout; no anonymous path (D-029/D-034). Return 404, not 403, on ownership mismatch — never confirm the resource exists to a non-owner. Also short-circuits with **409 before calling Claude** when a Project already exists (`Project.transitionId` is `@unique`), so a re-POST neither spends tokens nor erodes the daily cap.
[x] 2. Write the Stage 2 system prompt with the full Transition context object included. Mark the static portion with `cache_control`. Expect the prompt to be 1500–3000 tokens.
[x] 3. Add a Zod schema for the Stage 2 plan output and validate the AI response.
[x] 4. On stream completion: parse, validate with Zod, then persist the plan as a **single nested transactional `prisma.project.create`** spanning Project → Phase → Milestone → Task (all-or-nothing — a partial write must never land), and return the Project ID. Confirm persistence before redirecting, per D-025.

### Milestone 3: Plan renders at `/transitions/[id]/plan` as a navigable, interactive page

[x] 1. Render the fit evaluation section: stack coverage, scope verdict, and hiring signal with color-coded badges.
[x] 2. Render phases as an accordion: each phase expands to show milestones, tasks with checkboxes, and learning callouts. Use shadcn Accordion. Checkbox state is local (`useState`) for now — persistence comes in Phase 4.
[x] 3. Render the definition of done section: must-haves as a checklist, stretch goals as a secondary list.

### Learning callouts

**Server/client boundary in Next.js** — deepened here. `/transitions/[id]/plan/new` is your first deliberate composition of a Server Component (data fetch) wrapping a Client Component (interactive form). Get this pattern right and it will feel natural for the rest of the project.

**Row-level authorization** — first encountered in depth here. The Route Handler fetches the Transition, compares `userId` to `auth()`, and returns 404 on mismatch. The 404-not-403 choice is deliberate — see error handling in `architecture.md`.

---

## Phase 4 — Persistence, Dashboard, and Anonymous Claim (Week 9–10)

**Goal:** Users can return and find their saved Transitions and Projects. Task completion persists. Anonymous Transitions generated before sign-up are claimed on account creation.

### Milestone 1: Dashboard lists all of a user's Transitions and Projects

[] 1. Build `/dashboard` as a Server Component that queries all Transitions for the current user via Prisma. Include the linked Project. Order by `createdAt DESC`.
[] 2. Render each Transition as a card: headline, target stack, created date, and a link to its plan if one exists.

### Milestone 2: Task completion state persists across sessions

[] 1. Create `PATCH /api/tasks/[id]/toggle`. Toggle the `completed` column on the `Task` row (and stamp `completedAt`). Verify ownership by walking Task → Milestone → Phase → Project → Transition, selecting only `transition.userId` — return 404 on mismatch. Projects exist only for signed-in users (D-029), so this is always a `userId` check, never anonymous.
[] 2. Wire checkbox `onChange` to a debounced fetch to the toggle endpoint (500ms). Update checkbox state immediately (optimistic update), sync in the background. On PATCH failure, revert the optimistic state and surface an inline error. This is your first optimistic UI pattern.

### Milestone 3: Anonymous Transitions are claimed on sign-up

[] 1. Implement the claim on a browser-triggered, **authenticated claim route** (Clerk redirects there after sign-up *or* sign-in) — **not** the webhook, which is server-to-server and can't see the `anon_session` cookie. The route ensures the User row exists, runs `UPDATE transitions SET userId = newUserId, anonymousSessionId = null WHERE anonymousSessionId = <cookie value>`, and clears the cookie. No Project rows to touch — ownership is transitive through the Transition. See ADR 0001 / D-026.
[] 2. Add a "Save to your account" banner on `/transitions/[id]` for unauthenticated users. On sign-up or sign-in, Clerk redirects to the claim route, which claims the Transition automatically (ADR 0001).

### Learning callouts

**SQL and relational data modeling** — deepened here. The dashboard query joins User → Transition → Project. Write the Prisma query with `include` to understand what the ORM is generating before accepting it.

**HTTP, REST, and statelessness** — reinforced here. `PATCH /api/tasks/[id]/toggle` is a clean REST partial-update example. The claim-on-signup flow demonstrates a different pattern: a server-to-server webhook triggering a database mutation on behalf of a user who just authenticated.

---

## Phase 5 — Polish and Ship (Week 11–12)

**Goal:** The app is deployed, documented, and ready to show in an interview. Error states are handled. Anonymous cleanup runs on a schedule. The README explains architectural decisions.

### Milestone 1: Error handling covers all user-facing failure modes

[] 1. Add an `error.tsx` boundary to the app/router. Catches unhandled exceptions and shows a user-readable message with a refresh action.
[] 2. Handle AI API failures explicitly: timeout, malformed JSON, validation failure, and rate-limit hit each return a structured error body with a retry affordance. The client should distinguish between "try again" (timeout, rate limit) and "something is wrong" (validation failure).
[] 3. Add `loading.tsx` skeletons for `/dashboard` and `/transitions/[id]`.
[] 4. Add a generous per-user daily generation cap (D-031) to both generate routes, reusing the Upstash limiter with a per-user key. Anonymous per-IP limiting already exists; signed-in users are currently uncapped.

### Milestone 2: Anonymous transition cleanup cron job running

[] 1. Add `POST /api/cron/cleanup-anonymous`. Deletes Transitions and Projects where `anonymousSessionId` is non-null and `createdAt` is older than 30 days. Validate Vercel Cron's `Authorization: Bearer <CRON_SECRET>` header (Vercel sends this automatically when `CRON_SECRET` is set) — return 401 if missing or wrong.
[] 2. Add the cron schedule to `vercel.json` to run daily. Add `CRON_SECRET` to Vercel environment variables.

### Milestone 3: README written and production deploy verified

[x] 1. Write a README covering: what the tool does, the tech stack and why each tool was chosen, the two-stage architecture, and how to run it locally. The "why each tool was chosen" section is what hiring engineers read — write it as if explaining your decisions in an interview. Reference `decisions-log.md` for the reasoning behind Prisma, Clerk, and Neon.
[] 2. Verify the production Vercel deploy end-to-end: sign in, create a Transition, generate a Project plan, confirm an anonymous Transition is claimable on sign-up. Run the full happy path on production, not localhost.
[] 3. Record a 2–3 minute Loom walkthrough for job applications. Demo the full flow, mention one architectural decision and why. Keep it under 3 minutes.
[] 4. Replace the boilerplate `/` with a basic landing page (headline, what it does, "Get started" → `/transitions/new`). Add a value-less `.env.example` listing every required env var. (The sample-plan landing in the stretch list is an upgrade of this.)

### Learning callouts

**Web deployment: environment variables, hosting, and CI** — completed here. The production verification step is deliberate: environment bugs only appear in production. The cron job is your first Vercel-specific infrastructure configuration.

**The browser as a runtime** — completed here. You've now built streaming responses, optimistic UI updates, and anonymous session cookies. The concept from your bridge analysis should be concrete: the browser is a stateless, event-driven runtime that communicates with your server over HTTP and renders UI from that state.

---

## Definition of Done

### Must ship

- User can sign in with GitHub OAuth via Clerk and sign out
- Anonymous user can generate a Transition without signing in (rate-limited to 3/IP/day via Upstash)
- User can submit a Stage 1 form and receive a streamed bridge analysis from Claude Sonnet
- User can submit a Stage 2 form (with Transition context attached) and receive a streamed project plan
- Both Transitions and Projects persist to Postgres via Prisma and survive page refresh
- Dashboard shows all of a user's Transitions with links to their Projects
- Task checkboxes in the plan persist to the database via `PATCH /api/tasks/[id]/toggle`
- Anonymous Transitions are claimed and assigned to the user on sign-up via the Clerk webhook
- Route Handlers return 404 (not 403) on ownership mismatch
- Daily cron job deletes anonymous Transitions and Projects older than 30 days
- App deployed on Vercel with a public URL
- All environment secrets in Vercel config, not committed to the repo
- README explains the tech stack choices and two-stage architecture

### Stretch if time permits

- Shareable public URLs for Transitions (`is_public` toggle with unauthenticated read support)
- Per-phase plan regeneration without re-running the full Stage 2 prompt
- Email/password auth as an alternative to GitHub OAuth (Clerk supports this via configuration, no code changes)
- Landing page with a sample Transition visible without sign-in
- Curated, dated per-role recommended stacks (D-028)
- Expanded tool and target-role catalog
