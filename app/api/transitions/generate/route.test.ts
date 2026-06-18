import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { ratelimit, userRatelimit } from "@/app/lib/ratelimit";

// Route-handler seam (docs/testing.md): construct a Request, invoke the
// exported handler, mock the four external boundaries at the module level.
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("ai", () => ({ streamText: vi.fn() }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn(() => "model") }));
vi.mock("@/app/lib/ratelimit", () => ({
  ratelimit: { limit: vi.fn() },
  userRatelimit: { limit: vi.fn() },
}));
vi.mock("@/app/lib/prismaSingleton", () => ({
  db: { transition: { create: vi.fn() } },
}));

import { POST } from "@/app/api/transitions/generate/route";

type LimitResult = Awaited<ReturnType<typeof ratelimit.limit>>;
const limit = (success: boolean): LimitResult => ({
  success,
  limit: 20,
  remaining: success ? 19 : 0,
  reset: Date.now() + 1000,
  pending: Promise.resolve(),
});

function post(headers: Record<string, string> = {}, body?: unknown) {
  return new NextRequest("http://localhost/api/transitions/generate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// A payload that satisfies stage1FormSchema (market_recommended avoids the
// conditional targetStack requirement).
const validForm = {
  currentSkills: ["JavaScript"],
  yearsExperience: "2-4",
  targetRole: "Backend",
  stackPreference: "market_recommended",
  timelineWeeks: "6",
  hoursPerWeek: "10-20",
};

function mockStream() {
  vi.mocked(streamText).mockReturnValue({
    toTextStreamResponse: () =>
      new Response("stream", {
        headers: new Headers({ "content-type": "text/plain; charset=utf-8" }),
      }),
  } as unknown as ReturnType<typeof streamText>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/transitions/generate — rate limiting", () => {
  it("returns 429 when a signed-in user is over the per-user daily cap", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_123" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(userRatelimit.limit).mockResolvedValue(limit(false));

    const res = await POST(post());

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limit" });
    // Keyed by user id, and the expensive stream is never started.
    expect(userRatelimit.limit).toHaveBeenCalledWith("user_123");
    expect(streamText).not.toHaveBeenCalled();
  });

  it("lets a signed-in user under the cap through, keyed by user id", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_456" } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(userRatelimit.limit).mockResolvedValue(limit(true));
    mockStream();

    const res = await POST(post({}, validForm));

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Transition-Id")).toBeTruthy();
    expect(userRatelimit.limit).toHaveBeenCalledWith("user_456");
    // The anonymous per-IP limiter must not be consulted for a signed-in user.
    expect(ratelimit.limit).not.toHaveBeenCalled();
  });

  it("returns 429 when an anonymous session is over the per-IP cap", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<
      ReturnType<typeof auth>
    >);
    vi.mocked(ratelimit.limit).mockResolvedValue(limit(false));

    const res = await POST(
      post({ "x-anon-session": "anon_abc", "x-forwarded-for": "9.9.9.9" })
    );

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limit" });
    // Keyed by IP, and the per-user limiter is not consulted for an anon session.
    expect(ratelimit.limit).toHaveBeenCalledWith("9.9.9.9");
    expect(userRatelimit.limit).not.toHaveBeenCalled();
    expect(streamText).not.toHaveBeenCalled();
  });
});
