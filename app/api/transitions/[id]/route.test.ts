import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Route-handler seam: invoke the exported handler with a constructed request,
// mocking the external boundaries (Clerk auth, Prisma).
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/app/lib/prismaSingleton", () => ({
  db: { transition: { findUnique: vi.fn() } },
}));

import { GET } from "./route";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/app/lib/prismaSingleton";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(db.transition.findUnique);

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/transitions/t-1", { headers });
}

const params = Promise.resolve({ id: "t-1" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/transitions/[id] (confirm)", () => {
  it("returns 200 for the signed-in owner", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockFindUnique.mockResolvedValue({
      id: "t-1",
      userId: "user-1",
      anonymousSessionId: null,
    } as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "t-1", ready: true });
  });

  it("returns 200 for an anonymous-session owner (no signed-in user)", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    mockFindUnique.mockResolvedValue({
      id: "t-1",
      userId: null,
      anonymousSessionId: "sess-1",
    } as never);

    const res = await GET(request({ cookie: "anon_session=sess-1" }), { params });

    expect(res.status).toBe(200);
  });

  it("returns 404 to a non-owner (different signed-in user)", async () => {
    mockAuth.mockResolvedValue({ userId: "user-2" } as never);
    mockFindUnique.mockResolvedValue({
      id: "t-1",
      userId: "user-1",
      anonymousSessionId: null,
    } as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(404);
  });

  it("returns 404 to a non-owner anonymous session", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    mockFindUnique.mockResolvedValue({
      id: "t-1",
      userId: null,
      anonymousSessionId: "sess-1",
    } as never);

    const res = await GET(request({ cookie: "anon_session=other" }), { params });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the row is not yet persisted (the race the poll retries)", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockFindUnique.mockResolvedValue(null as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(404);
  });
});
