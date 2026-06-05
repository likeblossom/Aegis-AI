import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  governanceReports,
  type GovernanceReport,
  type UseCase,
  useCases
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
  type GovernanceAgentFinding,
  type GovernanceReportObject
} from "./reportTypes";
import {
  buildAssessmentBreakdownGeneratedAuditNote,
  buildAzureReportGeneratedAuditNote,
  buildFallbackReportGeneratedAuditNote
} from "@/lib/audit-log-formatter";
import { formatEnumLabel } from "@/lib/constants";

export type GovernanceGenerationResult = {
  reportRecord: GovernanceReport;
  report: GovernanceReportObject;
  analysisMode: "AZURE_OPENAI" | "LOCAL_FALLBACK";
  fallbackReason: GenerationFailureReason | null;
  workflowRunId: string;
  workflowPath: string[];
};

type ReviewIntensity = "STANDARD" | "ELEVATED" | "CRITICAL";

type RoutingDecision = {
  from: string;
  to: string;
  reason: string;
};

const GovernanceGenerationState = Annotation.Root({
  useCase: Annotation<UseCase>(),
  signals: Annotation<GovernanceSignals | null>(),
  report: Annotation<GovernanceReportObject | null>(),
  reviewIntensity: Annotation<ReviewIntensity | null>(),
  reviewerNodesExecuted: Annotation<string[]>({
    reducer: (current, update) => current.concat(update),
    default: () => []
  }),
  routingDecisions: Annotation<RoutingDecision[]>({
    reducer: (current, update) => current.concat(update),
    default: () => []
  }),
  agentFindings: Annotation<GovernanceAgentFinding[]>({
    reducer: (current, update) => current.concat(update),
    default: () => []
  }),
  humanReviewRequired: Annotation<boolean>(),
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

async function riskTriage(state: typeof GovernanceGenerationState.State) {
  if (!state.signals) {
    throw new Error("Cannot triage governance workflow without signals.");
  }

  const reviewIntensity = classifyReviewIntensity(state);
  const humanReviewRequired =
    reviewIntensity !== "STANDARD" ||
    state.signals.finalRecommendation !== "APPROVED";
  const routingDecisions = buildRoutingDecisions(state, reviewIntensity);

  return {
    reviewIntensity,
    humanReviewRequired,
    routingDecisions,
    agentFindings: [
      {
        agent: "risk_triage",
        riskLevel: state.signals.riskLevel,
        summary: buildRiskTriageSummary(state, reviewIntensity),
        findings: [
          `The proposal is routed as ${reviewIntensity.toLowerCase()} because ${describeRiskDrivers(
            state
          )}.`,
          `The deterministic engine produced a ${state.signals.riskLevel.toLowerCase()} risk level, ${state.signals.aiReadinessScore}/100 readiness score, and ${state.signals.finalRecommendation.toLowerCase().replaceAll("_", " ")} recommendation.`,
          state.signals.guardrailWarnings.length > 0
            ? `Guardrail warnings: ${state.signals.guardrailWarnings.join(" ")}`
            : "No deterministic guardrail warnings were triggered beyond baseline review controls."
        ],
        evidence: [
          `Proposed solution: ${truncateEvidence(
            state.useCase.proposedSolution
          )}`,
          `Data sensitivity: ${state.useCase.dataSensitivity}; decision impact: ${state.useCase.decisionImpact}; human oversight: ${state.useCase.humanOversightPlanned}.`,
          `Red flags: ${
            state.signals.deterministicRedFlags
              .map((flag) => `${flag.issue} (${flag.severity})`)
              .join(", ") || "none"
          }.`
        ],
        recommendedControls:
          reviewIntensity === "STANDARD"
            ? ["Keep documented human review for pilot outputs."]
            : [
                "Require named governance owner before rollout.",
                "Document escalation criteria before approval."
              ],
        controlRationale:
          reviewIntensity === "STANDARD"
            ? "The proposal can stay on the standard path only if accountability remains explicit during the pilot."
            : "The proposal has elevated governance drivers, so the reviewer needs clear ownership and escalation criteria before approving operational use.",
        confidence: state.signals.confidenceLevel
      }
    ],
    reviewerNodesExecuted: ["risk_triage"],
    workflowPath: ["risk_triage"]
  };
}

function routeAfterRiskTriage(state: typeof GovernanceGenerationState.State) {
  if (shouldRunDataPrivacyReviewer(state)) {
    return "data_privacy_reviewer";
  }

  return routeToNextCouncilNode(state);
}

async function dataPrivacyReviewer(
  state: typeof GovernanceGenerationState.State
) {
  const riskLevel = ["SENSITIVE", "CONFIDENTIAL"].includes(
    state.useCase.dataSensitivity
  )
    ? "HIGH"
    : "MEDIUM";

  return {
    agentFindings: [
      {
        agent: "data_privacy_reviewer",
        riskLevel,
        summary: `${formatEnumLabel(
          state.useCase.dataSensitivity
        )} data makes privacy, access, and retention decisions material to approval.`,
        findings: [
          `The proposal uses ${state.useCase.dataSensitivity.toLowerCase()} data in a ${state.useCase.decisionImpact.toLowerCase()}-impact workflow, so access boundaries need to be explicit before pilot use.`,
          extractSourceFinding(state.useCase.currentProcess),
          "The reviewer should confirm whether generated outputs can expose confidential context, operational records, or individual-level information."
        ],
        evidence: [
          `Current process: ${truncateEvidence(state.useCase.currentProcess)}`,
          `Affected stakeholders: ${truncateEvidence(
            state.useCase.affectedStakeholders
          )}`,
          `Implementation timeline: ${state.useCase.implementationTimeline}.`
        ],
        recommendedControls: [
          "Inventory approved data sources and exclude unapproved records from pilot use.",
          "Define access, retention, and audit logging requirements before deployment.",
          "Document what proposal data may be included in prompts, outputs, demos, and reviewer notes."
        ],
        controlRationale:
          "These controls make the privacy boundary reviewable instead of relying on broad claims that data handling will be managed later.",
        confidence: riskLevel === "HIGH" ? "HIGH" : "MEDIUM"
      }
    ],
    reviewerNodesExecuted: ["data_privacy_reviewer"],
    workflowPath: ["data_privacy_reviewer"]
  };
}

function routeAfterDataPrivacyReviewer(
  state: typeof GovernanceGenerationState.State
) {
  return routeToNextCouncilNode(state);
}

async function humanOversightReviewer(
  state: typeof GovernanceGenerationState.State
) {
  const requiresStrongerOversight =
    state.useCase.humanOversightPlanned !== "YES" ||
    state.useCase.decisionImpact === "HIGH";

  return {
    agentFindings: [
      {
        agent: "human_oversight_reviewer",
        riskLevel: requiresStrongerOversight ? "HIGH" : "MEDIUM",
        summary: buildOversightSummary(state, requiresStrongerOversight),
        findings: [
          `Human oversight is marked ${state.useCase.humanOversightPlanned.toLowerCase()} while decision impact is ${state.useCase.decisionImpact.toLowerCase()}.`,
          `The proposed workflow ${describeAutomationPressure(
            state.useCase.proposedSolution
          )}.`,
          "Reviewer accountability, override authority, and appeal paths must remain outside model control."
        ],
        evidence: [
          `Proposed solution: ${truncateEvidence(
            state.useCase.proposedSolution
          )}`,
          `Expected benefit: ${truncateEvidence(state.useCase.expectedBenefit)}`,
          `Human oversight planned: ${state.useCase.humanOversightPlanned}.`
        ],
        recommendedControls: [
          "Name the accountable reviewer role for every AI-assisted decision.",
          "Define override, escalation, and appeal procedures before approval.",
          "Require reviewers to record when they accept, modify, or reject AI-generated recommendations."
        ],
        controlRationale:
          "The control set prevents AI output from becoming an undocumented decision authority and gives reviewers an auditable override path.",
        confidence: requiresStrongerOversight ? "HIGH" : "MEDIUM"
      }
    ],
    reviewerNodesExecuted: ["human_oversight_reviewer"],
    workflowPath: ["human_oversight_reviewer"]
  };
}

function routeAfterHumanOversightReviewer(
  state: typeof GovernanceGenerationState.State
) {
  return shouldRunChangeManagementReviewer(state)
    ? "change_management_reviewer"
    : "portfolio_prioritizer";
}

async function changeManagementReviewer(
  state: typeof GovernanceGenerationState.State
) {
  const affectedStakeholderCount = state.useCase.affectedStakeholders
    .split(/,|and/i)
    .map((item) => item.trim())
    .filter(Boolean).length;

  return {
    agentFindings: [
      {
        agent: "change_management_reviewer",
        riskLevel:
          affectedStakeholderCount > 2 || state.reviewIntensity === "CRITICAL"
            ? "HIGH"
            : "MEDIUM",
        summary: `${state.useCase.department} should treat this as a workflow-change initiative, not only a model deployment.`,
        findings: [
          `The proposal names ${affectedStakeholderCount} stakeholder group${affectedStakeholderCount === 1 ? "" : "s"}: ${state.useCase.affectedStakeholders}.`,
          `The expected benefit is "${state.useCase.expectedBenefit}", so adoption metrics should verify whether the operating change actually delivers that value.`,
          `The ${state.useCase.implementationTimeline} timeline needs time for training, feedback collection, and governance checkpointing.`
        ],
        evidence: [
          `Affected stakeholders: ${truncateEvidence(
            state.useCase.affectedStakeholders
          )}`,
          `Expected benefit: ${truncateEvidence(state.useCase.expectedBenefit)}`,
          `Timeline: ${state.useCase.implementationTimeline}.`
        ],
        recommendedControls: [
          "Run a limited pilot with named business owners and adoption metrics.",
          "Publish training, communication, and feedback channels before expansion.",
          "Schedule a governance checkpoint before expanding beyond the initial stakeholder group."
        ],
        controlRationale:
          "The proposal's value depends on changed team behavior, so rollout controls need to measure adoption, trust, and exception handling.",
        confidence: affectedStakeholderCount > 2 ? "HIGH" : "MEDIUM"
      }
    ],
    reviewerNodesExecuted: ["change_management_reviewer"],
    workflowPath: ["change_management_reviewer"]
  };
}

async function portfolioPrioritizer(state: typeof GovernanceGenerationState.State) {
  const sameDepartmentCount = db
    .select()
    .from(governanceReports)
    .innerJoin(useCases, eq(governanceReports.useCaseId, useCases.id))
    .where(eq(useCases.department, state.useCase.department))
    .all().length;

  return {
    agentFindings: [
      {
        agent: "portfolio_prioritizer",
        riskLevel:
          state.reviewIntensity === "STANDARD" &&
          state.useCase.decisionImpact === "LOW"
            ? "LOW"
            : "MEDIUM",
        summary: buildPortfolioSummary(state, sameDepartmentCount),
        findings: [
          sameDepartmentCount > 0
            ? `${state.useCase.department} already has ${sameDepartmentCount} governance report pattern${sameDepartmentCount === 1 ? "" : "s"} to compare against.`
            : `${state.useCase.department} has no prior governance report pattern in the current portfolio.`,
          `This proposal combines ${state.useCase.dataSensitivity.toLowerCase()} data, ${state.useCase.decisionImpact.toLowerCase()} decision impact, and ${state.useCase.implementationTimeline} implementation timing.`,
          state.signals
            ? `Portfolio score inputs include ${state.signals.aiReadinessScore}/100 readiness and ${state.signals.riskLevel.toLowerCase()} governance risk.`
            : "Portfolio score inputs were not available."
        ],
        evidence: [
          `Department: ${state.useCase.department}`,
          `Expected benefit: ${truncateEvidence(state.useCase.expectedBenefit)}`,
          `Current process: ${truncateEvidence(state.useCase.currentProcess)}`
        ],
        recommendedControls: [
          "Compare required controls with similar portfolio proposals before implementation.",
          "Sequence rollout against reviewer capacity and governance bottlenecks.",
          "Reuse control templates from comparable proposals when the data class, decision impact, and oversight model match."
        ],
        controlRationale:
          "Portfolio review should identify reusable controls and avoid approving isolated pilots that create duplicate governance work.",
        confidence: sameDepartmentCount > 0 ? "HIGH" : "MEDIUM"
      }
    ],
    reviewerNodesExecuted: ["portfolio_prioritizer"],
    workflowPath: ["portfolio_prioritizer"]
  };
}

function routeAfterCouncilReview() {
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

async function synthesizeCouncilFindings(
  state: typeof GovernanceGenerationState.State
) {
  if (!state.report) {
    throw new Error("Cannot synthesize council findings without a report.");
  }

  const agentControls = state.agentFindings.flatMap(
    (finding) => finding.recommendedControls
  );
  const agentRationale = state.agentFindings.map((finding) => ({
    finding: `${formatAgentName(finding.agent)} finding`,
    whyItMatters: `${finding.summary} ${finding.controlRationale}`,
    evidenceFromProposal:
      finding.evidence.length > 0
        ? finding.evidence.join(" ")
        : `Council node ${finding.agent} reviewed proposal ${state.useCase.id}.`,
    recommendedAction:
      finding.recommendedControls[0] ??
      "Document reviewer rationale before final approval."
  }));

  return {
    report: {
      ...state.report,
      requiredControls: uniqueStrings([
        ...state.report.requiredControls,
        ...agentControls
      ]),
      analysisRationale: [
        ...state.report.analysisRationale,
        ...agentRationale
      ],
      workflowTrace: {
        runId: state.workflowRunId,
        path: [
          ...state.workflowPath,
          "synthesis",
          "validate_report",
          "persist_report"
        ],
        reviewerNodesExecuted: state.reviewerNodesExecuted,
        routingDecisions: state.routingDecisions,
        agentFindings: state.agentFindings,
        humanReviewRequired: state.humanReviewRequired
      }
    },
    workflowPath: ["synthesis"]
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
  .addNode("risk_triage", riskTriage)
  .addNode("data_privacy_reviewer", dataPrivacyReviewer)
  .addNode("human_oversight_reviewer", humanOversightReviewer)
  .addNode("change_management_reviewer", changeManagementReviewer)
  .addNode("portfolio_prioritizer", portfolioPrioritizer)
  .addNode("azure_analysis", runAzureAnalysis)
  .addNode("local_fallback", runLocalFallback)
  .addNode("synthesis", synthesizeCouncilFindings)
  .addNode("validate_report", validateReport)
  .addNode("persist_report", persistReport)
  .addEdge(START, "deterministic_analysis")
  .addEdge("deterministic_analysis", "risk_triage")
  .addConditionalEdges("risk_triage", routeAfterRiskTriage)
  .addConditionalEdges(
    "data_privacy_reviewer",
    routeAfterDataPrivacyReviewer
  )
  .addConditionalEdges(
    "human_oversight_reviewer",
    routeAfterHumanOversightReviewer
  )
  .addEdge("change_management_reviewer", "portfolio_prioritizer")
  .addConditionalEdges("portfolio_prioritizer", routeAfterCouncilReview)
  .addEdge("azure_analysis", "synthesis")
  .addEdge("local_fallback", "synthesis")
  .addEdge("synthesis", "validate_report")
  .addEdge("validate_report", "persist_report")
  .addEdge("persist_report", END)
  .compile();

function buildRiskTriageSummary(
  state: typeof GovernanceGenerationState.State,
  reviewIntensity: ReviewIntensity
) {
  if (!state.signals) {
    return "Risk triage could not access deterministic governance signals.";
  }

  return `${state.useCase.title} is a ${reviewIntensity.toLowerCase()} review because it combines ${formatEnumLabel(
    state.useCase.dataSensitivity
  ).toLowerCase()} data, ${formatEnumLabel(
    state.useCase.decisionImpact
  ).toLowerCase()} decision impact, ${formatEnumLabel(
    state.useCase.humanOversightPlanned
  ).toLowerCase()} human oversight, and a ${state.signals.riskLevel.toLowerCase()} deterministic risk result.`;
}

function describeRiskDrivers(state: typeof GovernanceGenerationState.State) {
  const drivers = [
    `${formatEnumLabel(state.useCase.dataSensitivity).toLowerCase()} data`,
    `${formatEnumLabel(state.useCase.decisionImpact).toLowerCase()} decision impact`,
    `${formatEnumLabel(
      state.useCase.humanOversightPlanned
    ).toLowerCase()} human oversight`
  ];

  if (isHrWorkflow(state.useCase)) {
    drivers.push("employment or HR-related workflow language");
  }

  if (state.signals?.deterministicRedFlags.length) {
    drivers.push(
      `${state.signals.deterministicRedFlags.length} deterministic red flag${
        state.signals.deterministicRedFlags.length === 1 ? "" : "s"
      }`
    );
  }

  return drivers.join(", ");
}

function extractSourceFinding(currentProcess: string) {
  if (/\b(document|record|ticket|system|database|source|faq|transcript)\b/i.test(currentProcess)) {
    return "The current process references identifiable records or knowledge sources, so the reviewer can require an approved-source inventory.";
  }

  return "The current process does not clearly identify source systems or records, so data provenance needs validation before pilot use.";
}

function buildOversightSummary(
  state: typeof GovernanceGenerationState.State,
  requiresStrongerOversight: boolean
) {
  if (requiresStrongerOversight) {
    return `${state.useCase.title} needs stronger human accountability because the proposal combines ${formatEnumLabel(
      state.useCase.decisionImpact
    ).toLowerCase()} decision impact with ${formatEnumLabel(
      state.useCase.humanOversightPlanned
    ).toLowerCase()} planned oversight.`;
  }

  return `${state.useCase.title} can use standard oversight controls because the proposal keeps human review planned and decision impact is not high.`;
}

function describeAutomationPressure(proposedSolution: string) {
  if (/\b(rank|score|approve|reject|recommend|decide|route|classify)\b/i.test(proposedSolution)) {
    return "appears to influence prioritization, routing, recommendation, or decision-making";
  }

  if (/\b(summarize|draft|extract|answer|generate)\b/i.test(proposedSolution)) {
    return "appears to assist knowledge work or content generation before human use";
  }

  return "needs reviewer validation to determine whether AI output will inform operational decisions";
}

function buildPortfolioSummary(
  state: typeof GovernanceGenerationState.State,
  sameDepartmentCount: number
) {
  const patternText =
    sameDepartmentCount > 0
      ? `${sameDepartmentCount} prior ${state.useCase.department} governance report pattern${sameDepartmentCount === 1 ? "" : "s"}`
      : "no prior department-specific governance report pattern";

  return `${state.useCase.title} should be sequenced against ${patternText}, current reviewer capacity, and whether its controls can be reused across similar ${state.useCase.department} initiatives.`;
}

function truncateEvidence(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217)}...`;
}

function classifyReviewIntensity(
  state: typeof GovernanceGenerationState.State
): ReviewIntensity {
  if (!state.signals) {
    return "STANDARD";
  }

  if (
    state.signals.riskLevel === "CRITICAL" ||
    state.useCase.humanOversightPlanned === "NO" ||
    isHrWorkflow(state.useCase)
  ) {
    return "CRITICAL";
  }

  if (
    state.signals.riskLevel === "HIGH" ||
    state.useCase.decisionImpact === "HIGH" ||
    ["CONFIDENTIAL", "SENSITIVE"].includes(state.useCase.dataSensitivity) ||
    state.signals.finalRecommendation === "NEEDS_REVIEW"
  ) {
    return "ELEVATED";
  }

  return "STANDARD";
}

function buildRoutingDecisions(
  state: typeof GovernanceGenerationState.State,
  reviewIntensity: ReviewIntensity
): RoutingDecision[] {
  const decisions: RoutingDecision[] = [
    {
      from: "deterministic_analysis",
      to: "risk_triage",
      reason:
        "Deterministic guardrails always run before council routing decisions."
    }
  ];
  const reviewState = {
    ...state,
    reviewIntensity
  };
  const firstCouncilNode = shouldRunDataPrivacyReviewer(reviewState)
    ? "data_privacy_reviewer"
    : routeToNextCouncilNode(reviewState);

  decisions.push({
    from: "risk_triage",
    to: firstCouncilNode,
    reason: describeFirstCouncilRoute(reviewState, firstCouncilNode)
  });

  if (shouldRunDataPrivacyReviewer(reviewState)) {
    decisions.push({
      from: "data_privacy_reviewer",
      to: routeToNextCouncilNode(reviewState),
      reason: shouldRunHumanOversightReviewer(reviewState)
        ? "Privacy review complete; high-impact or incomplete oversight requires human accountability review."
        : "Privacy review complete; no separate oversight review required."
    });
  }

  if (shouldRunHumanOversightReviewer(reviewState)) {
    decisions.push({
      from: "human_oversight_reviewer",
      to: shouldRunChangeManagementReviewer(reviewState)
        ? "change_management_reviewer"
        : "portfolio_prioritizer",
      reason: shouldRunChangeManagementReviewer(reviewState)
        ? "Oversight review complete; rollout complexity requires change-management review."
        : "Oversight review complete; route to portfolio sequencing."
    });
  }

  if (shouldRunChangeManagementReviewer(reviewState)) {
    decisions.push({
      from: "change_management_reviewer",
      to: "portfolio_prioritizer",
      reason:
        "Change-management review complete; compare proposal against portfolio sequencing and governance capacity."
    });
  }

  decisions.push({
    from: "portfolio_prioritizer",
    to: isAzureGovernanceConfigured() ? "azure_analysis" : "local_fallback",
    reason: isAzureGovernanceConfigured()
      ? "Azure OpenAI is configured; use model-enriched report synthesis after council review."
      : "Azure OpenAI is not configured; use local fallback synthesis after council review."
  });

  return decisions;
}

function routeToNextCouncilNode(state: typeof GovernanceGenerationState.State) {
  if (shouldRunHumanOversightReviewer(state)) {
    return "human_oversight_reviewer";
  }

  if (shouldRunChangeManagementReviewer(state)) {
    return "change_management_reviewer";
  }

  return "portfolio_prioritizer";
}

function shouldRunDataPrivacyReviewer(
  state: Pick<
    typeof GovernanceGenerationState.State,
    "useCase" | "reviewIntensity"
  >
) {
  return (
    state.reviewIntensity !== "STANDARD" &&
    ["CONFIDENTIAL", "SENSITIVE"].includes(state.useCase.dataSensitivity)
  );
}

function shouldRunHumanOversightReviewer(
  state: Pick<
    typeof GovernanceGenerationState.State,
    "useCase" | "reviewIntensity"
  >
) {
  return (
    state.reviewIntensity === "CRITICAL" ||
    state.useCase.decisionImpact === "HIGH" ||
    state.useCase.humanOversightPlanned !== "YES"
  );
}

function shouldRunChangeManagementReviewer(
  state: Pick<
    typeof GovernanceGenerationState.State,
    "useCase" | "reviewIntensity"
  >
) {
  return (
    state.reviewIntensity !== "STANDARD" &&
    /team|department|employee|customer|vendor|stakeholder|manager/i.test(
      state.useCase.affectedStakeholders
    )
  );
}

function describeFirstCouncilRoute(
  state: Pick<
    typeof GovernanceGenerationState.State,
    "useCase" | "reviewIntensity"
  >,
  node: string
) {
  if (node === "data_privacy_reviewer") {
    return "Confidential or sensitive data requires privacy, access, and retention review.";
  }

  if (node === "human_oversight_reviewer") {
    return "High-impact or incomplete oversight requires accountability review.";
  }

  if (node === "change_management_reviewer") {
    return "Elevated rollout risk requires change-management review.";
  }

  return "Standard risk profile skips deep council review and routes directly to portfolio sequencing.";
}

function isHrWorkflow(useCase: UseCase) {
  const text = [
    useCase.department,
    useCase.currentProcess,
    useCase.proposedSolution,
    useCase.affectedStakeholders
  ].join(" ");

  return /\b(hr|human resources|applicant|candidate|employee performance|hiring|recruit)/i.test(
    text
  );
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function formatAgentName(agent: string) {
  return agent
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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
    reviewIntensity: null,
    reviewerNodesExecuted: [],
    routingDecisions: [],
    agentFindings: [],
    humanReviewRequired: false,
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
