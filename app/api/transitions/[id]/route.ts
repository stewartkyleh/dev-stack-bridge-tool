import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/prismaSingleton";

// Lightweight confirm endpoint for the Stage 1 stream's confirm-then-advance
// step (D-025). The client polls this after the stream completes to verify the
// Transition row has actually been persisted before navigation is possible.
//
// Stage 1 is anonymous, so ownership is authorised by `userId` OR the
// `anon_session` cookie. A non-owner — and a row that isn't written yet —
// receives 404. There is no blanket auth gate: an anonymous owner can confirm
// their own Transition, and everyone else looks identical to "not found".
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  const anonSessionId =
    req.cookies.get("anon_session")?.value ??
    req.headers.get("x-anon-session") ??
    null;

  const transition = await db.transition.findUnique({
    where: { id },
    select: { id: true, userId: true, anonymousSessionId: true },
  });

  const isOwner =
    transition !== null &&
    ((userId !== null && transition.userId === userId) ||
      (anonSessionId !== null &&
        transition.anonymousSessionId === anonSessionId));

  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ id: transition.id, ready: true }, { status: 200 });
}
