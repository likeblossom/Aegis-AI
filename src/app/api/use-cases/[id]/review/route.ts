import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, governanceReports, reviewerNotes, useCases } from "@/db/schema";
import {
  buildReviewNoteAddedAuditNote,
  buildReviewStatusUpdatedAuditNote
} from "@/lib/audit-log-formatter";
import { reviewUpdateSchema } from "@/lib/validations";
import { validateReviewWorkflow } from "@/server/governance/workflowControls";

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
  const parsed = reviewUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review update", issues: parsed.error.flatten() },
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

  const latestReport = db
    .select()
    .from(governanceReports)
    .where(eq(governanceReports.useCaseId, numericId))
    .orderBy(desc(governanceReports.createdAt))
    .get();

  const workflowError = validateReviewWorkflow({
    status: parsed.data.status,
    note: parsed.data.note,
    hasReport: Boolean(latestReport)
  });

  if (workflowError) {
    return NextResponse.json(
      { error: workflowError },
      { status: workflowError.includes("approval") ? 409 : 400 }
    );
  }

  const updated = db
    .update(useCases)
    .set({
      status: parsed.data.status,
      updatedAt: sql`CURRENT_TIMESTAMP`
    })
    .where(eq(useCases.id, numericId))
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: numericId,
      action: "REVIEW_STATUS_UPDATED",
      note: buildReviewStatusUpdatedAuditNote({
        previousStatus: proposal.status,
        newStatus: parsed.data.status
      })
    })
    .run();

  if (parsed.data.note.length > 0) {
    db.insert(reviewerNotes)
      .values({
        useCaseId: numericId,
        status: parsed.data.status,
        note: parsed.data.note,
        reviewerName: parsed.data.reviewerName || "Governance reviewer"
      })
      .run();

    db.insert(auditLogs)
      .values({
        useCaseId: numericId,
        action: "REVIEW_NOTE_ADDED",
        note: buildReviewNoteAddedAuditNote(parsed.data.note)
      })
      .run();
  }

  return NextResponse.json(updated);
}
