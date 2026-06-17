import { describe, it, expect } from "vitest";
import {
  streamReducer,
  initialStreamState,
  shouldClearDraft,
  type StreamState,
} from "@/app/lib/streamState";

// Pure-logic seam (D-025): the Stage 1 stream lifecycle as input → output.
// No React, no I/O — just (state, event) → state.

const PARSED = { summary: { headline: "Hi", currentPosition: "a", destination: "b" } };

describe("streamReducer", () => {
  it("starts streaming from idle with an empty preview", () => {
    expect(streamReducer(initialStreamState, { type: "start" })).toEqual({
      status: "streaming",
      parsed: {},
    });
  });

  it("updates the preview on each chunk while streaming", () => {
    const streaming: StreamState = { status: "streaming", parsed: {} };
    expect(streamReducer(streaming, { type: "chunk", parsed: PARSED })).toEqual({
      status: "streaming",
      parsed: PARSED,
    });
  });

  it("moves streaming → confirming on streamComplete, carrying the preview", () => {
    const streaming: StreamState = { status: "streaming", parsed: PARSED };
    expect(
      streamReducer(streaming, { type: "streamComplete", transitionId: "t-1" })
    ).toEqual({ status: "confirming", transitionId: "t-1", parsed: PARSED });
  });

  it("moves confirming → ready on confirmed, keeping the id and preview", () => {
    const confirming: StreamState = {
      status: "confirming",
      transitionId: "t-1",
      parsed: PARSED,
    };
    expect(streamReducer(confirming, { type: "confirmed" })).toEqual({
      status: "ready",
      transitionId: "t-1",
      parsed: PARSED,
    });
  });

  it("moves confirming → failed when confirmation never persists", () => {
    const confirming: StreamState = {
      status: "confirming",
      transitionId: "t-1",
      parsed: PARSED,
    };
    expect(
      streamReducer(confirming, { type: "confirmFailed", message: "nope" })
    ).toEqual({ status: "failed", message: "nope", parsed: PARSED });
  });

  it("moves streaming → failed on a stream error, preserving any preview", () => {
    const streaming: StreamState = { status: "streaming", parsed: PARSED };
    expect(streamReducer(streaming, { type: "error", message: "boom" })).toEqual({
      status: "failed",
      message: "boom",
      parsed: PARSED,
    });
  });

  it("allows a regenerate: start from failed begins a fresh stream", () => {
    const failed: StreamState = { status: "failed", message: "boom", parsed: PARSED };
    expect(streamReducer(failed, { type: "start" })).toEqual({
      status: "streaming",
      parsed: {},
    });
  });

  it("ignores events that don't apply to the current state", () => {
    const streaming: StreamState = { status: "streaming", parsed: PARSED };
    // Can't confirm before the stream has completed.
    expect(streamReducer(streaming, { type: "confirmed" })).toBe(streaming);

    const ready: StreamState = { status: "ready", transitionId: "t-1", parsed: PARSED };
    // A late chunk after ready is a no-op.
    expect(streamReducer(ready, { type: "chunk", parsed: {} })).toBe(ready);
    // A late error after ready does not clobber a successful result.
    expect(streamReducer(ready, { type: "error", message: "late" })).toBe(ready);
  });
});

describe("shouldClearDraft", () => {
  it("clears the intake draft only once persistence is confirmed (ready)", () => {
    expect(shouldClearDraft({ status: "ready", transitionId: "t-1", parsed: {} })).toBe(true);
  });

  it("keeps the draft in every other state so a retry preserves answers", () => {
    const others: StreamState[] = [
      { status: "idle" },
      { status: "streaming", parsed: {} },
      { status: "confirming", transitionId: "t-1", parsed: {} },
      { status: "failed", message: "boom", parsed: {} },
    ];
    for (const state of others) {
      expect(shouldClearDraft(state)).toBe(false);
    }
  });
});
