# Database Schema

Postgres via Prisma ORM. JSON columns map to Postgres JSONB; UUID identifiers throughout.

**Source of truth for the schema itself is `prisma/schema.prisma`** — read it there, not here.
This doc holds the parts the schema file and migrations can't express: the shape of the
relationships, the queries the app actually runs, and what was deliberately left out. The
*why* behind the structure lives in `decisions-log.md` (D-013 normalization, D-016 raw
output capture, D-017 hard delete, D-018 drafts, D-022 UUID).

## Entity relationships

```
User (1) ──< (0..*) Transition (1) ──< (0..1) Project (1) ──< (3..5) Phase (1) ──< (1..*) Milestone (1) ──< (1..*) Task

Transition can also be owned by an anonymousSessionId instead of a userId.
MVP constraint: each Transition has at most one Project (1:1, enforced by @unique on Project.transitionId).
```

**Ownership invariant.** A `Transition` is owned by *either* `userId` OR `anonymousSessionId`,
never both, never neither — enforced by a database CHECK constraint added in
`prisma/migrations/20260521210846_check_user_xor/migration.sql`. Application bugs that try to
set both or neither fail loudly instead of leaving orphaned rows.

## Cascade behavior

Deleting a `User` cascades to their `Transition`s → `Project` → `Phase` → `Milestone` → `Task`.
Anonymous transitions follow the same chain via the daily cleanup cron.

A "delete account" is therefore a single Prisma call (`prisma.user.delete({ where: { id } })`) —
everything else falls with it. Worth verifying after the initial migration runs.

## Indexes

The schema indexes the queries the app actually runs:

- `transitions(userId, createdAt DESC)` — dashboard query: "this user's transitions, newest first."
- `transitions(anonymousSessionId)` — claim-on-signup query: "find anon transitions matching this cookie value."
- `phases(projectId, order)` — plan view: "all phases for this project, in order."
- `milestones(phaseId, order)` — plan view: "all milestones for this phase, in order."
- `tasks(milestoneId, order)` — plan view: "all tasks for this milestone, in order."

The compound `(parentId, order)` indexes also serve the unique constraint that prevents two
phases/milestones/tasks sharing the same sibling order. `User.email` gets a unique index
automatically via `@unique`.

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

**Persist a Stage 2 plan (single nested transactional create — all-or-nothing, see D-025):**

```ts
await prisma.project.create({
  data: {
    transitionId,
    projectDescription,
    specificRequirements,
    fitEvaluation, stackForProject, definitionOfDone, rawLlmOutput,
    phases: {
      create: phases.map((p) => ({
        order: p.order, name: p.name, weekRange: p.weekRange, goal: p.goal,
        learningCallouts: p.learningCallouts,
        milestones: {
          create: p.milestones.map((m) => ({
            order: m.order, title: m.title,
            tasks: { create: m.tasks.map((t) => ({ order: t.order, title: t.title, description: t.description })) },
          })),
        },
      })),
    },
  },
});
```

**Toggle a task** (ownership verified first by walking Task → Milestone → Phase → Project → Transition and checking `userId`):

```ts
await prisma.task.update({
  where: { id: taskId },
  data: { completed, completedAt: completed ? new Date() : null },
});
```

**Claim anonymous transitions on signup** (the CHECK constraint guarantees no row ends up with both columns set mid-operation):

```ts
await prisma.transition.updateMany({
  where: { anonymousSessionId: cookieValue },
  data: { userId: newUserId, anonymousSessionId: null },
});
```

**Cleanup anonymous transitions older than 30 days (cron):**

```ts
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await prisma.transition.deleteMany({
  where: { anonymousSessionId: { not: null }, createdAt: { lt: cutoff } },
});
```

## Migration workflow

- **`prisma migrate dev`** locally — generates a versioned migration, applies it, regenerates the client.
- **`prisma migrate deploy`** in CI/CD on every Vercel deploy — applies pending migrations to production.
- **Never edit a migration after it's applied to a shared environment.** Write a new one that corrects it.
- **Add raw SQL** (like the ownership CHECK constraint) by editing the generated migration *before* applying it.

## What's deliberately out of the schema

- **Saved drafts** of an in-progress intake form — form state lives in `localStorage` until submit (D-018).
- **A `schemaVersion` field** on LLM output JSON — useful if the output shape changes post-launch; deferred for MVP.
- **Soft deletes** — hard delete is fine at portfolio scale (D-017).
- **An `analytics_events` table** — Vercel Analytics covers the basic signals without instrumentation.
