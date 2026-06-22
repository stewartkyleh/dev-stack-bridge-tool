# Architecture

## Tech stack

The whole product is a single Next.js application. Justifications kept brief here — the *why* behind contentious choices is in `decisions-log.md`.

- **Next.js 15 (App Router)** — full-stack framework. Pages, API, server rendering, server components, and route handlers all in one repo.
- **TypeScript** — end-to-end type safety. Mandatory given the LLM's structured JSON outputs need compile-time guarantees at the boundary.
- **Tailwind CSS + shadcn/ui** — utility-first styling and accessible component primitives. Professional default for a solo dev under time pressure.
- **Postgres (Neon)** — relational database. Free tier autosuspends to zero when idle. Serverless connection model pairs cleanly with Vercel.
- **Prisma ORM** — typed database queries. Schema-as-code, generated TypeScript types, migrations.
- **Clerk** — auth. Hosted UI, OAuth providers, session management, webhooks for user lifecycle.
- **Anthropic API** — LLM provider. Claude Sonnet for plan generation, Haiku for any auxiliary calls.
- **Vercel AI SDK** — streaming helper for LLM responses. Wraps the Anthropic API with React-friendly hooks.
- **Zod** — runtime validation. Used at trust boundaries: form inputs and LLM JSON outputs.
- **Upstash Redis** — rate limiting for anonymous generation. Free tier sufficient.
- **Vercel** — deployment. Native Next.js support, zero-config CI/CD, free tier sufficient.

## System architecture

```
┌──────────────┐     HTTPS      ┌─────────────────────────┐
│   Browser    │◄──────────────►│   Next.js on Vercel     │
│  (React UI)  │                │  ┌───────────────────┐  │
└──────────────┘                │  │  Pages (RSC)      │  │
       ▲                        │  │  + Client islands │  │
       │ Clerk widget           │  └───────────────────┘  │
       ▼                        │  ┌───────────────────┐  │
┌──────────────┐                │  │  Route Handlers   │  │
│    Clerk     │◄───────────────┤  │  (/api/*)         │  │
│   (auth)     │                │  └─────────┬─────────┘  │
└──────────────┘                └────────────┼────────────┘
                                             │
              ┌──────────────┬───────────────┼───────────────┐
              ▼              ▼                               ▼
       ┌─────────────┐ ┌───────────────┐         ┌──────────────────┐
       │ Anthropic   │ │ Upstash Redis │         │  Neon Postgres   │
       │  (Claude)   │ │ (rate limit)  │         │   (via Prisma)   │
       └─────────────┘ └───────────────┘         └──────────────────┘
```

Six services in play, but only Next.js requires application code. Everything else is consumed via SDKs.

## Server vs Client Components

Coming from Unity, the unfamiliar concept: every component in the App Router is a **Server Component** by default. It renders on the server, can directly query Postgres, ships zero JavaScript to the browser. Add `"use client"` at the top of a file to make it a Client Component — runs in the browser, can use hooks, handles events.

Pattern: keep most of the tree as Server Components, drop Client islands where you need interactivity (forms, toggles, streaming output). Server Components can render Client Components but not the reverse.

Examples in this app:

- **Dashboard page** — Server Component. Queries Postgres directly, renders the list.
- **Transition view page** — Server Component shell with Client islands for any interactive controls.
- **Plan view page** — Server Component shell; task checkboxes and edit affordances are Client islands.
- **Intake forms** — Client Components throughout (state-heavy).
- **Streaming output panel** — Client Component subscribed to the response stream.

## Data flow: end-to-end user journey

The main signed-in flow:

1. User hits `/`, sees landing page (static, no auth check).
2. Clicks "Get Started." Clerk modal handles sign-in. User lands on `/dashboard`.
3. Dashboard renders server-side by querying `Transition` rows where `userId = currentUser.id`.
4. User clicks "New Transition" → `/transitions/new`. Fills the Stage 1 intake.
5. Submit POSTs to `/api/transitions/generate`. Server route:
   - Verifies Clerk session (or anonymous session cookie — see auth section)
   - Validates form data with Zod
   - Constructs prompt from intake + cached system prompt
   - Calls Anthropic API with `stream: true`
   - Pipes the response to the browser
