# Decisions Log

Captures the "why" behind decisions that would otherwise be re-litigated — mainly deliberate non-goals and anti-refactor guards whose rationale isn't reconstructable from the code. Code/schema is the source of truth for literal artifacts; entries point at them rather than restating. Stack "why" lives in the README; heavy/contested decisions get a full ADR in `docs/adr/`.

Format per entry: the title states the decision; the body gives the load-bearing **Why** (especially the failure mode it prevents) and a one-word **Reversal** cost. Edit and compress entries freely — git history is the archive.

---

## D-001 – D-006: Foundational stack choices — moved to the README

The rationale for the foundational tool choices — **Clerk** (auth), **Postgres/Neon** (database), **Prisma** (ORM), **Next.js as one app** (framework), **Vercel** (hosting), and **Anthropic Claude** (LLM) — now lives in the README's "Tech stack and why each choice" section, written for the hiring engineers who actually read it. Moved out of this log so there is a single, non-drifting copy. These D-numbers are retired, not reused; git history holds the original entries.

---

## D-007: Product flow — two-stage (Bridge + Plan) over single-shot

**Why:** LLMs are strong at mapping concepts across skill sets (Stage 1, autonomous) but weak at inventing personally compelling project ideas (Stage 2 needs the user's idea). One omnibus prompt is mushy at both jobs; 3+ stages add clicks for marginal benefit. **Reversal:** High — the split shapes the DB schema, route map, and UI flow.

---

## D-008: Product scope — portfolio-project-first only, no tutorial mode

**Why:** a sharp, opinionated product beats a flexible-but-mushy one. Tutorial plans produce stale "watch this YouTube series" output; project plans are durable, and dropping the choice tightens each prompt to one job. Also matches what the builder is doing personally (empathy with the user). **Reversal:** Low — tutorial mode is later a feature flag + a different prompt; nothing forecloses it.

---

## D-009: Ownership — nullable `userId` XOR `anonymousSessionId` from day 1

**Why:** anonymous-first lets recruiters generate something useful before converting at the point of engagement — a near-certain conversion win. Building it day 1 costs one column + one query; retrofitting means migrating `userId` to nullable plus a claim mechanism. The XOR (never both, never neither) is enforced by a CHECK constraint in `schema.prisma`. **Reversal:** Low — disable by dropping cookie issuance in middleware; no reason to.

---

## D-010: Stack input — user-picked tools are required, mutex within categories *(refined by D-027)*

**Why:** users come from job descriptions full of buzzwords they don't fully grasp, so the form enforces stack coherence (no two databases, no two frontends) they couldn't enforce themselves. Treating picks as requirements — not a wishlist the LLM curates down — matches the mental model "show me how to learn these specific tools." **Reversal:** Moderate — the mutex UI is non-trivial.

---

## D-011: Tool cap — 4 maximum

**Why:** 4 anchors a coherent stack (≈ language + frontend + backend + database) while leaving room for the LLM to fill supporting tools (auth, deploy, CSS, ORM). Higher caps made the model stuff every tool into the plan → scope bloat; lower caps forced too much inference. 4 tested cleanest. **Reversal:** Low — a single constant.

---

## D-012: No "plan style" axis (Sprint / Balanced / Foundational)

**Why:** three options dilute commitment; two invite picking what *sounds* better over what serves the user. Dropping the axis keeps the product opinionated with timeline as the only pace lever — one less thing the user shouldn't have to reason about. **Reversal:** Low — re-adding the field is a one-field form change.

---

## D-013: Storage — normalized Phase/Milestone/Task tables; other outputs as JSON

**Why:** Tasks carry per-row state (completion) the user toggles; a single JSON blob would need a racy read-modify-write per checkbox. Display-only outputs (the bridge analysis) have no such interaction, so they stay JSON. Phase and Milestone are normalized for consistency with Task. See `schema.prisma`. **Reversal:** High — schema change + data migration.

---

## D-014: Scope enum — four values, not three

**Why:** three values bias the LLM to a safe "ok" middle; four forces a side, and `too_modest` catches the otherwise-invisible failure mode of users underscoping to feel safe (the "30% budget unused = too_modest" rule blocks hedging into "realistic"). Values live in `projectOutputSchema`. **Reversal:** Low.

---

## D-015: Identifier strategy — CUID for IDs *(overturned by D-022)*

Tombstone. Originally chose CUID; reversed to UUID — rationale folded into D-022. Full original entry in git history.

---

## D-016: Store `rawLlmOutput` per generation

**Why:** ~50KB/row is noise at this scale, and keeping the unparsed response lets prompt/schema changes be re-validated against historical outputs without re-calling the API — invaluable while iterating prompts. **Reversal:** Low — drop the column when scale matters.

---

## D-017: Hard delete, no soft delete

**Why:** soft delete makes every query (especially joins) carry an easy-to-forget `WHERE deletedAt IS NULL`; the overhead isn't worth it at portfolio scale. Want a deleted plan back? Regenerate it — that's UX, not DB recovery. **Reversal:** Moderate — adding `deletedAt` later touches every query.

---

## D-018: Drafts in `localStorage`, not a `DraftTransition` table

**Why:** in-progress form state has no value beyond the immediate session/device, so a table's schema, query patterns, and cleanup logic buy nothing. **Reversal:** Low — a drafts table is additive later.

---

## D-019: Project inspirations are patterns, not specific apps

**Why:** LLMs don't know the user's life, frustrations, or hobbies, so concrete suggestions ("build a todo app") produce forgettable portfolio pieces. Framing inspirations as patterns ("a tool that automates a weekly task in your life") invites the user's own idea, which Stage 2 evaluates — preserving the model's strength (pattern-matching), avoiding its weakness (idea generation). **Reversal:** Low — prompt change.

---

## D-021: Prisma client singleton in development

**Why:** Next's dev server hot-reloads modules, spawning a new `PrismaClient` on every file change and exhausting the connection pool; caching one instance prevents that. Production doesn't hot-reload, so the singleton path is never hit there. **Reversal:** Low — remove the file.

---

## D-022: Identifier strategy — UUID v4 over CUID *(overrides D-015)*

**Why:** UUID is the industry-standard distributed ID and needs no extra package (`crypto.randomUUID()` is native in Node 18+ and the browser); CUID's edge (shorter, time-sortable) has no practical value at this scale, and the common format is better portfolio signal. The switch is Prisma-level only — `@default(uuid())` vs `@default(cuid())` produces no SQL diff, so `prisma generate` sufficed, no migration. **Reversal:** High once data is in production (ID format = data migration); trivial while tables are empty.

---

## D-023: Streaming client — custom fetch hook over `useCompletion`

**Why:** `useCompletion` exposes only the text stream and no response headers (AI SDK v6). The route handler pre-generates the Transition id and returns it as an `X-Transition-Id` header (not embedded in the stream) so the post-stream redirect has it — and reading a header needs a raw `fetch`. The hook (`app/lib/hooks/useTransitionStream.ts`) holds a `StreamState` union and renders partial output via `partial-json`'s `parse`. **Reversal:** Low — `useCompletion` works again only if the id is embedded as a data-stream annotation instead.

---

## D-024: Anonymous session — middleware forwards the session as both cookie and request header

**Why:** a cookie set on the middleware *response* is not in `req.cookies` on the *same* request — only on the next one — so a first-time visitor's route handler reads `anon_session` as `undefined` and 401s. Middleware therefore also forwards the id as an `x-anon-session` request header (`NextResponse.next({ request: { headers } })`); the handler reads `cookie ?? header`, covering both first-request and repeat-visit. **Reversal:** Low — drop the forwarding + the header fallback.

---

## D-025: Stage 1 — confirm persistence before advancing, don't auto-redirect

**Why:** the DB write happens in `onFinish`, unordered relative to the client receiving the stream's `done`, so an auto-redirect can land on a not-yet-written row and 404. Instead the client polls a background `GET` (short backoff) and enables a button to `/transitions/[id]` once the row exists; the button also lets the user finish reading the streamed preview. The `localStorage` draft clears on confirmed success, not at submit, so inputs survive a failed generation. **Reversal:** Low.

---

## D-026: Claim on signup via redirect, not the webhook — see ADR 0001 *(refined by D-037)*

**Why:** the Clerk webhook is server-to-server — it never sees the `anon_session` cookie (so can't know which session to claim) and only fires on sign-up (missing returning users). So claiming is a browser-triggered authenticated route; the webhook only provisions the User row. Full rationale in `docs/adr/0001-claim-on-signup-via-redirect.md`. **Reversal:** Low–moderate.

---

## D-027: Stack picker — scaffold-level starting points *(refines D-010)*

**Why:** the old "web framework" mutex group made React and Next.js mutually exclusive — blocking the exact "React + Next.js off a job description" case D-010 exists to serve. Replaced by pick-one *app starting points* (Next.js, Remix, React SPA, SvelteKit, Nuxt, Vue SPA, Angular) that each name their UI library for legibility; one pick = one of the 4 slots, and only the framework name lands in `targetStack` (library implied), so the payload doesn't over-stuff the stack. **Reversal:** Low.

---

## D-028: `market_recommended` — honest framing now, curated stacks deferred

**Why:** the brief already says recommendations reflect a curation date, not live data, so the prompt's "current industry demand" wording overclaimed; it now frames output as a commonly-used coherent stack with a dated "not live job data" disclaimer. Honest wording is free; curated per-role anchor stacks are real work, parked as a stretch goal (a live job-market data source is an explicit non-goal). **Reversal:** Low.

---

## D-029: Auth boundary — anonymous users get Stage 1 only

**Why:** Stage 2 is the more expensive call, so gating it behind an account bounds abuse and matches the brief (every anonymous success criterion names Stage 1 only). The reviewer "see the full flow" need is met by the sample-plan landing stretch goal, not by opening Stage 2. **Reversal:** Low for claiming (a Project rides its Transition's claim) but would need a Stage 2 rate limit.

---

## D-030: Zod schema is the single source of truth for LLM output

**Why:** three hand-synced copies (Zod, embedded prompt schema, markdown) drift silently into validation failures exactly as you start iterating prompts. The prompt's JSON schema is generated from Zod via `z.toJSONSchema()`, and per-stage call settings (model, temperature, max output tokens, cache control) live as colocated constants in `app/lib/prompts/stage{1,2}.ts`; `llm-prompts.md` is retired. **Reversal:** Low. (`streamObject`/`Output.object` deferred — would unwind D-023 and fork the cross-stage streaming pattern.)

---

## D-031: Per-user generation rate limit (≈20/day)

**Why:** signed-in users were uncapped yet are the only ones who can run the expensive Stage 2 call. Both generate routes now add a per-user-id key on the existing Upstash limiter (alongside the anonymous per-IP limit), closing the cost hole and making `architecture.md`'s two-axis claim true. **Reversal:** Low.

---

## D-032: Stage 2 streaming client — fork, don't generalize

**Why:** two call sites don't justify a generic `useGenerationStream<T>`, and their navigation genuinely differs — Stage 1 redirects to `/transitions/[id]` keyed by a *pre-generated* id that must return via the `X-Transition-Id` header (D-023); Stage 2 redirects to `/transitions/[id]/plan` keyed by the *already-known* Transition id, no header involved. One signature would have to absorb that header-vs-known-URL split for no payoff. So Stage 2 gets its own `useProjectStream` + `projectStreamState` reducer (`idle → streaming → confirming → ready → failed`, typed to `Partial<ProjectOutput>`), copied not shared. **Reversal:** Low — if a third flow appears, lift the two near-identical reducers into a generic then.

---

## D-033: Stage 2 persistence — derive `order`/`completed`, keep them out of the LLM contract

**Why:** array position already conveys order, so a model-emitted `order` is redundant *and* dangerous — a duplicated or skipped number trips `@@unique([parentId, order])` → `P2002` → the entire nested write fails → forced regeneration. Deriving `order` from a 1-based array index makes that unviolatable; `completed` is owned by Prisma's `@default(false)`, and emitting `completed: false` per task is pure token waste against the `maxOutputTokens` cap (Stage 2 produces the most rows). Principle: the output schema carries only what the model actually decides; positional and state fields are derived at persist. Both fields are removed from `projectOutputSchema`; the prompt schema follows via D-030. **Reversal:** Low — re-add the fields to the Zod schema.

---

## D-034: One Project per Transition — block a second plan with 409, don't regenerate

**Why:** regeneration (full or per-phase) is a stretch goal, so blocking is the honest MVP behavior. `Project.transitionId` is `@unique`; `/transitions/[id]/plan/new` redirects to the plan when one exists, and the generate route short-circuits **409 before** calling Claude (no needless token spend). The client treats 409 as "already exists" and navigates to the plan — which also absorbs the D-025 edge where the confirm poll failed but the row persisted and the user retried. **Reversal:** Low — swap the 409 guard for delete-then-create (hard delete cascades, D-017) or a per-phase mutation.

---

## D-035: Raise Stage 2 `maxOutputTokens` to 16000 (Stage 1 stays 8192)

**Why:** manual testing hit `finishReason: "length"` on real plans — Stage 2 is the largest output (phases × milestones × tasks, each with a description; the row explosion of D-033). Truncation fails the `projectOutputSchema` parse in `onFinish` → nothing persists → forced regenerate (D-032), so the cap silently turned every large plan into a regenerate. `max_tokens` is a ceiling not a target, so raising it costs nothing on normal plans, and the route streams (`toTextStreamResponse`) so there's no HTTP-timeout risk. 16000 (2×) over the 64K ceiling because a plan needing more JSON than that is too sprawling to be a good portfolio plan — the cap doubles as a soft sanity bound. **Reversal:** Trivial — one integer in `stage2.ts`.

---

## D-036: Task toggle — idempotent set-to-desired, not server-flip

**Why:** the plan-view checkbox is optimistic with a 500ms debounce, so a request can fire more than once for one intent (retry, double-tap, React strict-mode double-invoke); a blind server-side flip isn't idempotent — a duplicate inverts the row back to the wrong state. `PATCH /api/tasks/[id]/toggle` instead takes `{ completed: boolean }` and sets it (last-write-wins; `completedAt` stamped to `now()` on completion, nulled on un-completion). The path stays `/toggle` because the *user action* is a toggle; only the wire contract is set-to-desired. **Reversal:** Low — read-then-invert and drop the body.

---

## D-037: Claim mechanism — GET `/claim` handler, bulk by cookie, global redirect *(refines ADR 0001)*

**Why:** three constraints force the shape — (1) the `anon_session` cookie is httpOnly (server-only read); (2) Next 16 forbids clearing a cookie during a Server Component render, and the claim must clear it (only Route Handlers and Server Actions may mutate cookies); (3) Clerk's after-auth redirect is a GET carrying no transition id. So a GET handler at `/claim` reads the cookie, ensures the User row (upsert by Clerk id, email from `currentUser()`) *before* a bulk `updateMany WHERE anonymousSessionId = <cookie>` (set `userId`, null the session) — ensure-User first because `Transition.userId` is an FK — then clears the cookie and 302s to `/dashboard`, or to a `redirect_url` validated by a pure `safeClaimRedirect` (relative, single-leading-slash only). Clerk points *all* sign-in/up flows at `/claim` globally (a no-op when no cookie), satisfying ADR 0001's "claim on sign-in too" from one config point. Mutation-on-GET is acceptable: the op is idempotent and scoped to the caller's own cookie. **Reversal:** Low–moderate.

---

## How to add new entries

When you make a build-time decision a future contributor — or future-you — would ask "wait, why did we do it this way?":

1. Add an entry with the next D-XXX number. **The title states the decision.**
2. Body: the load-bearing **Why** (especially the failure mode it prevents), then a one-word **Reversal** cost. Point at the code/schema for literal values instead of copying them.
3. Don't restate the title in the body, and don't list alternatives unless one is load-bearing.
4. Overturned a past decision? Fold the change-of-mind into the new entry and reduce the old one to a one-line tombstone (keeps its D-number and inbound references valid). Git holds the full original.

Don't log trivial decisions (naming, file layout). Keep it to choices that shape the product or would otherwise be re-litigated.
