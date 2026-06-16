# Claim anonymous Transitions via a post-auth redirect, not the Clerk webhook

Anonymous visitors own Transitions through an `anonymousSessionId` carried in an httpOnly
cookie. When they create an account, those Transitions are reassigned to the new User
("claimed"). We do this from an authenticated, browser-originated request — Clerk redirects
to a claim route after sign-up *and* sign-in — rather than from the `user.created` webhook.

The webhook is a server-to-server call from Clerk and never sees the visitor's cookie, so
it cannot know which anonymous session to claim; it also only fires on sign-up, missing
returning users who sign in to an existing account. The claim route reads `auth()` plus the
cookie, ensures the User row exists (so it does not depend on webhook timing), runs the
reassignment, and clears the cookie. The webhook is retained solely for Svix-verified User
provisioning.

## Considered options

- **Claim in the `user.created` webhook** — rejected: the cookie isn't on a server-to-server
  request, and it misses the sign-in path entirely.
- **Pass the session id through Clerk `unsafeMetadata`** — rejected: client-settable, so a
  user could set another session's id and claim Transitions that aren't theirs.

## Consequences

- Claim is an in-place `UPDATE` (set `userId`, null `anonymousSessionId`). No anonymous User
  entity exists, so nothing is orphaned or needs deleting afterward. Project rows carry no
  ownership columns, so there is nothing to reassign on them.
- User provisioning now has two idempotent paths (the webhook and the claim route's
  ensure-user). Both upsert by Clerk user id, so this is belt-and-suspenders, not a conflict.
- Transitions from anonymous sessions that never sign up are removed by the daily cleanup
  cron (30-day TTL), not by the claim path.
