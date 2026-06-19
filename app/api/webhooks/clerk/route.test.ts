import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Route-handler seam (docs/testing.md): construct a Request, invoke the
// exported handler, mock the external boundaries at the module level. A bad
// Svix signature makes verifyWebhook throw.
vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook: vi.fn() }));
vi.mock("@/app/lib/prismaSingleton", () => ({
  db: { user: { upsert: vi.fn() } },
}));

import { POST } from "./route";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

const mockVerify = vi.mocked(verifyWebhook);

function post(): NextRequest {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "user.created" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/webhooks/clerk", () => {
  it("returns 401 when the Svix signature fails verification", async () => {
    mockVerify.mockRejectedValue(new Error("Invalid Svix signature"));

    const res = await POST(post());

    expect(res.status).toBe(401);
  });
});
