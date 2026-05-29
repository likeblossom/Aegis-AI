import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, governanceReports, useCases } from "@/db/schema";
import {
  generateAzureGovernanceReport,
  isAzureGovernanceConfigured
} from "@/server/governance/azureGovernanceReport";
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

  const deterministicReport = generateGovernanceReport(proposal);
  let report = deterministicReport;
  let analysisMode: "azure" | "deterministic" = "deterministic";
  let fallbackReason: string | null = null;

  if (isAzureGovernanceConfigured()) {
    try {
      report = await generateAzureGovernanceReport({
        useCase: proposal,
        deterministicReport
      });
      analysisMode = "azure";
    } catch (error) {
      fallbackReason =
        error instanceof Error ? error.message : "Azure AI generation failed.";
    }
  }

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
      note:
        analysisMode === "azure"
          ? `Azure AI governance report generated with ${report.riskLevel} risk.`
          : fallbackReason
            ? `Deterministic fallback governance report generated with ${report.riskLevel} risk. Azure AI generation was unavailable.`
            : `Deterministic governance report generated with ${report.riskLevel} risk.`
    })
    .run();

  return NextResponse.json(
    { reportRecord: created, report, analysisMode, fallbackReason },
    { status: 201 }
  );
}
