import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, governanceReports, useCases } from "@/db/schema";
import { generateGovernanceReport } from "@/server/governance/generateGovernanceReport";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
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

  const report = generateGovernanceReport(proposal);
  const created = db
    .insert(governanceReports)
    .values({
      useCaseId: proposal.id,
      reportJson: JSON.stringify(report),
      riskLevel: report.riskLevel,
      aiReadinessScore: report.aiReadinessScore,
      finalRecommendation: report.finalRecommendation,
      confidenceLevel: report.confidenceLevel
    })
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: proposal.id,
      action: "REPORT_GENERATED",
      note: `Deterministic governance report generated with ${report.riskLevel} risk.`
    })
    .run();

  return NextResponse.json({ reportRecord: created, report }, { status: 201 });
}
