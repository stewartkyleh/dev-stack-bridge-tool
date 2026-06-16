# Database Schema

Postgres via Prisma ORM. JSON columns mapped to Postgres JSONB. UUID identifiers throughout (see D-022 — overrides the original CUID decision in D-015).

## Storage philosophy

Two principles drive the table structure:

1. **Normalize what changes; JSON what doesn't.** Stage 1 outputs (bridge analysis, new concepts, project inspirations) are write-once, read-many — stored as JSON. Stage 2 outputs that the user interacts with (tasks, completion state) are normalized into rows because individual updates would otherwise require read-modify-write on a JSON blob.

2. **Capture raw LLM output for every generation.** Each row that came from a generation also stores the unparsed text. This costs ~50KB per row but lets you re-run the parser without re-paying for a new generation, and is invaluable for debugging prompt issues post-launch.

## Entity relationships

```
User (1) ──< (0..*) Transition (1) ──< (0..1) Project (1) ──< (3..5) Phase (1) ──< (1..*) Milestone (1) ──< (1..*) Task

Transition can also be owned by an anonymousSessionId instead of a userId.
MVP constraint: each Transition has at most one Project (1:1, enforced by @unique on Project.transitionId).
```

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

model User {
  id        String   @id              // Clerk user ID (no @default — set on webhook create)
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transitions Transition[]

  @@map("users")
}

model Transition {
  id String @id @default(uuid())

  // Ownership: exactly one of these is non-null (CHECK constraint in migration)
  userId             String?
  anonymousSessionId String?
  user               User?   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // ── User intake (Stage 1 form) ──────────────────────────────
  currentSkills      String[] // chips + free-text additions merged
  yearsExperience    String   // "0-1" | "2-4" | "5-9" | "10+"
  targetRole         String   // see intake-design.md for enum
  stackPreference    String   // "user_specified" | "market_recommended"
  targetStack        String[] // max 4, mutex-validated upstream
  timelineWeeks      Int      // 3 | 6 | 9 | 12
  hoursPerWeek       String   // "5-10" | "10-20" | "20+"

  // ── LLM output (display-only, JSONB) ────────────────────────
  summary             Json
  timeline            Json
  stackRecommendation Json
  skillBridge         Json
  newConcepts         Json
  projectInspirations Json
  rawLlmOutput        String  @db.Text

  // ── Derived plan ────────────────────────────────────────────
  project Project?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt(sort: Desc)])
  @@index([anonymousSessionId])
  @@map("transitions")
}

model Project {
  id           String     @id @default(uuid())
  transitionId String     @unique
  transition   Transition @relation(fields: [transitionId], references: [id], onDelete: Cascade)

  // ── User intake (Stage 2 form) ──────────────────────────────
  projectDescription   String  @db.Text
  specificRequirements String? @db.Text

  // ── LLM output (display-only, JSONB) ────────────────────────
  fitEvaluation    Json
  stackForProject  Json
  definitionOfDone Json
  rawLlmOutput     String  @db.Text

  // ── Normalized actionable content ───────────────────────────
  phases Phase[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("projects")
}

model Phase {
  id        String  @id @default(uuid())
  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  order            Int
  name             String
  weekRange        String   // e.g., "Week 1–3"
  goal             String   @db.Text
  learningCallouts String[]

  milestones Milestone[]

  createdAt DateTime @default(now())

  @@unique([projectId, order])
  @@index([projectId, order])
  @@map("phases")
}

model Milestone {
  id      String @id @default(uuid())
  phaseId String
  phase   Phase  @relation(fields: [phaseId], references: [id], onDelete: Cascade)

  order Int
  title String

  tasks Task[]

  createdAt DateTime @default(now())

  @@unique([phaseId, order])
  @@index([phaseId, order])
  @@map("milestones")
}

model Task {
  id          String    @id @default(uuid())
  milestoneId String
  milestone   Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)

  order       Int
  title       String
  description String?   @db.Text
  completed   Boolean   @default(false)
  completedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([milestoneId, order])
  @@index([milestoneId, order])
  @@map("tasks")
}
```

## Ownership CHECK constraint

Prisma doesn't express CHECK constraints in its schema DSL. Add it via raw SQL in the initial migration:

```sql
ALTER TABLE transitions
  ADD CONSTRAINT transitions_ownership_check
  CHECK (
    (user_id IS NOT NULL AND anonymous_session_id IS NULL) OR
    (user_id IS NULL AND anonymous_session_id IS NOT NULL)
  );
