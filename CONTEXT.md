# Dev Stack Bridge Tool

The vocabulary the product, prompts, and database schema should use consistently.
Definitions only — no implementation details.

## Language

**Transition**:
A record of one user's move toward a target stack — holds their intake answers and the
generated bridge analysis. The central owned entity; belongs to either a User or an
[[anonymous session]].
_Avoid_: analysis (when you mean the whole record), session

**Bridge analysis**:
The generated content shown to the user for a Transition — the [[skill bridge]],
genuinely-new concepts, a timeline verdict, and project patterns. The user-facing name
for what a Transition contains.
_Avoid_: Stage 1 output (in anything user-facing)

**Project**:
The phased implementation plan generated from a Transition — phases, milestones, tasks,
and done criteria. At most one per Transition. Ownership is transitive through its
Transition; a Project has no owner of its own.
_Avoid_: plan (as the entity name — fine in user-facing copy)

**Skill bridge**:
The set of explicit mappings from a concept the user already knows to its counterpart in
the target stack. One section of the [[bridge analysis]].
_Avoid_: skill map, crosswalk

**Target stack**:
The 2–4 tools the user commits to learning, which the [[bridge analysis]] and [[Project]]
must build around (the "user_specified" path). Distinct from the stack the model proposes
when the user asks for a market recommendation instead.
_Avoid_: tech stack (ambiguous), tools

**Anonymous session**:
An unauthenticated visitor identified by a session id rather than an account. Can own
Transitions before signing up. There is no User entity behind it.
_Avoid_: anonymous user (no User row exists for it)

**Claim**:
Reassigning ownership of an [[anonymous session]]'s Transitions to a User on sign-up or
sign-in. An in-place change of owner, not a copy.
_Avoid_: migrate, transfer, import
