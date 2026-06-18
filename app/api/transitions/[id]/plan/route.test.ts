import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Route-handler seam: invoke the exported handler with a constructed request,
// mocking the external boundaries (Clerk auth, Prisma).
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/app/lib/prismaSingleton", () => ({
  db: { project: { findUnique: vi.fn() } },
}));

import { GET } from "./route";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/app/lib/prismaSingleton";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(db.project.findUnique);

function request(): NextRequest {
  return new NextRequest("http://localhost/api/transitions/t-1/plan");
}

const params = Promise.resolve({ id: "t-1" });

// A Project owned (transitively) by the signed-in user. Ownership is via the
// Project's Transition — userId-only, no anonymous path (D-034 / issue #12).
const ownedProject = {
  id: "p-1",
  transitionId: "t-1",
  transition: { userId: "user-1" },
  phases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/transitions/[id]/plan", () => {
  it("returns 200 with the project for its owner", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockFindUnique.mockResolvedValue(ownedProject as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: "p-1" });
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transitionId: "t-1" } })
    );
  });

  it("returns 404 to a different signed-in user (non-owner)", async () => {
    mockAuth.mockResolvedValue({ userId: "user-2" } as never);
    mockFindUnique.mockResolvedValue(ownedProject as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(404);
  });

  it("returns 404 when no Project exists yet (the not-ready case the poll retries)", async () => {
    mockAuth.mockResolvedValue({ userId: "user-1" } as never);
    mockFindUnique.mockResolvedValue(null as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(404);
  });

  it("returns 404 to an unauthenticated caller", async () => {
    mockAuth.mockResolvedValue({ userId: null } as never);
    mockFindUnique.mockResolvedValue(ownedProject as never);

    const res = await GET(request(), { params });

    expect(res.status).toBe(404);
  });
});
