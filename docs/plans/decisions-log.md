# Decisions Log

Captures the "why" behind decisions that would otherwise have to be re-litigated. Entries are append-only — if a decision is overturned, add a new entry referencing the old one rather than editing in place.

Each entry: the decision, alternatives considered, what drove the call, and a rough reversal cost if it's ever worth revisiting.

---

## D-001: Auth provider — Clerk

**Decision**: Use Clerk for authentication.

**Alternatives**: Auth.js (formerly NextAuth.js), Lucia (roll-your-own primitives), Supabase Auth.

**Rationale**: Clerk is hosted, ships a polished sign-in UI, handles OAuth + sessions + password reset + webhooks in ~15 minutes of setup. Auth.js would take 2–3 days for equivalent functionality and put more surface area in our hands. Auth isn't this product's differentiator — AI integration is — so every hour spent on password resets is an hour not spent on the prompt. Free tier (10K MAU) is well beyond any portfolio scale.

**Reversal cost**: Moderate. Clerk owns user IDs; migrating means either re-issuing IDs (and breaking links) or maintaining a mapping table. Worth committing to for the MVP.

---

## D-002: Database — Postgres over MongoDB

**Decision**: Use Postgres (Neon-hosted) as the primary store.

**Alternatives**: MongoDB Atlas, SQLite (local dev only), Supabase (Postgres + auth bundle).

**Rationale**: Both Postgres and MongoDB were on the user's job-description tool list. Postgres won because (a) the data model is relational by nature (User → Transition → Project → Phase → Milestone → Task), (b) Postgres is more frequently required in industry job postings than MongoDB, (c) JSONB columns handle the LLM's JSON outputs without giving up relational guarantees elsewhere. Neon is genuinely free at this scale (autosuspends to zero when idle) and its serverless connection model fits Vercel.

**Reversal cost**: Significant. Schema changes plus ORM swap. Not worth doing unless we hit a real Postgres limitation, which is unlikely at portfolio scale.

---

## D-003: ORM — Prisma over raw SQL or Drizzle

**Decision**: Use Prisma.

**Alternatives**: Raw SQL via `pg`, Drizzle ORM, Kysely.

**Rationale**: Prisma generates fully-typed TypeScript clients from a single schema file. Auto-migrations are first-class. The user is learning TypeScript and benefits from the strongest possible type safety at the data boundary. Drizzle is more SQL-transparent but younger and less ergonomic for a learner. Raw SQL is technically educational but slows down feature work substantially.

**Reversal cost**: Moderate. Schema and queries would need rewriting, but the table structure stays the same.

---

## D-004: Web framework — Next.js as one app

**Decision**: Build the whole product as a single Next.js application (frontend + API in one repo).

**Alternatives**: Separate Express/FastAPI backend with a Vite-based frontend. Separate Python backend for LLM calls.

**Rationale**: Two-week timeline. Splitting the codebase across two services would double the setup, deployment, and context-switching cost for zero functional gain at this scale. Next.js Route Handlers + Server Components cover both backend and frontend needs without a separate service. Defers any need for a Python service to a future project where Python demonstration is the goal.

**Reversal cost**: Low. The Route Handlers are thin enough that extracting them to a separate service later is a few-days job, not a rewrite.

---

## D-005: Hosting — Vercel over AWS direct

**Decision**: Deploy to Vercel. Use Anthropic's API directly (not via AWS Bedrock).

**Alternatives**: AWS ECS/Lambda, Render, Railway. Bedrock for the LLM line on the resume.

**Rationale**: Vercel is `git push` → live URL with zero configuration. AWS for a 2-week project is the classic way to ship nothing. AWS exposure can be added via Bedrock (one-line API swap) or S3 (PDF storage stretch goal) if the resume signal matters — but neither blocks the MVP.

