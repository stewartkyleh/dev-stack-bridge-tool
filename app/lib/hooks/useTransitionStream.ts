"use client";

import { useState, useCallback } from "react";
import { parse } from "partial-json";
import type { TransitionOutput } from "@/app/lib/schemas/transitionOutput";
import type { Stage1FormData } from "@/app/lib/schemas/intake";

export type StreamState =
  | { status: "idle" }
  | { status: "streaming"; parsed: Partial<TransitionOutput> }
  | { status: "complete"; transitionId: string }
  | { status: "error"; message: string };

export function useTransitionStream() {
  const [state, setState] = useState<StreamState>({ status: "idle" });

  const start = useCallback(async (formData: Stage1FormData) => {
    setState({ status: "streaming", parsed: {} });

    try {
      const response = await fetch("/api/transitions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setState({ status: "error", message: err.message ?? "Generation failed." });
        return;
      }

      const transitionId = response.headers.get("X-Transition-Id");
      if (!transitionId) {
        setState({ status: "error", message: "Server did not return a transition ID." });
        return;
      }

      if (!response.body) {
        setState({ status: "error", message: "No response stream." });
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
          setState({ status: "streaming", parsed: partial });
        } catch {
          // Ignore — chunk boundary fell in an unparseable position.
        }
      }

      setState({ status: "complete", transitionId });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Unexpected error.",
      });
    }
  }, []);

  return { state, start };
}

function stripFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
}