"use client";

import { useReducer, useCallback } from "react";
import { parse } from "partial-json";
import {
  streamReducer,
  initialStreamState,
  type StreamState,
} from "@/app/lib/streamState";
import type { TransitionOutput } from "@/app/lib/schemas/transitionOutput";
import type { Stage1FormData } from "@/app/lib/schemas/intake";

export type { StreamState } from "@/app/lib/streamState";

// Capped backoff for the confirm poll. The Transition row is written in the
// stream's onFinish, which can land just after the client sees `done`, so we
// retry a not-yet-persisted row with a ~3s ceiling rather than 404-ing the user.
const CONFIRM_BACKOFF_MS = [250, 500, 1000, 2000, 3000, 3000];

export function useTransitionStream() {
  const [state, dispatch] = useReducer(streamReducer, initialStreamState);

  const start = useCallback(async (formData: Stage1FormData) => {
    dispatch({ type: "start" });

    try {
      const response = await fetch("/api/transitions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        dispatch({ type: "error", message: err.message ?? "Generation failed." });
        return;
      }

      const transitionId = response.headers.get("X-Transition-Id");
      if (!transitionId) {
        dispatch({ type: "error", message: "Server did not return a transition ID." });
        return;
      }

      if (!response.body) {
        dispatch({ type: "error", message: "No response stream." });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        // partial-json tolerates incomplete JSON — update parsed state
        // on each chunk so the UI can render sections as they arrive.
        try {
          const partial = parse(stripFence(accumulated)) as Partial<TransitionOutput>;
          dispatch({ type: "chunk", parsed: partial });
        } catch {
          // Ignore — chunk boundary fell in an unparseable position.
        }
      }

      // Stream is done, but the row may not be persisted yet. Move to
      // `confirming` and verify before any navigation becomes possible.
      dispatch({ type: "streamComplete", transitionId });

      const confirmed = await confirmPersisted(transitionId);
      if (confirmed) {
        dispatch({ type: "confirmed" });
      } else {
        dispatch({
          type: "confirmFailed",
          message: "We couldn't confirm your analysis was saved. Your answers are kept — try regenerating.",
        });
      }
    } catch (e) {
      dispatch({
        type: "error",
        message: e instanceof Error ? e.message : "Unexpected error.",
      });
    }
  }, []);

  return { state, start };
}

// Polls the confirm endpoint until the row is owned-and-present (200) or the
// backoff budget is exhausted. A 404 means "not yet" (the persistence race) and
// is retried; a network blip is also retried.
async function confirmPersisted(id: string): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/transitions/${id}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.ok) return true;
    } catch {
      // Network blip — fall through to backoff and retry.
    }

    const delay = CONFIRM_BACKOFF_MS[attempt];
    if (delay === undefined) return false;
    await sleep(delay);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
}
