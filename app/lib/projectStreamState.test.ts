import { describe, it, expect } from "vitest";
import {
  projectStreamReducer,
  initialProjectStreamState,
  type ProjectStreamState,
} from "@/app/lib/projectStreamState";
import type { ProjectOutput } from "@/app/lib/schemas/projectOutput";

// Pure-logic seam (D-032): the Stage 2 plan stream lifecycle as input → output.
// A fork of the Stage 1 reducer typed to Partial<ProjectOutput>, but with no
// transitionId in state (navigation is keyed by the already-known Transition id)
// and no draft to clear (a single textarea, no localStorage).

// A live preview carries one fully-formed top-level section (Partial is shallow:
// a present key must match the schema's shape).
const PARSED: Partial<ProjectOutput> = {
  stackForProject: [
    { tool: "Next.js", source: "user_target", purpose: "App framework" },
  ],
};

describe("projectStreamReducer", () => {
  it("starts streaming from idle with an empty preview", () => {
    expect(
      projectStreamReducer(initialProjectStreamState, { type: "start" })
    ).toEqual({ status: "streaming", parsed: {} });
  });

  it("updates the preview on each chunk while streaming", () => {
    const streaming: ProjectStreamState = { status: "streaming", parsed: {} };
    expect(
      projectStreamReducer(streaming, { type: "chunk", parsed: PARSED })
    ).toEqual({ status: "streaming", parsed: PARSED });
  });

  it("moves streaming → confirming on streamComplete, carrying the preview", () => {
    const streaming: ProjectStreamState = { status: "streaming", parsed: PARSED };
    expect(
      projectStreamReducer(streaming, { type: "streamComplete" })
    ).toEqual({ status: "confirming", parsed: PARSED });
  });

  it("moves confirming → ready on confirmed, keeping the preview", () => {
    const confirming: ProjectStreamState = { status: "confirming", parsed: PARSED };
    expect(projectStreamReducer(confirming, { type: "confirmed" })).toEqual({
      status: "ready",
      parsed: PARSED,
    });
  });

  it("moves confirming → failed when confirmation never persists", () => {
    const confirming: ProjectStreamState = { status: "confirming", parsed: PARSED };
    expect(
      projectStreamReducer(confirming, { type: "confirmFailed", message: "nope" })
    ).toEqual({ status: "failed", message: "nope", parsed: PARSED });
  });

  it("moves streaming → failed on a stream error, preserving any preview", () => {
    const streaming: ProjectStreamState = { status: "streaming", parsed: PARSED };
    expect(
      projectStreamReducer(streaming, { type: "error", message: "boom" })
    ).toEqual({ status: "failed", message: "boom", parsed: PARSED });
  });

  it("allows a regenerate: start from failed begins a fresh stream", () => {
    const failed: ProjectStreamState = {
      status: "failed",
      message: "boom",
      parsed: PARSED,
    };
    expect(projectStreamReducer(failed, { type: "start" })).toEqual({
      status: "streaming",
      parsed: {},
    });
  });

  it("ignores events that don't apply to the current state", () => {
    const streaming: ProjectStreamState = { status: "streaming", parsed: PARSED };
    // Can't confirm before the stream has completed.
    expect(projectStreamReducer(streaming, { type: "confirmed" })).toBe(streaming);

    const ready: ProjectStreamState = { status: "ready", parsed: PARSED };
    // A late chunk after ready is a no-op.
    expect(projectStreamReducer(ready, { type: "chunk", parsed: {} })).toBe(ready);
    // A late error after ready does not clobber a successful result.
    expect(projectStreamReducer(ready, { type: "error", message: "late" })).toBe(ready);
    // streamComplete only fires from streaming.
    expect(projectStreamReducer(ready, { type: "streamComplete" })).toBe(ready);
  });
});
