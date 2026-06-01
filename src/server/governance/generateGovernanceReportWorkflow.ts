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
  getAzureApiVersion,
  getAzureDiagnosticsContext,
  getAzureGovernanceModel,
  isAzureGovernanceConfigured
} from "./azureGovernanceReport";
import {
  classifyAzureError,
  getErrorMessage,
  getErrorStatus,
  sanitizeAzureDiagnosticMessage,
  type GenerationFailureReason
} from "./classifyAzureError";
import {
  generateGovernanceReport,
  LOCAL_FALLBACK_PROMPT_VERSION
} from "./generateGovernanceReport";
import {
  generateGovernanceSignals,
  type GovernanceSignals
} from "./generateGovernanceSignals";
import {
  governanceReportSchema,
  type GovernanceReportObject
} from "./reportTypes";
import {
  buildAssessmentBreakdownGeneratedAuditNote,
  buildAzureReportGeneratedAuditNote,
  buildFallbackReportGeneratedAuditNote
} from "@/lib/audit-log-formatter";

export type GovernanceGenerationResult = {
  reportRecord: GovernanceReport;
  report: GovernanceReportObject;
  analysisMode: "AZURE_OPENAI" | "LOCAL_FALLBACK";
  fallbackReason: GenerationFailureReason | null;
  workflowRunId: string;
  workflowPath: string[];
};

const GovernanceGenerationState = Annotation.Root({
  useCase: Annotation<UseCase>(),
  signals: Annotation<GovernanceSignals | null>(),
  report: Annotation<GovernanceReportObject | null>(),
  analysisMode: Annotation<"AZURE_OPENAI" | "LOCAL_FALLBACK">(),
  fallbackReason: Annotation<GenerationFailureReason | null>(),
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
  const signals = generateGovernanceSignals(state.useCase);

  return {
    signals,
    report: null,
    analysisMode: "LOCAL_FALLBACK" as const,
    fallbackReason: isAzureGovernanceConfigured() ? null : "AZURE_NOT_CONFIGURED",
    promptVersion: LOCAL_FALLBACK_PROMPT_VERSION,
    model: null,
    workflowPath: ["deterministic_analysis"]
  };
}

function routeAfterDeterministicAnalysis() {
  return isAzureGovernanceConfigured() ? "azure_analysis" : "local_fallback";
}

async function runAzureAnalysis(state: typeof GovernanceGenerationState.State) {
  if (!state.signals) {
    return {
      workflowPath: ["azure_analysis_skipped"]
    };
  }

  try {
    const report = await generateAzureGovernanceReport({
      useCase: state.useCase,
      signals: state.signals
    });

    return {
      report,
      analysisMode: "AZURE_OPENAI" as const,
      fallbackReason: null,
      promptVersion: GOVERNANCE_PROMPT_VERSION,
      model: getAzureGovernanceModel(),
      workflowPath: ["azure_analysis"]
    };
  } catch (error) {
    const failureReason = classifyAzureError(error);
    logAzureFallbackDiagnostic({
      error,
      failureReason,
      generationMode: "AZURE_OPENAI"
    });

    const report = withGenerationMetadata({
      report: generateGovernanceReport(state.useCase, state.signals),
      analysisMode: "LOCAL_FALLBACK",
      fallbackReason: failureReason
    });

    return {
      report,
      analysisMode: "LOCAL_FALLBACK" as const,
      fallbackReason: failureReason,
      promptVersion: LOCAL_FALLBACK_PROMPT_VERSION,
      model: null,
      workflowPath: ["azure_analysis_failed"]
    };
  }
}

async function runLocalFallback(state: typeof GovernanceGenerationState.State) {
  if (!state.signals) {
    throw new Error("Cannot generate local fallback without governance signals.");
  }

  return {
    report: withGenerationMetadata({
      report: generateGovernanceReport(state.useCase, state.signals),
      analysisMode: "LOCAL_FALLBACK",
      fallbackReason: state.fallbackReason ?? "AZURE_NOT_CONFIGURED"
    }),
    analysisMode: "LOCAL_FALLBACK" as const,
    fallbackReason: state.fallbackReason ?? "AZURE_NOT_CONFIGURED",
    promptVersion: LOCAL_FALLBACK_PROMPT_VERSION,
    model: null,
    workflowPath: ["local_fallback"]
  };
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
      action:
        state.analysisMode === "AZURE_OPENAI"
          ? "REPORT_GENERATED_AZURE"
          : "REPORT_GENERATED_FALLBACK",
      note:
        state.analysisMode === "AZURE_OPENAI"
          ? buildAzureReportGeneratedAuditNote()
          : buildFallbackReportGeneratedAuditNote(
              state.fallbackReason ?? "AZURE_UNKNOWN_ERROR"
            )
    })
    .run();

  db.insert(auditLogs)
    .values({
      useCaseId: state.useCase.id,
      action: "ASSESSMENT_BREAKDOWN_GENERATED",
      note: buildAssessmentBreakdownGeneratedAuditNote()
    })
    .run();

  return {
    reportVersion,
    reportRecord,
    workflowPath: ["persist_report"]
  };
}