6. Browser renders the streaming response progressively (see streaming section for the JSON-output nuance).
7. On stream completion, server parses the JSON, validates with Zod, writes a `Transition` row, returns the ID.
8. Browser redirects to `/transitions/[id]` — server-rendered view of the bridge analysis.
9. User clicks "Plan a Project" → `/transitions/[id]/plan/new`. Fills Stage 2 form.
10. Submit POSTs to `/api/transitions/[id]/plan/generate`. Same streaming pattern. Output saved as a `Project` row linked to the transition.
11. Browser redirects to `/transitions/[id]/plan` — interactive plan view with task checkboxes.

## Route map

User-facing pages:

```
/                              landing (static)
/sign-in, /sign-up             Clerk-hosted
/dashboard                     list user's transitions
/transitions/new               Stage 1 intake form
/transitions/[id]              view transition (bridge analysis)
/transitions/[id]/plan/new     Stage 2 intake form
/transitions/[id]/plan         view project plan
```

API routes (Next.js Route Handlers):

```
POST   /api/transitions/generate              Stage 1, streams response
GET    /api/transitions/[id]
DELETE /api/transitions/[id]
POST   /api/transitions/[id]/plan/generate    Stage 2, streams response
GET    /api/transitions/[id]/plan
PATCH  /api/tasks/[id]/toggle                 set task completed state (idempotent; body { completed } — D-036)
GET    /claim                                 claim anonymous transitions on sign-up/in (bulk, by cookie — D-037, ADR 0001)
POST   /api/webhooks/clerk                    Clerk user lifecycle events
POST   /api/cron/cleanup-anonymous            daily anon-transition GC
```

Pages map to the App Router's file structure: `app/transitions/[id]/page.tsx`, `app/transitions/[id]/plan/page.tsx`, etc.

## Auth flow

Clerk handles all auth UI and session management. Integration points:

**Session resolution.** Every server-side code path uses Clerk's `auth()` helper to get the current user; Client Components use `useUser()`. Middleware (`proxy.ts`) enforces auth on protected paths — unauthenticated requests to those paths redirect to `/sign-in`.

**User row creation.** On first sign-in, Clerk fires a `user.created` webhook to `/api/webhooks/clerk`. The handler creates a corresponding `User` row in Postgres keyed by the Clerk user ID. All app queries reference this row.

**Webhook signature verification.** The webhook handler verifies the request signature using `CLERK_WEBHOOK_SECRET` before processing — Clerk uses standard Svix signature headers. Failure to verify returns 401.

## Anonymous sessions and claim-on-signup

The app supports generating a transition before sign-up, then claiming it on account creation.

**Ownership invariant.** A `Transition` row is owned by *either* `userId` OR `anonymousSessionId` (a UUID stored in a session cookie). Never both, never neither. Enforced at the database level via a CHECK constraint.

**Flow:**

1. Anonymous user hits `/transitions/new`. Server middleware checks for an `anon_session` cookie; if missing, sets one with a fresh UUID (httpOnly, secure, 30-day expiry, SameSite=Lax).
2. User submits the form. Generate route saves the resulting Transition with `userId = null, anonymousSessionId = <cookie value>`.
3. Streaming response and redirect work identically to the signed-in flow.
4. On the transition view, a "Save to your account" banner prompts sign-up.
5. User signs up via Clerk. Clerk webhook fires `user.created`.
6. After auth, Clerk redirects to an authenticated claim route (browser-originated, so the `anon_session` cookie is available). It ensures the User row exists, then runs `UPDATE transitions SET userId = <newUserId>, anonymousSessionId = null WHERE anonymousSessionId = <cookie value>` and clears the cookie. This runs on sign-in as well as sign-up. The webhook does **not** perform the claim — a server-to-server request can't see the cookie. Linked `Project` rows need no update (ownership is transitive through the Transition). The claim route is a GET handler at `/claim` that all sign-in/up flows redirect to globally (a no-op when no cookie is present); it 302s to `/dashboard` by default, or to a validated `redirect_url` so the "Save to your account" banner can return the user to their Transition. See ADR 0001 and D-037.
7. Anonymous cookie is cleared.

