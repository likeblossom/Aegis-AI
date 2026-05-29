import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, useCases } from "@/db/schema";
import { reviewStatusSchema } from "@/lib/validations";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid use case id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewStatusSchema.safeParse(body?.status);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review status" }, { status: 400 });
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
      status: parsed.data,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(useCases.id, numericId))
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: numericId,
      action: "REVIEW_STATUS_UPDATED",
      note: `Review status updated from ${proposal.status} to ${parsed.data}.`
    })
    .run();

  return NextResponse.json(updated);
}
