# Intake Design

Two forms drive the product. Stage 1 collects everything the LLM needs to produce a bridge analysis. Stage 2 collects a project description in the context of an existing bridge analysis.

Both forms are Client Components with state managed via React hooks. Validation runs via Zod — same schema on client and server, defined once in a shared module. Form state persists to `localStorage` so a tab close doesn't destroy work.

---

## Stage 1 — Bridge analysis intake

Six fields, ~60 seconds to fill out.

### Field 1: Current skills

**Purpose**: Tells the LLM what existing concepts it can map from.

**UI**: Multi-select chip picker with common stacks pre-grouped. Free-text input at the bottom for anything missing.

**Pre-populated chips** (displayed in labeled groups):

- *Languages*: C#, Java, Python, JavaScript, TypeScript, Go, Rust, Swift, Kotlin, Ruby, PHP, C++
- *Game dev*: Unity, Unreal, Godot
- *Mobile*: iOS native, Android native, React Native, Flutter
- *Backend*: Node.js, Django, Flask, FastAPI, Spring, Rails, .NET
- *Frontend*: React, Vue, Angular, Svelte
- *Data*: SQL, Pandas, R, Spark
- *Cloud*: AWS, GCP, Azure
- *Misc*: Docker, Kubernetes, Git

Chips are non-exclusive. Free-text entries are stored alongside chip selections in a single `currentSkills` array — the LLM doesn't need to distinguish between them.

**Validation**: At least one selection (chip or free-text).

**Copy**: "Select the tools and languages you've used professionally. Add anything missing from the list."

### Field 2: Years professional

**Purpose**: Calibrates the depth of explanation in the LLM output.

**UI**: Single-select radio group.

**Options**:

- `0-1` — Less than 1 year
- `2-4` — Mid-level
- `5-9` — Senior / experienced
- `10+` — Veteran

**Validation**: Required.

**Copy**: "How long have you been building software professionally?"

### Field 3: Target role

**Purpose**: Shapes the stack recommendation and project inspirations.

**UI**: Single-select.

**Options**:

- `Full-stack web`
- `AI/LLM engineering`
- `ML engineering`
- `Backend`
- `Frontend`

**Validation**: Required.

**Copy**: "What kind of role are you targeting next?"

### Field 4: Stack preference

**Purpose**: Decides whether the user is bringing tools or getting a recommendation.

**UI**: Segmented control with two options.

**Options**:

- `I have specific tools in mind` → reveals Field 5
- `Suggest a proven stack for this role` → skips Field 5 (D-028: framed as a curated-as-of-date suggestion, not live market data)

**Validation**: Required.

**Copy**: "Do you have specific tools you want to learn, or would you like a recommendation?"

### Field 5: Target stack (conditional)

**Purpose**: The required tools the LLM must build around.

**Visibility**: Only when Field 4 is `I have specific tools in mind`.

**UI**: Categorized multi-select. Tools are grouped by category. Within each mutex category, selecting one disables the others. Total selections capped at 4.

**Mutex categories** (pick 0 or 1 from each):

| Category | Options |
|---|---|
| Language | Python, TypeScript, JavaScript, Go |
| App framework (pick one) | Next.js (React), Remix (React), React SPA (Vite), SvelteKit (Svelte), Nuxt (Vue), Vue SPA (Vite), Angular |
| Backend | Express, FastAPI, Django, NestJS, Flask |
| Database | Postgres, MySQL, MongoDB, DynamoDB, SQLite |
| Cloud / hosting | AWS, GCP, Azure, Vercel |

**Non-mutex group** (pick up to 2): Tailwind, Docker, GraphQL, Redis, Kubernetes

**Rules**:

- Total selections ≤ 4 across all categories.
- Selecting a mutex option disables others in the same group, with a tooltip explaining why.
- A selection counter is visible next to the section title: *"Selected: 2 / 4"*.

**Tooltip on disabled mutex options**: *"React and Vue solve the same problem — pick the one you're seeing in job listings you're targeting."* (Wording adapted to the actual category — Postgres/MongoDB, AWS/GCP, etc.)

**Validation**: 2–4 selections. The LLM can work with as few as 2 anchor tools.

**Copy**: "Pick the tools you want to learn. We'll fill in the supporting pieces."

### Field 6: Capacity

**Purpose**: Lets the LLM evaluate scope and timeline realism honestly.

**UI**: Two side-by-side radio groups.

**Timeline (weeks)**:

- `3` — Sprint
- `6` — Short
- `9` — Medium
- `12` — Extended

**Hours per week**:

- `5-10` — Light
- `10-20` — Moderate
- `20+` — Heavy

**Validation**: Both required.

**Copy**:

- Timeline: "How many weeks do you have?"
- Hours: "How many hours per week can you dedicate?"

### Stage 1 layout