**Reversal cost**: Low for hosting (it's all Node.js). Adding Bedrock later is trivial.

---

## D-006: LLM provider — Anthropic over OpenAI

**Decision**: Use Anthropic's Claude (Sonnet for main generations, Haiku for auxiliary).

**Alternatives**: OpenAI GPT-4o, Google Gemini, self-hosted open-weight model.

**Rationale**: Both Anthropic and OpenAI work. Claude was chosen for the user's own preference and the strong structured-JSON output behavior in testing. Both providers have streaming APIs and prompt caching. Self-hosted is out of scope — operational overhead doesn't pay back at this scale.

**Reversal cost**: Low. The prompt is provider-agnostic; swap the SDK and the API key.

---

## D-007: Product flow — Two-stage (Bridge + Plan) over single-shot

**Decision**: Split the LLM-generated content into two distinct stages with separate prompts, schemas, and views.

**Alternatives**: One omnibus prompt producing everything (bridge analysis + project plan together). Or three+ stages with finer granularity.

**Rationale**: LLMs are strong at mapping concepts across skill sets (Stage 1) but weak at generating personally compelling project ideas. Splitting these lets each stage play to the model's strength: Stage 1 is autonomous, Stage 2 requires user input (the project idea). One unified prompt would be mushy across both jobs. More than two stages adds clicks for marginal benefit at MVP scope.

**Reversal cost**: High. Stage split shapes the DB schema, route map, and UI flow.

---

## D-008: Product scope — Portfolio-project-first only

**Decision**: The product designs portfolio projects to qualify for jobs. It does *not* generate tutorial-style study plans.

**Alternatives**: Dual mode (portfolio OR tutorial). Tutorial-only.

**Rationale**: A sharp, opinionated product beats a flexible-but-mushy one. The portfolio path is also what the user is doing personally, which means stronger empathy with the target user. Tutorial-style plans produce stale "watch this YouTube series" output; project plans are more durable. Removing the choice also tightens the prompts and lets each one focus on doing one thing well.

**Reversal cost**: Low. Adding a tutorial mode later is a feature flag + a different prompt; nothing about the current design forecloses it.

---

## D-009: Ownership model — Nullable userId + anonymousSessionId from day 1

**Decision**: A `Transition` row is owned by either a `userId` OR an `anonymousSessionId`, never both, never neither. Enforced via a CHECK constraint.

**Alternatives**: Sign-up-required from launch (no anonymous mode). Or anonymous mode added later as a migration.

**Rationale**: Anonymous-first flow is a near-certain demo improvement — recruiters can land on the site, generate something useful, and convert to a sign-up at the point of engagement. Adding it later means a migration to make `userId` nullable and a separate "claim" mechanism. Building it in day 1 costs one extra column and one extra query for a feature that meaningfully improves conversion.

**Reversal cost**: Low (anonymous mode can be disabled by removing the cookie issuance in middleware), but there's no reason to.

---

## D-010: Stack input — Required tools with mutex categories

**Decision**: When the user selects "I have specific tools in mind," they pick 2–4 tools from category groups with mutex constraints. The LLM treats these as required.

**Alternatives**: Treat the tool list as a wishlist (LLM curates a subset). Allow free-form text entry with no category constraints.

**Rationale**: Users approaching this form are looking at job descriptions full of buzzwords they don't fully understand. Most don't know enough to pick a coherent stack themselves — they need the form to enforce coherence (no two databases, no two frontend frameworks). Treating their input as requirements (not a wishlist) matches the mental model "show me how to learn these specific tools from this listing."

**Reversal cost**: Moderate. The mutex UI is non-trivial; removing it would simplify the form but reduce input quality.

---

## D-011: Tool cap — 4 selections maximum

**Decision**: Hard cap on user-supplied stack at 4 tools.

**Alternatives**: 3, 5, 6, no cap.

**Rationale**: 4 lets the user anchor a coherent stack (typically language + frontend + backend + database, or similar) while leaving room for the LLM to fill in supporting tools (auth, deploy, CSS, ORM) without overload. Higher caps led to the LLM trying to stuff every tool into the plan, producing scope bloat. Lower caps left the LLM doing more inference than felt right. 4 was the cleanest tested point.

**Reversal cost**: Low. Easy to change the cap as a single constant.

---

## D-012: No "plan style" axis

**Decision**: Don't ask users to choose between plan styles (Sprint / Balanced / Foundational, or similar).

**Alternatives**: Three-option Sprint / Balanced / Foundational. Two-option Sprint / Foundational. Single binary fast vs thorough.

**Rationale**: Three options dilutes commitment. Two options forces a choice but invites picking based on what *sounds* better rather than what serves the user. Removing the question entirely — making the product opinionated about producing portfolio-project plans, with timeline as the only pace lever — eliminates an axis the user shouldn't have to reason about.

**Reversal cost**: Low. Adding the field back is a one-field form change.

---

## D-013: Storage — Normalized Phase/Milestone/Task tables

**Decision**: Phase, Milestone, and Task are normalized tables. Other LLM outputs (skill bridge, new concepts, fit evaluation, etc.) are stored as JSON.

**Alternatives**: Store the whole project plan as a single JSONB blob.

**Rationale**: Tasks have per-row state (completion) that the user updates. JSON-blob storage requires read-modify-write for every checkbox toggle — racy and clumsy. Display-only outputs (the bridge analysis) have no such interaction and stay as JSON. Phase and Milestone got normalized for consistency with Task, even though they don't strictly need per-row updates.

**Reversal cost**: High. Schema change with data migration.

---

## D-014: Scope enum — Four values, not three

**Decision**: Stage 2's scope verdict has four values (`too_modest` / `realistic` / `aggressive` / `too_ambitious`), not three.

**Alternatives**: Three-value enum (good / ok / too big). Numeric score.

**Rationale**: Three-value enums bias the LLM toward "ok" as a safe middle. Four forces a side. `too_modest` specifically catches a failure mode that's invisible without it: users who underscope to feel safe and end up with a portfolio piece that doesn't actually qualify them. The strict "30% budget unused = too_modest" rule prevents the model from hedging into "realistic" when it should push back.

**Reversal cost**: Low. Enum change in schema + prompt instruction.

---

## D-015: Identifier strategy — CUID over UUID *(overturned — see D-022)*

**Decision**: Use CUIDs for all generated IDs.

**Alternatives**: UUID v4, sequential integers.

**Rationale**: CUIDs are shorter (25 vs 36 chars), URL-safe by default, and time-sortable — useful in logs and debugging. UUIDs offer no meaningful advantage at this scale. Sequential integers leak record counts and are guessable, which matters once you have any data worth not enumerating.

**Reversal cost**: High. ID format change is a data migration.

---

## D-016: Debug data — Store rawLlmOutput per generation

**Decision**: Save the unparsed LLM response on every generation row.

**Alternatives**: Discard after parsing. Log to a separate service.

**Rationale**: ~50KB per row is noise at this scale. The payoff is that prompt or schema changes can be re-validated against historical outputs without re-calling the API. Invaluable when iterating prompts: you can re-run the parser on yesterday's responses to see if the new validation passes. Cost is reversible (drop the column anytime).

**Reversal cost**: Low. Drop the column when scale matters.

---

## D-017: Deletes — Hard delete, no soft delete

**Decision**: Deleted rows are gone.

**Alternatives**: Soft delete with `deletedAt` column and filtered queries.

**Rationale**: Soft delete is a feature with real maintenance overhead — every query needs a `WHERE deletedAt IS NULL` filter that's easy to forget, especially in joins. Hard delete is appropriate at portfolio scale and keeps queries simple. If a user wants a deleted plan back, that's a "regenerate it" UX, not a database recovery.

**Reversal cost**: Moderate. Adding soft delete later requires adding the column and updating every query.

---

## D-018: Drafts — localStorage over a DraftTransition table

**Decision**: In-progress form state lives in `localStorage`, not in the database.

**Alternatives**: A `DraftTransition` table that captures partial submissions.

**Rationale**: Form drafts have no value across devices or sessions beyond the immediate session. A database table adds schema complexity, query patterns, and cleanup logic for marginal benefit. `localStorage` is the right tool.

**Reversal cost**: Low. Adding a drafts table later is additive.

---

## D-019: Project inspirations — Patterns, not specific apps

**Decision**: Stage 1's project inspirations are categories of projects ("a tool that automates a weekly task in your life"), not specific app suggestions ("build a todo app").

**Alternatives**: Suggest concrete app ideas. Generate full project briefs.

**Rationale**: LLMs are bad at suggesting personally compelling app ideas — they don't know the user's life, frustrations, or hobbies. Suggesting generic apps produces forgettable portfolio pieces. Framing inspirations as patterns invites the user to bring their own idea, which Stage 2 then evaluates. The model's strength (pattern-matching) is preserved; the model's weakness (idea generation) is avoided.

**Reversal cost**: Low. Prompt change.

---

## D-020: Narrative — Self-referential hiring framing

**Decision**: Lean into "built by someone making the transition this tool was designed for" as a primary interview narrative.

**Alternatives**: Hide the meta angle; present the tool as a generic product.

**Rationale**: The story is genuinely compelling and verifiable. Recruiters and hiring managers respond to dogfooding stories. Hiding it leaves obvious questions unanswered ("why did you build this specifically?") and discards a clean interview hook.

**Reversal cost**: N/A. Narrative choice, not a code or schema decision.

---

## D-021: Prisma Singleton for Development

**Decision**: Introduce a singleton to cache Prisma's Client to use for local development.

**Alternatives**: Create a new PrismaClient instance each reload.

**Rationale**: Next.js's dev server hot-reloads modules, creating a new PrismaClient instance on every file change and exhausting the connection pool. A caching function prevents that. In production, modules don't hot reload, so the singleton path is never needed.

**Reversal cost**: Low. Remove the file.

---

## D-022: Identifier strategy — UUID over CUID *(overrides D-015)*

**Decision**: Use UUID v4 (`@default(uuid())` in Prisma schema, `crypto.randomUUID()` in application code) for all generated IDs.

**Alternatives**: CUID (D-015), sequential integers.

**Rationale**: UUID is the industry standard for distributed record IDs. It requires no extra package (`crypto.randomUUID()` is native in Node 18+ and the browser), and at portfolio scale the CUID advantages (shorter, time-sortable) have no practical value. Using the more common format is better practice for a portfolio project demonstrating real-world patterns. The schema change is Prisma-level only — `@default(uuid())` vs `@default(cuid())` generates no SQL diff, so no migration was needed; `prisma generate` was sufficient to update the TypeScript client.

**Reversal cost**: High if data is in production (ID format change is a data migration). Trivial if the tables are empty.

---

## D-023: Streaming client — Custom fetch hook over `useCompletion`

**Decision**: The streaming Client Component uses a custom fetch hook (`app/lib/hooks/useTransitionStream.ts`) rather than the Vercel AI SDK's `useCompletion`.

**Alternatives**: `useCompletion` from `ai/react`.

**Rationale**: `useCompletion` only exposes the text stream — it ignores `data-*` stream parts per the AI SDK v6 docs. The route handler pre-generates the Transition ID before the stream starts and attaches it as an `X-Transition-Id` response header (rather than embedding it in the stream), because the ID must be available for the redirect once the stream completes. `useCompletion` provides no access to response headers. A raw `fetch` call gives full access to both headers and the `ReadableStream` body with one extra function. The custom hook maintains a `StreamState` union (`idle | streaming | complete | error`) and uses `partial-json`'s named `parse` export to render partial output on each chunk.

**Reversal cost**: Low. `useCompletion` could be reintroduced if the ID were embedded as a data-stream annotation — but the header approach is simpler and equally correct.

---

## D-024: Anonymous session — Middleware must forward session as both cookie and request header

**Decision**: When middleware issues an `anon_session` cookie for a first-time anonymous visitor, it also forwards the session ID as an `x-anon-session` request header via `NextResponse.next({ request: { headers: requestHeaders } })`.

**Alternatives**: Cookie only. Route handler generates its own session ID.

**Rationale**: In Next.js, cookies set on the middleware *response* are not readable from `req.cookies` in the *same request's* route handler — they only appear on the *next* request. So on a visitor's very first request (no existing cookie), the route handler would read `req.cookies.get("anon_session")` as `undefined` and treat them as unauthenticated, returning 401. Forwarding the session ID as a request header sidesteps the timing issue: the route handler reads `req.cookies.get("anon_session")?.value ?? req.headers.get("x-anon-session")`, covering both the first-request and repeat-visit cases.

**Reversal cost**: Low. Remove the header forwarding from middleware and the header fallback from the route handler if the architecture changes.

---

## D-025: Stage 1 generation — confirm persistence, then let the user advance

**Decision**: After the Stage 1 stream completes, the client confirms the Transition row exists (a background `GET` with short backoff) before enabling a user-clicked button to advance to `/transitions/[id]`. The `localStorage` draft is cleared on confirmed success, not at submit time.

**Alternatives**: Auto-redirect on stream `done` (original plan); emit the Transition ID only after the server write completes.

**Rationale**: The DB write happens in `onFinish` and is not ordered relative to the client receiving the stream's `done`, so auto-redirect can land on a not-yet-written row and 404. Confirm-before-redirect removes the race; the button also lets the user finish reading the streamed preview. Clearing the draft only on success preserves the user's inputs if generation fails.

**Reversal cost**: Low.

---

## D-026: Claim-on-signup via redirect, not the webhook — see ADR 0001

**Decision**: Anonymous Transitions are claimed by an authenticated, browser-triggered claim route after sign-up or sign-in; the Clerk webhook only provisions the User row. Full rationale in `docs/adr/0001-claim-on-signup-via-redirect.md`.

**Rationale**: The webhook is server-to-server and never sees the `anon_session` cookie, so it cannot know which session to claim, and it only fires on sign-up (missing returning users).

**Reversal cost**: Low–moderate.

---

## D-027: Stack picker — scaffold-level starting points (refines D-010)

**Decision**: The Stage 1 "web framework" mutex group is replaced by mutually-exclusive *app starting points* (Next.js, Remix, React SPA, SvelteKit, Nuxt, Vue SPA, Angular), each displaying its underlying UI library. A pick counts as one slot toward the 4-tool cap; only the framework name is stored in `targetStack` (the library is implied, not stored).

**Alternatives**: Keep React/Vue/Next/etc. as flat mutually-exclusive peers (current — incoherent, since Next.js *is* React); soft constraints with LLM-side coherence checks; model the library↔meta-framework dependency.

**Rationale**: The old group made React and Next.js mutually exclusive, blocking the exact "React + Next.js off a job description" case D-010 exists to serve. Scaffold-level options are honestly pick-one and name the library for legibility, without inflating the payload or reviving the "long targetStack over-stuffs the stack" failure mode.

**Reversal cost**: Low.

---

## D-028: market_recommended — honest framing now, curated stacks deferred

**Decision**: The `market_recommended` prompt drops "current industry demand" and frames the output as a commonly-used coherent stack with a dated "not live job data" disclaimer. Curated per-role anchor stacks are a stretch goal, not MVP.

**Alternatives**: Inject curated, dated per-role anchor stacks now; build a live job-market data source (an explicit non-goal).

**Rationale**: The brief already states recommendations reflect a curation date, not live data — the prompt's "current demand" wording overclaimed. Honest wording is free; curation is higher-value but real work, parked as a reach goal.

**Reversal cost**: Low.

---

## D-029: Auth boundary — anonymous users get Stage 1 only

**Decision**: Anonymous use covers Stage 1 (bridge analysis) only; Stage 2 (project plan) requires an account. The reviewer "see the full flow" need is served by the sample-plan landing stretch goal, not by opening Stage 2 to anonymous use.

**Alternatives**: Allow anonymous Stage 2, claimed alongside the Transition.

**Rationale**: Stage 2 is the more expensive call; gating bounds abuse and matches the brief (every anonymous success criterion names Stage 1 only). Reversal would be nearly free for claiming (a Project rides along on its Transition's claim) but would need a Stage 2 rate limit.

**Reversal cost**: Low.

---

## D-030: Zod schema is the single source of truth for LLM output

**Decision**: The Zod output schema is canonical. The prompt's JSON schema is generated from it via `z.toJSONSchema()`, and per-stage call settings (model, temperature, max output tokens, cache control) live as colocated constants in `app/lib/prompts/stage{1,2}.ts`. Prose, schema, and failure-mode notes are colocated there; `llm-prompts.md` is retired once both modules exist.

**Alternatives**: Maintain three hand-synced copies (Zod, embedded prompt schema, markdown); adopt the AI SDK's `streamObject`/`Output.object` (deferred — would unwind D-023 and fork the cross-stage streaming pattern).

**Rationale**: Three unsynchronized copies drift silently into validation failures, exactly as the product begins iterating prompts. Generating from Zod and colocating settings makes drift impossible and keeps related knowledge together.

**Reversal cost**: Low.

---

## D-031: Per-user generation rate limit

**Decision**: Both generate routes enforce a generous per-user daily cap (≈20/day) via the existing Upstash limiter, keyed by user id, in addition to the anonymous per-IP limit.

**Alternatives**: No per-user limit (defer; correct the architecture doc instead).

**Rationale**: Signed-in users were uncapped yet are the only ones who can run the expensive Stage 2 call. The infra is already wired; a per-user key closes the cost hole and makes `architecture.md`'s two-axis claim true.

**Reversal cost**: Low.

---

## D-032: Stage 2 streaming client — fork, don't generalize

**Decision**: Stage 2 gets its own streaming client — a `useProjectStream` hook and a `projectStreamState` reducer that copy the Stage 1 lifecycle (`idle → streaming → confirming → ready → failed`) typed to `Partial<ProjectOutput>` — rather than generalizing the existing Stage 1 machinery into a shared, parameterized hook.

**Alternatives**: A generic `StreamState<T>` + `useGenerationStream<T>(endpoint, confirmUrl)` shared across both stages.

**Rationale**: Two call sites don't justify the abstraction, and the navigation models genuinely differ. Stage 1 redirects to `/transitions/[id]`, keyed by a *pre-generated* Transition id that must come back via an `X-Transition-Id` response header. Stage 2 redirects to `/transitions/[id]/plan`, keyed by the *already-known* Transition id — the new Project id is irrelevant to routing, so no header is involved. Folding both into one signature would have to absorb the header-vs-known-URL difference, muddying the shared type for no real payoff. Two simple hooks read more clearly — for a learner and in an interview — than one clever one. The reducer shape is copied (familiar), not shared.

**Reversal cost**: Low. If a third streaming flow appears, the two reducers are nearly identical and can be lifted into a generic then.

---

## D-033: Stage 2 plan persistence — derive `order` and `completed`, don't put them in the LLM contract

**Decision**: `order` and `completed` are removed from `projectOutputSchema`. The model emits phases/milestones/tasks as ordered arrays only; the DB `order` is assigned from a 1-based array index at persist time, and `completed` is owned by Prisma's `@default(false)`.

**Alternatives**: Keep the model emitting an explicit `order` int per row (the original schema) and a `completed: false` literal per task.

**Rationale**: Array position already conveys order unambiguously, so a model-emitted `order` is redundant — and dangerous: a duplicated or skipped number across the `@@unique([parentId, order])` constraints throws `P2002` and fails the *entire* nested write, turning a cosmetic numbering glitch into a forced regeneration. Deriving from index makes the constraint impossible to violate. `completed: false` on every task is pure token waste for a value the DB already defaults — and Stage 2 produces the most rows of any output, pushing against the 8192 `maxOutputTokens` cap. Principle: the LLM output schema carries only what the model actually decides; positional and state fields are derived at persist. The prompt's embedded JSON schema regenerates from the Zod source automatically (D-030), so the contract the model sees stays in lockstep.

**Reversal cost**: Low. Re-add the fields to the Zod schema; the generated prompt schema follows.

---

## D-034: One Project per Transition — block a second plan via 409, don't regenerate

**Decision**: With `Project.transitionId` `@unique` (at most one plan per Transition), a second plan attempt is blocked rather than regenerated. `/transitions/[id]/plan/new` redirects to `/transitions/[id]/plan` when a Project already exists; the generate route short-circuits with **409** *before* calling Claude. The client treats 409 as "plan already exists" and navigates to the plan instead of erroring.

**Alternatives**: Delete-and-recreate on resubmit (full-plan regeneration); a per-phase regeneration flow.

**Rationale**: Regeneration — full or per-phase — is explicitly a stretch goal, not MVP, so blocking is the honest MVP behavior. Guarding at both the page (redirect) and the route (409 before the token spend) keeps the expensive call from firing needlessly. The 409→navigate path also absorbs the D-025 edge where the confirm poll failed but the row actually persisted and the user retried: the retry lands them on their real plan rather than a duplicate-write error.

**Reversal cost**: Low. Adding regeneration later is additive — swap the 409 guard for a delete-then-create (hard delete cascades per D-017) or a per-phase mutation.

---

## D-035: Raise Stage 2 `maxOutputTokens` to 16000 (Stage 1 stays at 8192)

**Decision**: `stage2CallSettings.maxOutputTokens` goes from 8192 to 16000. Stage 1 is unchanged.

**Alternatives**: Leave at 8192 and shrink the plan (fewer phases/tasks, terser task descriptions); raise all the way to Sonnet 4.6's 64K output ceiling.

**Rationale**: Manual testing hit `finishReason: "length"` on real plans. Stage 2 is the largest output in the app — phases × milestones × tasks, each task carrying a description (the row explosion D-033 already flagged as "pushing against the 8192 cap"). A truncated stream fails the `projectOutputSchema` parse in `onFinish`, so nothing persists and the client drops into the regenerate affordance (D-032) — i.e. the cap silently turned every large plan into a forced regenerate. `max_tokens` is a ceiling, not a target, so raising it costs nothing on normal-size plans and only spends more when a plan would otherwise be cut off. The Stage 2 route streams (`toTextStreamResponse`), so 16000 carries no HTTP-timeout risk and stays well under the 64K ceiling. 16000 (2×) was chosen over 64K because a plan needing more than ~16K of JSON is itself too sprawling to be a good portfolio plan — the cap doubling as a soft sanity bound. Stage 1's output is smaller and has not truncated at 8192, so it stays put.

**Reversal cost**: Trivial. One integer in `stage2.ts`; raise toward 64K if a legitimately large plan ever truncates again.

---

## How to add new entries

When you make a meaningful build-time decision:

1. Add a new entry with the next D-XXX number.
2. State the decision, the alternatives considered, the rationale, and the reversal cost.
3. Keep entries append-only. If a decision is later overturned, add a new entry that references the old one and explains what changed.

Don't log trivial decisions (variable naming, file organization). Do log anything where a future contributor — or future-you — might reasonably ask "wait, why did we do it this way?"
