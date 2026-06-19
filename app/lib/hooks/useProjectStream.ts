"use client";

import { useReducer, useCallback } from "react";
import { parse } from "partial-json";
import {
  projectStreamReducer,
  initialProjectStreamState,
} from "@/app/lib/projectStreamState";
import type { ProjectOutput } from "@/app/lib/schemas/projectOutput";
import type { ProjectIntake } from "@/app/lib/schemas/intake";

export type { ProjectStreamState } from "@/app/lib/projectStreamState";

// Capped backoff for the confirm poll. The Project row is written in the
// generate stream's onFinish, which can land just after the client sees `done`,
// so we retry a not-yet-persisted row with a ~3s ceiling rather than dropping the
// user into a regenerate prompt for a plan that did in fact save (D-032).
const CONFIRM_BACKOFF_MS = [250, 500, 1000, 2000, 3000, 3000];

// A fork of useTransitionStream for Stage 2 (D-032), deliberately not generalized.
// Differences: it POSTs to the plan/generate route keyed by the known Transition
// id; navigation is to the known `/transitions/[id]/plan` (no id header to read);
// and a 409 ("plan already exists", D-034) is not an error — it invokes onExists
// so the caller can navigate straight to the plan the user already has.
export function useProjectStream(transitionId: string, onExists: () => void) {
  const [state, dispatch] = useReducer(
    projectStreamReducer,
    initialProjectStreamState
  );

  const start = useCallback(
    async (intake: ProjectIntake) => {
      dispatch({ type: "start" });

      try {
        const response = await fetch(
          `/api/transitions/${transitionId}/plan/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(intake),
          }
        );

        // 409 = a plan already exists for this Transition (D-034). Not an error:
        // send the user to it instead of surfacing a failure.
        if (response.status === 409) {
          onExists();
          return;
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          dispatch({ type: "error", message: err.message ?? "Generation failed." });
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

          // partial-json tolerates incomplete JSON — update parsed state on each
          // chunk so the UI can render sections as they arrive.
          try {
            const partial = parse(stripFence(accumulated)) as Partial<ProjectOutput>;
            dispatch({ type: "chunk", parsed: partial });
          } catch {
            // Ignore — chunk boundary fell in an unparseable position.
          }
        }

        // Stream is done, but the row may not be persisted yet. Move to
        // `confirming` and verify before the view affordance becomes available.
        dispatch({ type: "streamComplete" });

        const confirmed = await confirmPersisted(transitionId);
        if (confirmed) {
          dispatch({ type: "confirmed" });
        } else {
          dispatch({
            type: "confirmFailed",
            message:
              "We couldn't confirm your plan was saved. Your inputs are kept — try regenerating.",
          });
        }
      } catch (e) {
        dispatch({
          type: "error",
          message: e instanceof Error ? e.message : "Unexpected error.",
        });
      }
    },
    [transitionId, onExists]
  );

  return { state, start };
}

// Polls the plan endpoint until the row is owned-and-present (200) or the backoff
// budget is exhausted. A 404 means "not yet" (the persistence race) and is
// retried; a network blip is also retried.
async function confirmPersisted(transitionId: string): Promise<boolean> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`/api/transitions/${transitionId}/plan`, {
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
