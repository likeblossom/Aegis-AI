import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  governanceReports,
  type GovernanceReport,
  type UseCase
} from "@/db/schema";
import {
  GOVERNANCE_PROMPT_VERSION,
  generateAzureGovernanceReport,
  getAzureGovernanceModel,
  isAzureGovernanceConfigured
} from "./azureGovernanceReport";
import { generateGovernanceReport } from "./generateGovernanceReport";
import {
  governanceReportSchema,
  type GovernanceReportObject
} from "./reportTypes";

export type GovernanceGenerationResult = {
  reportRecord: GovernanceReport;
  report: GovernanceReportObject;
  analysisMode: "azure" | "deterministic";
  fallbackReason: string | null;
  workflowRunId: string;
  workflowPath: string[];
};

const DETERMINISTIC_PROMPT_VERSION = "deterministic-governance-v1.0";

const GovernanceGenerationState = Annotation.Root({
  useCase: Annotation<UseCase>(),
  deterministicReport: Annotation<GovernanceReportObject | null>(),
  report: Annotation<GovernanceReportObject | null>(),
  analysisMode: Annotation<"azure" | "deterministic">(),
  fallbackReason: Annotation<string | null>(),
  promptVersion: Annotation<string>(),
  model: Annotation<string | null>(),
  reportVersion: Annotation<number | null>(),
  reportRecord: Annotation<GovernanceReport | null>(),
  workflowRunId: Annotation<string>(),
  workflowPath: Annotation<string[]>({
    reducer: (current, update) => current.concat(update),
    default: () => []
  })
});

async function runDeterministicAnalysis(
  state: typeof GovernanceGenerationState.State
) {
  const deterministicReport = generateGovernanceReport(state.useCase);

  return {
    deterministicReport,
    report: deterministicReport,
    analysisMode: "deterministic" as const,
    fallbackReason: null,
    promptVersion: DETERMINISTIC_PROMPT_VERSION,
    model: null,
    workflowPath: ["deterministic_analysis"]
  };
}

function routeAfterDeterministicAnalysis() {
  return isAzureGovernanceConfigured() ? "azure_analysis" : "validate_report";
}

async function runAzureAnalysis(state: typeof GovernanceGenerationState.State) {
  if (!state.deterministicReport) {
    return {
      workflowPath: ["azure_analysis_skipped"]
    };
  }

  try {
    const report = await generateAzureGovernanceReport({
      useCase: state.useCase,
      deterministicReport: state.deterministicReport
    });

    return {
      report,
      analysisMode: "azure" as const,
      fallbackReason: null,
      promptVersion: GOVERNANCE_PROMPT_VERSION,
      model: getAzureGovernanceModel(),
      workflowPath: ["azure_analysis"]
    };
  } catch (error) {
    return {
      fallbackReason:
        error instanceof Error ? error.message : "Azure AI generation failed.",
      workflowPath: ["azure_analysis_failed"]
    };
  }
}

async function validateReport(state: typeof GovernanceGenerationState.State) {
  if (!state.report) {
    throw new Error("Governance workflow did not produce a report.");
  }

  return {
    report: governanceReportSchema.parse(state.report),
    workflowPath: ["validate_report"]
  };
}

async function persistReport(state: typeof GovernanceGenerationState.State) {
  if (!state.report) {
    throw new Error("Cannot persist a missing governance report.");
  }

  const reportVersion =
    db
      .select()
      .from(governanceReports)
      .where(eq(governanceReports.useCaseId, state.useCase.id))
      .all().length + 1;

  const reportRecord = db
    .insert(governanceReports)
    .values({
      useCaseId: state.useCase.id,
      reportJson: JSON.stringify(state.report),
      riskLevel: state.report.riskLevel,
      aiReadinessScore: state.report.aiReadinessScore,
      finalRecommendation: state.report.finalRecommendation,
      confidenceLevel: state.report.confidenceLevel,
      promptVersion: state.promptVersion,
      generationProvider: state.analysisMode,
      model: state.model,
      reportVersion
    })
    .returning()
    .get();

  db.insert(auditLogs)
    .values({
      useCaseId: state.useCase.id,
      action: "REPORT_GENERATED",
      note: buildAuditNote({
        analysisMode: state.analysisMode,
        reportVersion,
        riskLevel: state.report.riskLevel,
        fallbackReason: state.fallbackReason,
        workflowRunId: state.workflowRunId
      })
    })
    .run();

  return {
    reportVersion,
    reportRecord,
    workflowPath: ["persist_report"]
  };
}

function buildAuditNote({
  analysisMode,
  reportVersion,
  riskLevel,
  fallbackReason,
  workflowRunId
}: {
  analysisMode: "azure" | "deterministic";
  reportVersion: number;
  riskLevel: string;
  fallbackReason: string | null;
  workflowRunId: string;
}) {
  const prefix = `[workflow ${workflowRunId}] `;

  if (analysisMode === "azure") {
    return `${prefix}Azure AI governance report v${reportVersion} generated with ${riskLevel} risk.`;
  }

  if (fallbackReason) {
    return `${prefix}Deterministic fallback governance report v${reportVersion} generated with ${riskLevel} risk. Azure AI generation was unavailable.`;
  }

  return `${prefix}Deterministic governance report v${reportVersion} generated with ${riskLevel} risk.`;
}

const governanceGenerationGraph = new StateGraph(GovernanceGenerationState)
  .addNode("deterministic_analysis", runDeterministicAnalysis)
  .addNode("azure_analysis", runAzureAnalysis)
  .addNode("validate_report", validateReport)
  .addNode("persist_report", persistReport)
  .addEdge(START, "deterministic_analysis")
  .addConditionalEdges("deterministic_analysis", routeAfterDeterministicAnalysis)
  .addEdge("azure_analysis", "validate_report")
  .addEdge("validate_report", "persist_report")
  .addEdge("persist_report", END)
  .compile();

export async function generateGovernanceReportWithWorkflow(
  useCase: UseCase
): Promise<GovernanceGenerationResult> {
  const result = await governanceGenerationGraph.invoke({
    useCase,
    deterministicReport: null,
    report: null,
    analysisMode: "deterministic",
    fallbackReason: null,
    promptVersion: DETERMINISTIC_PROMPT_VERSION,
    model: null,
    reportVersion: null,
    reportRecord: null,
    workflowRunId: crypto.randomUUID(),
    workflowPath: []
  });

  if (!result.report || !result.reportRecord) {
    throw new Error("Governance workflow finished without a persisted report.");
  }

  return {
    reportRecord: result.reportRecord,
    report: result.report,
    analysisMode: result.analysisMode,
    fallbackReason: result.fallbackReason,
    workflowRunId: result.workflowRunId,
    workflowPath: result.workflowPath
  };
}
