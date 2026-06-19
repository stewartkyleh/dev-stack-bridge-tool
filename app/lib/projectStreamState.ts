import type { ProjectOutput } from "@/app/lib/schemas/projectOutput";

// The Stage 2 plan stream lifecycle as a pure reducer (D-032). A fork of the
// Stage 1 reducer — same shape, deliberately not shared — typed to
// `Partial<ProjectOutput>`.
//
//   idle → streaming → confirming → ready
//                  ↘ failed ↙
//
// Two differences from Stage 1: there is no `transitionId` in state (navigation
// is keyed by the already-known Transition id, so `streamComplete` carries no
// payload), and there is no draft to clear (a single textarea — no localStorage).
// The 409 "plan already exists" case is handled in the hook by navigating, not
// here, so it is not a reducer state. Kept free of React and I/O.

export type ProjectStreamState =
  | { status: "idle" }
  | { status: "streaming"; parsed: Partial<ProjectOutput> }
  | { status: "confirming"; parsed: Partial<ProjectOutput> }
  | { status: "ready"; parsed: Partial<ProjectOutput> }
  | { status: "failed"; message: string; parsed: Partial<ProjectOutput> };

export type ProjectStreamEvent =
  | { type: "start" }
  | { type: "chunk"; parsed: Partial<ProjectOutput> }
  // The stream reached `done`; the row may not be persisted yet. No id payload —
  // navigation is keyed by the already-known Transition id (D-032).
  | { type: "streamComplete" }
  // The confirm GET returned 200 — the row is persisted and owned by the caller.
  | { type: "confirmed" }
  // Confirmation never succeeded within the backoff budget.
  | { type: "confirmFailed"; message: string }
  // The stream itself failed (network, non-ok response, server error).
  | { type: "error"; message: string };

export const initialProjectStreamState: ProjectStreamState = { status: "idle" };

export function projectStreamReducer(
  state: ProjectStreamState,
  event: ProjectStreamEvent
): ProjectStreamState {
  switch (event.type) {
    case "start":
      return { status: "streaming", parsed: {} };

    case "chunk":
      if (state.status !== "streaming") return state;
      return { status: "streaming", parsed: event.parsed };

    case "streamComplete":
      if (state.status !== "streaming") return state;
      return { status: "confirming", parsed: state.parsed };

    case "confirmed":
      if (state.status !== "confirming") return state;
      return { status: "ready", parsed: state.parsed };

    case "confirmFailed":
      if (state.status !== "confirming") return state;
      return { status: "failed", message: event.message, parsed: state.parsed };

    case "error":
      // A stream-level failure can arrive while streaming or confirming. Keep
      // whatever preview we have so the user isn't dropped to a blank screen.
      if (state.status === "ready" || state.status === "failed") return state;
      return {
        status: "failed",
        message: event.message,
        parsed: "parsed" in state ? state.parsed : {},
      };

    default:
      return state;
  }
}
