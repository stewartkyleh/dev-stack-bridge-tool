import type { TransitionOutput } from "@/app/lib/schemas/transitionOutput";

// The Stage 1 stream lifecycle as a pure reducer (D-025). Generation streams a
// preview, then the client *confirms* the Transition row was persisted before
// any navigation is possible — closing the 404 race where the redirect could
// land on a not-yet-written row.
//
//   idle → streaming → confirming → ready
//                  ↘ failed ↙
//
// Kept free of React and I/O so it can be unit-tested as input → output.

export type StreamState =
  | { status: "idle" }
  | { status: "streaming"; parsed: Partial<TransitionOutput> }
  | { status: "confirming"; transitionId: string; parsed: Partial<TransitionOutput> }
  | { status: "ready"; transitionId: string; parsed: Partial<TransitionOutput> }
  | { status: "failed"; message: string; parsed: Partial<TransitionOutput> };

export type StreamEvent =
  // Submit pressed (or a regenerate from a failed run): begin a fresh stream.
  | { type: "start" }
  // A stream chunk parsed into a partial output, for the live preview.
  | { type: "chunk"; parsed: Partial<TransitionOutput> }
  // The stream reached `done`; the row may not be persisted yet.
  | { type: "streamComplete"; transitionId: string }
  // The confirm GET returned 200 — the row is persisted and owned by the caller.
  | { type: "confirmed" }
  // Confirmation never succeeded within the backoff budget.
  | { type: "confirmFailed"; message: string }
  // The stream itself failed (network, missing id, server error).
  | { type: "error"; message: string };

export const initialStreamState: StreamState = { status: "idle" };

export function streamReducer(state: StreamState, event: StreamEvent): StreamState {
  switch (event.type) {
    case "start":
      // Allowed from any state, including a retry from `failed`.
      return { status: "streaming", parsed: {} };

    case "chunk":
      if (state.status !== "streaming") return state;
      return { status: "streaming", parsed: event.parsed };

    case "streamComplete":
      if (state.status !== "streaming") return state;
      return {
        status: "confirming",
        transitionId: event.transitionId,
        parsed: state.parsed,
      };

    case "confirmed":
      if (state.status !== "confirming") return state;
      return {
        status: "ready",
        transitionId: state.transitionId,
        parsed: state.parsed,
      };

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

// The intake draft in localStorage is cleared only once persistence is
// confirmed — so a failed generation preserves the user's answers for a retry.
export function shouldClearDraft(state: StreamState): boolean {
  return state.status === "ready";
}
