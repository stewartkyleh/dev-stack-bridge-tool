import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/prismaSingleton";

// Reads the Project for a Transition. Doubles as the Stage 2 confirm-poll target
// (the client polls after the generate stream completes, until the row lands)
// and the plan page's read.
//
// Ownership is userId-only and transitive through the Transition (a Project has
// no owner of its own; D-034). As with the Stage 1 confirm route there is no
// separate auth gate: a non-owner, an unauthenticated caller, and a Project that
// hasn't been persisted yet all look identical — 404.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();

  const project = await db.project.findUnique({
    where: { transitionId: id },
    include: {
      transition: { select: { userId: true } },
      phases: {
        orderBy: { order: "asc" },
        include: {
          milestones: {
            orderBy: { order: "asc" },
            include: { tasks: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  const isOwner =
    project !== null && userId !== null && project.transition.userId === userId;

  if (!isOwner) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(project, { status: 200 });
}
