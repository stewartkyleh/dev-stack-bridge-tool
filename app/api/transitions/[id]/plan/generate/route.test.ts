import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { userRatelimit } from "@/app/lib/ratelimit";
import { db } from "@/app/lib/prismaSingleton";

// Route-handler seam (docs/testing.md): construct a Request, invoke the exported
// handler, mock the four external boundaries at the module level.
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("ai", () => ({ streamText: vi.fn() }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn(() => "model") }));
vi.mock("@/app/lib/ratelimit", () => ({
  ratelimit: { limit: vi.fn() },
  userRatelimit: { limit: vi.fn() },
}));
vi.mock("@/app/lib/prismaSingleton", () => ({
  db: {
    transition: { findUnique: vi.fn() },
    project: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

import { POST } from "./route";

const mockAuth = vi.mocked(auth);
const mockStreamText = vi.mocked(streamText);
const mockUserLimit = vi.mocked(userRatelimit.limit);
const mockTransitionFind = vi.mocked(db.transition.findUnique);
const mockProjectFind = vi.mocked(db.project.findUnique);

type LimitResult = Awaited<ReturnType<typeof userRatelimit.limit>>;
const limit = (success: boolean): LimitResult => ({
  success,
  limit: 20,
  remaining: success ? 19 : 0,
  reset: Date.now() + 1000,
  pending: Promise.resolve(),
});

const params = Promise.resolve({ id: "t-1" });

// The Stage 1 output columns the route reads back to build `bridgeAnalysis`.
const ownedTransition = {
  userId: "user-1",
  summary: { headline: "h" },
  timeline: { verdict: "realistic" },
  stackRecommendation: { stack: ["Next.js"] },
  skillBridge: [{ category: "State" }],
  newConcepts: [{ concept: "HTTP" }],
  projectInspirations: [{ pattern: "p" }],
};

const validIntake = {
  projectDescription:
    "A meal-planning app that suggests recipes from what is in my fridge.",
  specificRequirements: "Must use Postgres.",
};

function post(body?: unknown) {
  return new NextRequest("http://localhost/api/transitions/t-1/plan/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function mockStream() {
  mockStreamText.mockReturnValue({
    toTextStreamResponse: () =>
      new Response("stream", {
        headers: new Headers({ "content-type": "text/plain; charset=utf-8" }),
      }),
  } as unknown as ReturnType<typeof streamText>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/transitions/[id]/plan/generate — happy path", () => {
  it("returns 200 and the stream for the owner under cap with no existing plan", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockTransitionFind.mockResolvedValue(ownedTransition as never);
    mockUserLimit.mockResolvedValue(limit(true));
    mockProjectFind.mockResolvedValue(null as never);
    mockStream();

    const res = await POST(post(validIntake), { params });

    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    // Per-user cap is keyed by user id (D-031).
    expect(mockUserLimit).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/transitions/[id]/plan/generate — guards (no token spend)", () => {
  it("returns 404 when the Transition is owned by a different user", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockTransitionFind.mockResolvedValue({ ...ownedTransition, userId: "user-2" } as never);

    const res = await POST(post(validIntake), { params });

    expect(res.status).toBe(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 404 when the Transition does not exist", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockTransitionFind.mockResolvedValue(null as never);

    const res = await POST(post(validIntake), { params });

    expect(res.status).toBe(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 429 when the owner is over the per-user daily cap", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockTransitionFind.mockResolvedValue(ownedTransition as never);
    mockUserLimit.mockResolvedValue(limit(false));

    const res = await POST(post(validIntake), { params });

    expect(res.status).toBe(429);
    expect(mockUserLimit).toHaveBeenCalledWith("user-1");
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns 409 when a Project already exists, before calling Claude", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockTransitionFind.mockResolvedValue(ownedTransition as never);
    mockUserLimit.mockResolvedValue(limit(true));
    mockProjectFind.mockResolvedValue({ id: "p-1" } as never);

    const res = await POST(post(validIntake), { params });

    expect(res.status).toBe(409);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("does not consume a rate-limit slot when a Project already exists", async () => {
    // Re-POSTing to an already-planned transition is a permanent no-op; it must
    // not erode the user's daily cap. The 409 guard runs before the limiter.
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockTransitionFind.mockResolvedValue(ownedTransition as never);
    mockUserLimit.mockResolvedValue(limit(true));
    mockProjectFind.mockResolvedValue({ id: "p-1" } as never);

    const res = await POST(post(validIntake), { params });

    expect(res.status).toBe(409);
    expect(mockUserLimit).not.toHaveBeenCalled();
  });
});

// A complete Stage 2 output (post-D-033: no order/completed). Two phases to
// exercise the nested persistence.
const validOutput = {
  fitEvaluation: {
    stackCoverage: { verdict: "high", reasoning: "x", missingTools: [] },
    scope: { verdict: "realistic", reasoning: "x", recommendations: [] },
    hiringSignal: { verdict: "strong", reasoning: "x" },
  },
  stackForProject: [{ tool: "Next.js", source: "user_target", purpose: "App" }],
  phases: [
    {
      name: "Foundation",
      weekRange: "Week 1–2",
      goal: "Set up",
      milestones: [
        { title: "Scaffold", tasks: [{ title: "Init", description: "d" }] },
      ],
      learningCallouts: ["Server Components — first encountered in this phase."],
    },
  ],
  definitionOfDone: { mustHave: ["Deployed"], stretchIfTimePermits: [] },
};

// Pull the onFinish callback the route handed to streamText, after a 200 run.
async function runAndGetOnFinish() {
  mockAuth.mockResolvedValue({ userId: "user-1" } as never);
  mockTransitionFind.mockResolvedValue(ownedTransition as never);
  mockUserLimit.mockResolvedValue(limit(true));
  mockProjectFind.mockResolvedValue(null as never);
  mockStream();
  await POST(post(validIntake), { params });
  const call = mockStreamText.mock.calls[0][0] as unknown as {
    onFinish: (e: { text: string; finishReason: string }) => Promise<void>;
  };
  return call.onFinish;
}

describe("POST /api/transitions/[id]/plan/generate — onFinish persistence", () => {
  it("persists the full plan tree from a valid stream, with the raw output", async () => {
    const onFinish = await runAndGetOnFinish();
    const raw = "```json\n" + JSON.stringify(validOutput) + "\n```";

    await onFinish({ text: raw, finishReason: "stop" });

    expect(db.project.create).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(db.project.create).mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      transitionId: "t-1",
      projectDescription: validIntake.projectDescription,
      rawLlmOutput: raw,
    });
    // The nested tree is present and order is derived (D-033).
    const phases = (arg.data.phases as { create: { order: number }[] }).create;
    expect(phases[0].order).toBe(1);
  });

  it("persists nothing when the stream is not valid JSON", async () => {
    const onFinish = await runAndGetOnFinish();

    await onFinish({ text: "Sorry, I cannot do that.", finishReason: "stop" });

    expect(db.project.create).not.toHaveBeenCalled();
  });

  it("persists nothing when the JSON fails schema validation", async () => {
    const onFinish = await runAndGetOnFinish();
    const broken = { ...validOutput, definitionOfDone: undefined };

    await onFinish({ text: JSON.stringify(broken), finishReason: "stop" });

    expect(db.project.create).not.toHaveBeenCalled();
  });
});
