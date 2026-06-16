# Product Brief

## Concept

A web app that helps software developers transitioning between tech stacks understand what's transferable from their existing skills and produces a structured plan to build a portfolio project in the target stack. The product is LLM-driven: the user supplies their background, target stack, and capacity; the model generates personalized analysis and a phased implementation plan.

## Target user

Working software developers transitioning into a new domain — typically experienced engineers from adjacent fields (game dev, mobile, embedded, etc.) moving into full-stack web, AI/LLM engineering, or ML engineering. Users are actively job-hunting and need a structured, time-boxed way to ramp into a new stack without resorting to generic tutorials or roadmap PDFs.

## Why this exists

Generic learning resources don't account for what a user already knows. Asking an LLM directly works but produces unfocused output with hidden assumptions (it picks a stack for them, glosses over what transfers, suggests boring projects). This product wraps the LLM with structured intake, opinionated prompting, and a saveable plan — bridging the gap between "I should learn web dev" and "I'm shipping a portfolio project."

The product's unique value is in **mapping concepts between skill sets**, which is something LLMs are genuinely strong at. It is *not* an idea-generation tool: the user brings their own project, and the system evaluates it and structures the build plan.

## The two-stage flow

The product is deliberately split into two LLM-generated stages.

**Stage 1 — Bridge & Orient.** The user submits their current skills, target role, stack preferences (3–4 specific tools from job descriptions), timeline, and hours per week. The system returns a structured bridge analysis: concrete mappings between current and target stack concepts, the genuinely new territory ranked by importance, a realistic timeline with checkpoints, and four pattern categories of projects that would qualify them for their target role. Project patterns are framed as sparks for the user's own ideas, never prescriptions.

**Stage 2 — Scope & Plan.** The user brings their own project idea (free text) plus the Stage 1 context. The system evaluates fit (stack coverage, scope realism, hiring signal), then produces a phased implementation plan: foundation → core build → polish → ship. Each phase has milestones, right-sized tasks (1–4 hours), learning callouts that tie back to specific concepts from Stage 1, and explicit definition-of-done criteria.

The split is intentional. LLMs are strong at mapping concepts across skill sets (Stage 1's job). They're weak at generating personally compelling project ideas — the user is better positioned to bring those. Stage 2 evaluates and structures the user's idea rather than inventing one for them.

## MVP scope

The MVP must support:

- A six-field Stage 1 intake with category-based tool selection (mutex within categories, 4 tools max)
- A two-field Stage 2 intake (project description + optional requirements)
- Streaming LLM responses for both stages
- Per-user plan persistence with retrieval from a dashboard
- Auth via Clerk with at least one OAuth provider
- Anonymous generation supported before sign-up, claimed on account creation
- Checkbox completion on plan tasks, persisted across sessions
- A single Next.js app deployed to Vercel
- Postgres (Neon) database via Prisma ORM
- Anthropic API for LLM generation
- All secrets out of source control

## Out of scope for MVP

Deliberately deferred:

- Multi-user / team / collaborative plans
- Editing or regenerating individual sections of a saved plan (full regenerate only)
- Real-time updates or websockets
- Public shareable plan URLs
- Mobile native (responsive web only)
- Payment / paid tiers
- Multiple language support for plan output
- Tutorial-style learning plans (the product is portfolio-project-first by design)
- Multiple project ideas per transition in v1 (one project per transition)

## Success criteria

The MVP is "done" when:

- A user can sign in via Clerk and have their session persist
- An anonymous user can generate a Stage 1 analysis and claim it on sign-up
- A signed-in user can submit Stage 1 and receive a streamed bridge analysis
- The user can submit a project description and receive a streamed implementation plan
- Both outputs are persisted to Postgres and retrievable from a dashboard
- Plan tasks can be checked off and the completion state survives reload
- Ownership is enforced on every read and write
- The app is publicly deployed with all secrets in Vercel config, not source control
- The README explains every tool choice as a defensible architectural decision

## Hiring narrative

The project is self-referential: built by someone transitioning from C#/Unity to full-stack web, using the very tools and patterns the product recommends. This narrative is intentional and is a primary interview hook — the product's existence is itself evidence of competence with the target stack. The README and demo recording should lean into this framing rather than hide it.

## Non-goals (worth being explicit about)

- **This is not a course or curriculum.** It does not recommend tutorials, videos, or books by name. The model's training data is stale on those, and users will find their own.
- **This is not an idea generator.** The user brings the project. The system evaluates and plans it.
- **This is not a market-data tool.** Stack recommendations reflect general industry signals as of the prompt's curation date, not real-time job-board data.
- **This is not a one-size-fits-all roadmap.** Plans are tailored to the specific user; outputs vary meaningfully between users with different inputs.
