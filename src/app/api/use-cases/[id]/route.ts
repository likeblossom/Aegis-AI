import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, governanceReports, reviewerNotes, useCases } from "@/db/schema";
import { parseGovernanceReportJson } from "@/server/governance/reportTypes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid use case id" }, { status: 400 });
  }

  const proposal = db
    .select()
    .from(useCases)
    .where(eq(useCases.id, numericId))
    .get();

  if (!proposal) {
    return NextResponse.json({ error: "Use case not found" }, { status: 404 });
  }

  const logs = db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.useCaseId, numericId))
    .all();

  const reportRecord = db
    .select()
    .from(governanceReports)
    .where(eq(governanceReports.useCaseId, numericId))
    .orderBy(desc(governanceReports.createdAt))
    .get();

  const notes = db
    .select()
    .from(reviewerNotes)
    .where(eq(reviewerNotes.useCaseId, numericId))
    .orderBy(asc(reviewerNotes.createdAt))
    .all();

  return NextResponse.json({
    proposal,
    auditLogs: logs,
    reviewerNotes: notes,
    governanceReport: reportRecord
      ? {
          ...reportRecord,
          report: parseGovernanceReportJson(reportRecord.reportJson)
        }
      : null
  });
}