const governanceGenerationGraph = new StateGraph(GovernanceGenerationState)
  .addNode("deterministic_analysis", runDeterministicAnalysis)
  .addNode("azure_analysis", runAzureAnalysis)
  .addNode("local_fallback", runLocalFallback)
  .addNode("validate_report", validateReport)
  .addNode("persist_report", persistReport)
  .addEdge(START, "deterministic_analysis")
  .addConditionalEdges("deterministic_analysis", routeAfterDeterministicAnalysis)
  .addEdge("azure_analysis", "validate_report")
  .addEdge("local_fallback", "validate_report")
  .addEdge("validate_report", "persist_report")
  .addEdge("persist_report", END)
  .compile();

function withGenerationMetadata({
  report,
  analysisMode,
  fallbackReason
}: {
  report: GovernanceReportObject;
  analysisMode: "AZURE_OPENAI" | "LOCAL_FALLBACK";
  fallbackReason: GenerationFailureReason | null;
}): GovernanceReportObject {
  if (analysisMode === "AZURE_OPENAI") {
    return {
      ...report,
      generationMetadata: {
        ...report.generationMetadata,
        generationMode: "AZURE_OPENAI",
        fallbackUsed: false,
        azureDeployment: getAzureGovernanceModel(),
        apiVersion: getAzureApiVersion(),
        modelDeployment: getAzureGovernanceModel(),
        promptVersion: GOVERNANCE_PROMPT_VERSION
      }
    };
  }

  return {
    ...report,
    generationMetadata: {
      ...report.generationMetadata,
      generationMode: "LOCAL_FALLBACK",
      fallbackUsed: true,
      failureReason: fallbackReason ?? "AZURE_UNKNOWN_ERROR",
      azureDeployment: isAzureGovernanceConfigured()
        ? getAzureGovernanceModel()
        : undefined,
      apiVersion: isAzureGovernanceConfigured() ? getAzureApiVersion() : undefined,
      promptVersion: LOCAL_FALLBACK_PROMPT_VERSION
    }
  };
}

function logAzureFallbackDiagnostic({
  error,
  failureReason,
  generationMode
}: {
  error: unknown;
  failureReason: GenerationFailureReason;
  generationMode: "AZURE_OPENAI" | "LOCAL_FALLBACK";
}) {
  const context = getAzureDiagnosticsContext();

  console.error("Azure governance generation failed; using local fallback.", {
    failureReason,
    errorName: getErrorName(error),
    errorMessage: truncateDiagnosticMessage(getErrorMessage(error)),
    httpStatus: getErrorStatus(error) ?? null,
    azureDeployment: context.deployment,
    azureApiVersion: context.apiVersion,
    endpointHost: context.endpointHost,
    azureEnvPresent: context.env,
    generationMode
  });
}

function getErrorName(error: unknown) {
  if (error instanceof Error) {
    return error.name;
  }

  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === "string" ? name : "UnknownError";
  }

  return "UnknownError";
}

function truncateDiagnosticMessage(message: string) {
  const sanitized = sanitizeAzureDiagnosticMessage(message);
  return sanitized.length > 500 ? `${sanitized.slice(0, 500)}...` : sanitized;
}

export async function generateGovernanceReportWithWorkflow(
  useCase: UseCase
): Promise<GovernanceGenerationResult> {
  const result = await governanceGenerationGraph.invoke({
    useCase,
    signals: null,
    report: null,
    analysisMode: "LOCAL_FALLBACK",
    fallbackReason: null,
    promptVersion: LOCAL_FALLBACK_PROMPT_VERSION,
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