```

This makes "exactly one owner" a database-enforced invariant. Application bugs that try to set both or neither will fail loudly instead of leaving orphaned rows.

## Cascade behavior

Deleting a `User` cascades to their `Transition`s, which cascade to the `Project`, which cascades to `Phase` → `Milestone` → `Task`. Anonymous transitions follow the same chain via the daily cleanup cron.

This means a "delete account" operation is a single Prisma call (`prisma.user.delete({ where: { id } })`) — everything else falls with it. Worth verifying after the initial migration runs.

## Indexes

The schema indexes the queries the app actually runs:

- `transitions(userId, createdAt DESC)` — dashboard query: "this user's transitions, newest first."
- `transitions(anonymousSessionId)` — claim-on-signup query: "find anon transitions matching this cookie value."
- `phases(projectId, order)` — plan view: "all phases for this project, in order."
- `milestones(phaseId, order)` — plan view: "all milestones for this phase, in order."
- `tasks(milestoneId, order)` — plan view: "all tasks for this milestone, in order."

The compound `(parentId, order)` indexes also serve the unique constraint that prevents two phases/milestones/tasks sharing the same sibling order.

`User.email` gets a unique index automatically via `@unique`.

## Identifier strategy

UUID v4 (`@default(uuid())`) for all generated IDs (see D-022). UUID is the industry standard for distributed record IDs, needs no extra package (`crypto.randomUUID()` is native), and is the more recognizable format for a portfolio project demonstrating real-world patterns. An earlier draft of this schema used CUIDs (D-015) for their shorter, sortable format, but that was overridden before any migration shipped.

`User.id` is the exception — it's the Clerk-issued user ID, set explicitly on webhook creation, not generated.

## Example queries

**Dashboard list for signed-in user:**

```ts
const transitions = await prisma.transition.findMany({
  where: { userId: currentUser.id },
  orderBy: { createdAt: "desc" },
  include: { project: { select: { id: true } } }, // surface "has plan" without loading the plan
});
```

**Full plan view (phases → milestones → tasks, all ordered):**

```ts
const project = await prisma.project.findUnique({
  where: { id: projectId },
  include: {
    transition: true, // verify ownership against this
    phases: {
      orderBy: { order: "asc" },
      include: {
        milestones: {
          orderBy: { order: "asc" },
          include: {
            tasks: { orderBy: { order: "asc" } },
          },
        },
      },
    },
  },
});
```

**Toggle a task:**

```ts
await prisma.task.update({
  where: { id: taskId },
  data: { completed, completedAt: completed ? new Date() : null },
});
```

(Ownership verification happens before this call — fetch the task with its milestone → phase → project → transition chain and check `userId === session.userId`.)

**Claim anonymous transitions on signup:**

```ts
await prisma.transition.updateMany({
  where: { anonymousSessionId: cookieValue },
  data: { userId: newUserId, anonymousSessionId: null },
});
```

The CHECK constraint guarantees no row will end up with both columns populated mid-operation.

**Cleanup anonymous transitions older than 30 days (cron):**

```ts
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await prisma.transition.deleteMany({
  where: {
    anonymousSessionId: { not: null },
    createdAt: { lt: cutoff },
  },
});
```

## Migration strategy

- **`prisma migrate dev`** for local schema changes — generates a versioned migration file, applies it, and regenerates the Prisma client.
- **`prisma migrate deploy`** in CI/CD on every Vercel deploy — applies pending migrations to the production database.
- **Never edit a migration file after it's been applied to a shared environment.** Generate a new migration that corrects the prior one.
- **Add raw SQL** (like the CHECK constraint above) by editing the generated migration file *before* applying it — Prisma preserves manual additions on subsequent migrations.

## What's deliberately out of the schema

- **Saved drafts** of an in-progress intake form. Form state lives in `localStorage` until submit; not worth a `DraftTransition` table for MVP.
- **A `schemaVersion` field** on LLM output JSON. Useful if you iterate the LLM output shape post-launch and need to migrate existing rows. For MVP, the prompt schema is stable enough to defer.
- **Soft deletes.** Hard delete is fine for portfolio scale. If a user deletes a transition they want back, that's a future problem.
- **An `analytics_events` table.** Vercel Analytics covers the basic signals without instrumentation.