A 4-step wizard (`app/transitions/new/page.tsx`), one field group per step, with a segmented
progress strip across the top and Back / Next navigation. Each step validates its own fields
(`form.trigger`) before advancing; the final step is a read-only review before submit.

```
Step 1 — "Your background"
  1. Current skills          (chips + free text)
  2. Years professional      (radio group)

Step 2 — "Where you're going"
  3. Target role             (radio group)
  4. Stack preference        (segmented toggle)
  5. Target stack            (conditional, mutex multi-select)

Step 3 — "Your capacity"
  6. Timeline + Hours        (two radio groups, inline)

Step 4 — "Review"           (summary of entries; [Submit: "Generate my analysis"])
```

---

## Stage 2 — Project plan intake

Two fields. ~2–5 minutes depending on how much detail the user volunteers.

### Field 1: Project description

**Purpose**: Captures the project the user wants to build, in their own words.

**UI**: Textarea, soft minimum 50 characters, soft warning at 1000.

**Placeholder**: *"Describe what you want to build. Who is it for? What problem does it solve? What features matter most? Don't worry about technical specifics — we'll cover those."*

**Collapsible "Need inspiration?" panel** below the field, expanding to show an example:

> *A web app that helps me track which of my friends have read which books from my recommendations, so I stop forgetting and re-recommending the same ones. Should let me add books, mark them as recommended to a friend, and update status when they've read it. Mobile-friendly because I'd use it at parties.*

**Validation**: Minimum 50 characters.

### Field 2: Specific requirements (optional)

**Purpose**: Hard constraints, must-includes, or anti-patterns the LLM should respect.

**UI**: Smaller textarea, optional, ~3 visible rows.

**Placeholder**: *"Anything specific to include or avoid? E.g., 'must work offline,' 'no payments,' 'must include real-time updates.'"*

**Validation**: None.

### Stage 2 layout

```
[Header: "Your project"]
[Subheader: Brief recap card of the user's stack, timeline, and hours/week]

  1. Project description     (large textarea)
  2. Specific requirements   (smaller textarea, optional)

[Submit: "Generate my plan"]
```

The recap subheader is important — it shows the user the context the LLM will use without forcing them to navigate back to the bridge analysis page.

---

## Form state persistence

Both forms persist in-progress state to `localStorage`:

```
intake.stage1.draft
intake.stage2.draft.<transitionId>
```

On mount, state is restored if a draft exists, accompanied by a small banner: *"Restored your in-progress entry."* Banner is dismissible. On successful submission, the matching draft is cleared.

This is per-browser, not per-account. A user signing in on a different device won't see their in-progress draft from another machine — acceptable for MVP.

---

## Validation strategy

- **Client-side** runs on submit. Field-level errors render inline beneath the offending field.
- **Server-side** runs in the API route handler before any LLM call. Returns 400 with a Zod error tree on failure.
- **One Zod schema** used in both places. Defined in `lib/schemas/intake.ts` and imported by the form and the API route.
- **No keystroke validation.** Validate on blur for individual fields where it adds value (e.g., the 50-char minimum on project description), on submit for the form as a whole.
- **Premature validation feels nagging.** Default to letting users finish what they're doing.

---

## Accessibility and UX details

- All form controls have associated `<label>` elements with proper `htmlFor` linkage.
- Mutex tooltips are keyboard-accessible — they appear on focus, not just hover.
- Submit button shows a stage-aware loading state: *"Analyzing your background…"* for Stage 1, *"Planning your project…"* for Stage 2.
- On submit failure (network or 5xx), the form preserves all entered state and surfaces a retry affordance with the failure reason.
- The stack-preference toggle is implemented as a radio group under the hood for screen-reader clarity, styled as a segmented control visually.
- All required fields are marked with a visible asterisk and `aria-required="true"`.

---

## Copy principles

- **Second-person.** "You" and "your," not "the user."
- **Plain language over jargon.** "How many weeks do you have?" beats "Timeline (weeks)."
- **Errors as guidance, not blame.** "Pick at least 2 tools" — not "Field required."
- **Warm but efficient.** The form is a conversation, not a tax document. Keep it short and friendly.

---

## Anonymous user notes

Anonymous use is **Stage 1 only** — Stage 2 requires an account (D-029). For anonymous users:

- The Stage 1 form behaves identically. Submit fires against `/api/transitions/generate` and the resulting transition is saved with `anonymousSessionId`, not `userId`.
- A persistent banner on the result page reads: *"Save this analysis to your account — it's free and takes 10 seconds."* Click triggers the Clerk sign-up flow; on completion, the anonymous transition is claimed.
- The Stage 2 entry point shows a contextual sign-up prompt rather than a bare auth redirect. The reviewer "see the full flow" need is met by the sample-plan landing (stretch goal), not by opening Stage 2 to anonymous use.
