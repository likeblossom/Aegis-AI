import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, useCases } from "@/db/schema";
import { assignmentUpdateSchema } from "@/lib/validations";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid use case id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignmentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reviewer assignment", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const proposal = db
    .select()
    .from(useCases)
    .where(eq(useCases.id, numericId))
    .get();

  if (!proposal) {
    return NextResponse.json({ error: "Use case not found" }, { status: 404 });
  }

  const updated = db
    .update(useCases)
    .set({
      assignedReviewer: parsed.data.assignedReviewer,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(useCases.id, numericId))
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: numericId,
      action: "REVIEWER_ASSIGNED",
      note: `Assigned reviewer changed from ${proposal.assignedReviewer} to ${parsed.data.assignedReviewer}.`
    })
    .run();

  return NextResponse.json(updated);
}