**Cleanup.** A Vercel Cron job runs daily, deleting anonymous transitions (and their projects) older than 30 days. Defined in `vercel.json` with the `crons` field; the cron endpoint validates a `CRON_SECRET` to prevent unauthorized invocation.

**Rate limiting.** Anonymous generation is rate-limited by IP (3 generations per IP per day) using Upstash Redis. Critical: without this, anonymous abuse burns through the Anthropic budget. Signed-in generation is also capped per user per day (D-031) — signed-in users are the only ones who can run the more expensive Stage 2 call.

## LLM streaming pattern

Both generate routes follow the same pattern:

1. Validate request and fetch context (the Transition row for Stage 2 calls).
2. Construct system prompt + user message. The static portion of the system prompt is marked with Anthropic's `cache_control` to use prompt caching.
3. Call the Anthropic streaming API via the Vercel AI SDK.
4. Pipe the stream to the browser as a `ReadableStream`.
5. Accumulate the full response server-side.
6. On stream completion: parse JSON, validate with Zod, write to Postgres.
7. On parse/validation failure: log raw output server-side for prompt debugging, return 422 to the client with a "regenerate" affordance.

**A subtlety about streaming structured JSON.** The model's response is JSON, not prose, so streaming raw tokens to the user produces unreadable output (`{"summary": {"headline": "..."`). **Decided and shipped (D-023): incremental JSON parsing.** A `partial-json` library extracts complete sections as they arrive, rendering the UI progressively — the `summary` section appears, then `timeline`, then `skillBridge` items one at a time. (The alternative considered, a plain 10–30s loading spinner with no streaming, was rejected as worse UX and kept only as a mental fallback.)

The client subscribes via a custom fetch hook (`app/lib/hooks/useTransitionStream.ts`), not the AI SDK's `useCompletion` — see D-023 for why. The rendering strategy lives in that Client Component.

## Environment variables

Required at runtime:

```
DATABASE_URL                         # Neon Postgres connection string
DIRECT_DATABASE_URL                  # for Prisma migrations
CLERK_SECRET_KEY                     # Clerk server-side key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY    # Clerk client-side key
CLERK_WEBHOOK_SECRET                 # webhook signature verification
ANTHROPIC_API_KEY                    # Anthropic API access
UPSTASH_REDIS_REST_URL               # rate-limit store
UPSTASH_REDIS_REST_TOKEN             # rate-limit store
CRON_SECRET                          # protects the cleanup cron endpoint
```

Local development uses `.env.local`, listed in `.gitignore`. Production values live in Vercel's environment variable dashboard. Preview and production environments are configured separately in Vercel.

## Middleware

`proxy.ts` at the project root runs before every request. Responsibilities, in order:

1. **Anonymous session cookie issuance** for the paths where anonymous use is allowed (`/transitions/new`, `/api/transitions/generate`). Sets the cookie if absent.
2. **Clerk auth enforcement** via `authMiddleware` — protects everything under `/dashboard`, the `/claim` route, and the non-anonymous-eligible API routes (`/api/transitions/[id]/*`, `/api/tasks/*`).
3. **Webhook routes** are explicitly excluded from auth middleware; they verify their own signatures.

## Error handling

- **Form validation errors** render inline next to the offending field, using Zod-derived error messages.
- **LLM generation failures** (timeout, malformed JSON, validation failure, rate-limit hit) return 4xx/5xx with structured error bodies. The client renders a retry affordance with the failure reason.
- **Authorization failures** return 404, not 403, on ownership mismatch — never confirm the resource exists to a non-owner.
- **Unexpected exceptions** bubble to Next.js's `error.tsx` boundary at the route segment, showing a user-readable message with a refresh action.
- **Production errors** are captured via Vercel's built-in logging; Sentry can be added if the volume justifies it.

## Cost posture

Per `decisions-log.md`, the only variable cost at portfolio scale is the Anthropic API. Architecture-level levers:

- Prompt caching on the static system-prompt portion of each Stage's prompt
- `max_tokens` capped per call to prevent runaway generations
- Plans are generated once and read from Postgres for subsequent views — no re-LLM-call on page reload
- Rate limiting prevents abuse, both authenticated (per user) and anonymous (per IP)
