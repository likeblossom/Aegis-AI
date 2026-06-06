import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, reviewerNotes } from "@/db/schema";
import { buildReviewNoteUpdatedAuditNote } from "@/lib/audit-log-formatter";
import { reviewerNoteUpdateSchema } from "@/lib/validations";
import { validateReviewerAccessCode } from "@/server/reviewerAuth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; noteId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id, noteId } = await context.params;
  const numericId = Number(id);
  const numericNoteId = Number(noteId);

  if (!Number.isInteger(numericId) || !Number.isInteger(numericNoteId)) {
    return NextResponse.json({ error: "Invalid reviewer note id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = reviewerNoteUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reviewer note update", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const authResult = validateReviewerAccessCode(parsed.data.reviewerAccessCode);

  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const existing = db
    .select()
    .from(reviewerNotes)
    .where(
      and(
        eq(reviewerNotes.id, numericNoteId),
        eq(reviewerNotes.useCaseId, numericId)
      )
    )
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Reviewer note not found" }, { status: 404 });
  }

  const updated = db
    .update(reviewerNotes)
    .set({
      note: parsed.data.note,
      reviewerName: parsed.data.reviewerName,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(reviewerNotes.id, numericNoteId))
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: numericId,
      action: "REVIEW_NOTE_UPDATED",
      note: buildReviewNoteUpdatedAuditNote(parsed.data.note)
    })
    .run();

  return NextResponse.json(updated);
}
