import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, governanceReports, useCases } from "@/db/schema";
import {
  GOVERNANCE_PROMPT_VERSION,
  generateAzureGovernanceReport,
  getAzureGovernanceModel,
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
  let promptVersion = "deterministic-governance-v1.0";
  let model: string | null = null;

  if (isAzureGovernanceConfigured()) {
    try {
      report = await generateAzureGovernanceReport({
        useCase: proposal,
        deterministicReport
      });
      analysisMode = "azure";
      promptVersion = GOVERNANCE_PROMPT_VERSION;
      model = getAzureGovernanceModel();
    } catch (error) {
      fallbackReason =
        error instanceof Error ? error.message : "Azure AI generation failed.";
    }
  }

  const reportVersion =
    db
      .select()
      .from(governanceReports)
      .where(eq(governanceReports.useCaseId, proposal.id))
      .all().length + 1;

  const created = db
    .insert(governanceReports)
    .values({
      useCaseId: proposal.id,
      reportJson: JSON.stringify(report),
      riskLevel: report.riskLevel,
      aiReadinessScore: report.aiReadinessScore,
      finalRecommendation: report.finalRecommendation,
      confidenceLevel: report.confidenceLevel,
      promptVersion,
      generationProvider: analysisMode,
      model,
      reportVersion
    })
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: proposal.id,
      action: "REPORT_GENERATED",
      note:
        analysisMode === "azure"
          ? `Azure AI governance report v${reportVersion} generated with ${report.riskLevel} risk.`
          : fallbackReason
            ? `Deterministic fallback governance report v${reportVersion} generated with ${report.riskLevel} risk. Azure AI generation was unavailable.`
            : `Deterministic governance report v${reportVersion} generated with ${report.riskLevel} risk.`
    })
    .run();

  return NextResponse.json(
    { reportRecord: created, report, analysisMode, fallbackReason },
    { status: 201 }
  );
}
