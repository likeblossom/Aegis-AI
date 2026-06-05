import type { UseCase } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import { detectRedFlags } from "./redFlags";
import type { GovernanceReportObject } from "./reportTypes";
import {
  generateGovernanceSignals,
  type GovernanceSignals
} from "./generateGovernanceSignals";

export const LOCAL_FALLBACK_PROMPT_VERSION = "local-fallback-governance-v1.0";

function automationProfile(useCase: UseCase) {
  if (useCase.humanOversightPlanned === "NO") {
    return "Automated workflow with no planned human oversight";
  }

  if (useCase.humanOversightPlanned === "PARTIAL") {
    return "AI-assisted workflow with partial human oversight";
  }

  return "AI-assisted workflow with planned human review";
}

function requiredControls(useCase: UseCase, riskLevel: string) {
  const controls = [
    "Document the accountable business owner before pilot launch.",
    "Require human review of outputs before operational use.",
    "Log material AI-assisted decisions and reviewer overrides."
  ];

  if (["CONFIDENTIAL", "SENSITIVE"].includes(useCase.dataSensitivity)) {
    controls.push("Confirm data access, retention, and privacy controls before testing.");
  }

  if (useCase.decisionImpact === "HIGH") {
    controls.push("Complete governance review for fairness, appealability, and decision accountability.");
  }

  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    controls.push("Run a limited pilot with documented success criteria and escalation triggers.");
  }

  return controls;
}

function rolloutStrategy(useCase: UseCase, riskLevel: string) {
  const steps = [
    "Confirm scope, owner, and intended users for the pilot.",
    "Test against historical examples before introducing the workflow to live operations.",
    "Collect reviewer feedback and measure error patterns during pilot use."
  ];

  if (riskLevel === "LOW") {
    steps.push("Expand gradually after confirming low error rates and user acceptance.");
  } else {
    steps.push("Hold a governance checkpoint before expanding beyond the initial pilot group.");
  }

  if (useCase.decisionImpact === "HIGH") {
    steps.push("Keep final approval authority outside the AI system until a formal review is complete.");
  }

  return steps;
}

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function extractAffectedTeams(useCase: UseCase) {
  const teams = [
    useCase.department,
    useCase.teamOwner,
    ...useCase.affectedStakeholders
      .split(/,|;|\band\b/i)
      .map((stakeholder) => stakeholder.trim())
      .filter(Boolean)
  ];

  return Array.from(new Set(teams)).slice(0, 6);
}

function adoptionRisk(useCase: UseCase): "LOW" | "MEDIUM" | "HIGH" {
  const riskSignals = [
    useCase.decisionImpact === "HIGH",
    ["CONFIDENTIAL", "SENSITIVE"].includes(useCase.dataSensitivity),
    useCase.humanOversightPlanned === "NO",
    useCase.humanOversightPlanned === "PARTIAL",
    includesAny(useCase.proposedSolution, [
      "fully automated",
      "replace",
      "rank",
      "approve",
      "reject",
      "screen"
    ]),
    includesAny(useCase.implementationTimeline, ["week", "weeks"]) &&
      !includesAny(useCase.implementationTimeline, ["12 weeks", "16 weeks"])
  ].filter(Boolean).length;

  if (riskSignals >= 4) {
    return "HIGH";
  }

  if (riskSignals >= 2) {
    return "MEDIUM";
  }

  return "LOW";
}

function changeManagementAnalysis(useCase: UseCase) {
  const risk = adoptionRisk(useCase);
  const expectedResistance = [
    "Users may be uncertain about how AI-assisted outputs will be evaluated and challenged."
  ];
  const trainingNeeds = [
    "Train users on the intended workflow, review responsibilities, and escalation path.",
    "Provide examples of acceptable and unacceptable AI-assisted outputs."
  ];
  const communicationPlan = [
    "Announce pilot scope, accountable owner, and success measures before launch.",
    "Share how feedback, overrides, and issues will be captured during rollout."
  ];
  const mitigationActions = [
    "Start with a limited pilot and review adoption feedback before expansion.",
    "Keep a named human owner accountable for decisions and exception handling."
  ];

  if (useCase.decisionImpact === "HIGH") {
    expectedResistance.push(
      "Affected teams may worry about accountability for high-impact recommendations or decisions."
    );
    trainingNeeds.push(
      "Train reviewers on decision accountability, appeal paths, and when to override AI output."
    );
    communicationPlan.push(
      "Explain that final authority remains with designated human reviewers during the pilot."
    );
  }

  if (["CONFIDENTIAL", "SENSITIVE"].includes(useCase.dataSensitivity)) {
    expectedResistance.push(
      "Privacy, security, or compliance teams may need assurance on data access and retention."
    );
    trainingNeeds.push(
      "Train pilot users on approved data handling, access boundaries, and retention expectations."
    );
    mitigationActions.push(
      "Confirm privacy and security controls before broad stakeholder rollout."
    );
  }

  if (useCase.humanOversightPlanned !== "YES") {
    expectedResistance.push(
      "Employees may resist adoption if the oversight model is unclear or feels too automated."
    );
    mitigationActions.push(
      "Define human review checkpoints and publish escalation criteria before launch."
    );
  }

  if (risk === "HIGH") {
    communicationPlan.push(
      "Hold targeted briefings with impacted teams before enabling production use."
    );
    mitigationActions.push(
      "Schedule a governance checkpoint before moving beyond the first pilot cohort."
    );
  }

  return {
    affectedTeams: extractAffectedTeams(useCase),
    adoptionRisk: risk,
    expectedResistance,
    trainingNeeds,
    communicationPlan,
    mitigationActions
  };
}

function executiveBriefing({
  useCase,
  signals,
  controls,
  redFlags
}: {
  useCase: UseCase;
  signals: GovernanceSignals;
  controls: string[];
  redFlags: ReturnType<typeof detectRedFlags>;
}) {
  const recommendationLabel = formatEnumLabel(
    signals.finalRecommendation
  ).toLowerCase();
  const riskLabel = formatEnumLabel(signals.riskLevel).toLowerCase();
  const topRisks =
    redFlags.length > 0
      ? redFlags.slice(0, 3).map((flag) => flag.issue)
      : [
          `${formatEnumLabel(
            useCase.dataSensitivity
          )} data and ${formatEnumLabel(
            useCase.decisionImpact
          ).toLowerCase()} decision impact still require standard review.`
        ];

  const suggestedNextStep =
    signals.riskLevel === "CRITICAL"
      ? "Hold a governance review before any pilot or production use."
      : signals.riskLevel === "HIGH"
        ? "Run a controlled pilot only after confirming ownership, controls, and success measures."
        : signals.finalRecommendation === "APPROVED"
          ? "Proceed with a limited pilot and monitor quality, adoption, and exceptions."
          : "Confirm required controls, then decide whether to proceed with a limited pilot.";

  return {
    headline: `${useCase.title} is a ${riskLabel} proposal with a ${recommendationLabel} recommendation.`,
    recommendationSummary: `The local fallback assessment recommends ${recommendationLabel} because deterministic guardrails identified ${riskLabel} governance risk and an AI readiness score of ${signals.aiReadinessScore}/100.`,
    expectedBusinessValue: `${useCase.expectedBenefit} Managers should validate this value through measurable pilot outcomes before scaling.`,
    topRisks,
    requiredControls: controls.slice(0, 3),
    suggestedNextStep,
    decisionQuestion:
      "Is the expected business value strong enough to proceed with the required controls and oversight?"
  };
}

function proposalChallenger(signals: GovernanceSignals) {
  return {
    reasonsThisMightFail: [
      "Users may not trust or consistently review AI-assisted outputs.",
      "Pilot outcomes may not match the expected operational benefit.",
      ...signals.guardrailWarnings.slice(0, 2)
    ],
    assumptionsToValidate: [
      "The proposal has enough representative data for a controlled pilot.",
      "Human reviewers have time and accountability to validate AI outputs.",
      "Business value can be measured with clear pilot metrics."
    ],
    questionsForStakeholders: [
      "Who owns final decisions and exception handling?",
      "Which outcomes would stop or delay rollout?",
      "What evidence is needed before scaling beyond the first pilot group?"
    ]
  };
}

function successMetrics(useCase: UseCase) {
  return [
    "Pilot users complete review tasks with fewer manual steps.",
    "AI-assisted outputs meet documented quality thresholds.",
    "Reviewer overrides, escalations, and exceptions are tracked during pilot use.",
    `${useCase.expectedBenefit} is validated with measured outcomes.`
  ];
}

function assumptionsAndUncertainties(useCase: UseCase) {
  return [
    "The intake form is the only source of context for this fallback report.",
    "Detailed data quality, integration effort, and operating procedures require confirmation.",
    `Implementation timeline is stated as ${useCase.implementationTimeline}.`
  ];
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function confidenceFromSpecificity(useCase: UseCase): "LOW" | "MEDIUM" | "HIGH" {
  const proposalText = [
    useCase.currentProcess,
    useCase.proposedSolution,
    useCase.expectedBenefit,
    useCase.affectedStakeholders,
    useCase.implementationTimeline
  ].join(" ");
  const hasMeasuredOutcome = /\b(\d+%|\d+\s*(hour|hours|day|days|week|weeks)|cost|save|reduce|faster|time)\b/i.test(
    proposalText
  );
  const hasOperationalDetail = /\b(workflow|process|review|documented|ticket|meeting|record|checklist|source)\b/i.test(
    proposalText
  );

  if (hasMeasuredOutcome && hasOperationalDetail) {
    return "HIGH";
  }

  return proposalText.length > 180 ? "MEDIUM" : "LOW";
}

function assessmentBreakdown(
  useCase: UseCase,
  signals: GovernanceSignals,
  controls: string[]
): GovernanceReportObject["assessmentBreakdown"] {
  const confidence = confidenceFromSpecificity(useCase);
  const hasDocumentedProcess = includesAny(useCase.currentProcess, [
    "documented",
    "standard",
    "checklist",
    "records",
    "ticket",
    "approved",
    "workflow"
  ]);
  const hasDataQualityDetail = includesAny(useCase.currentProcess, [
    "records",
    "documents",
    "approved",
    "historical",
    "data",
    "ticket"
  ]);
  const integrationComplexity = includesAny(useCase.proposedSolution, [
    "integrate",
    "integration",
    "system",
    "workflow",
    "automated",
    "approval"
  ]);
  const compressedTimeline = includesAny(useCase.implementationTimeline, [
    "1 week",
    "2 weeks",
    "3 weeks",
    "4 weeks"
  ]);
  const oversightScore =
    useCase.humanOversightPlanned === "YES"
      ? 85
      : useCase.humanOversightPlanned === "PARTIAL"
        ? 55
        : 20;
  const riskScoreByLevel = {
    LOW: 82,
    MEDIUM: 65,
    HIGH: 42,
    CRITICAL: 20
  }[signals.riskLevel];
  const changeRiskScore =
    adoptionRisk(useCase) === "LOW" ? 80 : adoptionRisk(useCase) === "MEDIUM" ? 58 : 35;
  const dataReadinessScore = clampScore(
    45 +
      (hasDocumentedProcess ? 20 : 0) +
      (hasDataQualityDetail ? 20 : 0) +
      (["PUBLIC", "INTERNAL"].includes(useCase.dataSensitivity) ? 10 : -5)
  );
  const implementationScore = clampScore(
    78 -
      (integrationComplexity ? 14 : 0) -
      (compressedTimeline ? 8 : 0) -
      (useCase.decisionImpact === "HIGH" ? 12 : 0) -
      (["CONFIDENTIAL", "SENSITIVE"].includes(useCase.dataSensitivity) ? 10 : 0)
  );

  return {
    businessValue: {
      score: clampScore(62 + (useCase.expectedBenefit.length > 35 ? 16 : 6)),
      rationale:
        "The proposal identifies a concrete operational benefit, but the value case still needs pilot metrics to prove measurable efficiency or service improvement.",
      evidenceFromProposal: [
        `Expected benefit: ${useCase.expectedBenefit}`,
        `Current process: ${useCase.currentProcess}`
      ],
      improvementActions: [
        "Define baseline cycle time, effort, quality, and user satisfaction metrics before the pilot starts.",
        "Set a target improvement threshold that must be met before scaling beyond the pilot group."
      ],
      confidence
    },
    implementationComplexity: {
      score: implementationScore,
      rationale:
        "Complexity is driven by the proposed operating change, implementation timeline, data sensitivity, and whether the workflow affects higher-impact decisions.",
      evidenceFromProposal: [
        `Proposed solution: ${useCase.proposedSolution}`,
        `Implementation timeline: ${useCase.implementationTimeline}`
      ],
      improvementActions: [
        "Create a pilot implementation plan that names systems, data sources, integration points, owners, and approval gates.",
        "Start with a limited workflow slice before connecting the AI output to downstream operational systems."
      ],
      confidence
    },
    governanceRisk: {
      score: riskScoreByLevel,
      rationale:
        "The governance score reflects deterministic risk signals from data sensitivity, decision impact, human oversight, and any red flags.",
      evidenceFromProposal: [
        `Data sensitivity: ${formatEnumLabel(useCase.dataSensitivity)}`,
        `Decision impact: ${formatEnumLabel(useCase.decisionImpact)}`,
        `Human oversight planned: ${formatEnumLabel(useCase.humanOversightPlanned)}`
      ],
      improvementActions: controls.slice(0, 3),
      confidence: signals.confidenceLevel
    },
    changeManagementRisk: {
      score: changeRiskScore,
      rationale:
        "The adoption score reflects the number of stakeholder groups affected, likely workflow changes, training needs, and perceived accountability concerns.",
      evidenceFromProposal: [
        `Affected stakeholders: ${useCase.affectedStakeholders}`,
        `Current process: ${useCase.currentProcess}`
      ],
      improvementActions: [
        "Publish a short operating procedure that explains when users should accept, edit, reject, or escalate AI output.",
        "Run stakeholder training before pilot launch and collect adoption feedback during the first rollout phase."
      ],
      confidence
    },
    dataReadiness: {
      score: dataReadinessScore,
      rationale:
        "Data readiness is stronger when the current process references known records, documents, approved sources, or a repeatable workflow.",
      evidenceFromProposal: [
        `Current process: ${useCase.currentProcess}`,
        `Data sensitivity: ${formatEnumLabel(useCase.dataSensitivity)}`
      ],
      improvementActions: [
        "Inventory the approved data sources, owners, access permissions, retention rules, and quality checks required for the pilot.",
        "Test the AI workflow on representative historical examples before live use."
      ],
      confidence
    },
    humanOversightStrength: {
      score: oversightScore,
      rationale:
        "Oversight strength depends on whether the proposal keeps a human reviewer accountable before AI-assisted outputs influence operations.",
      evidenceFromProposal: [
        `Human oversight planned: ${formatEnumLabel(useCase.humanOversightPlanned)}`,
        `Decision impact: ${formatEnumLabel(useCase.decisionImpact)}`
      ],
      improvementActions: [
        "Introduce mandatory human review of AI-generated outputs before they are used for stakeholder communication or operational decisions.",
        "Define escalation criteria and assign a named owner for reviewer overrides and exceptions."
      ],
      confidence: useCase.humanOversightPlanned === "YES" ? "HIGH" : "MEDIUM"
    },
    strategicAlignment: {
      score: clampScore(
        60 +
          (useCase.expectedBenefit.length > 35 ? 12 : 0) +
          (hasDocumentedProcess ? 8 : 0) +
          (signals.aiReadinessScore >= 70 ? 8 : 0)
      ),
      rationale:
        "Strategic alignment is strongest where the proposal connects an existing business workflow to measurable continuous improvement and sustainable operating value.",
      evidenceFromProposal: [
        `Department: ${useCase.department}`,
        `Expected benefit: ${useCase.expectedBenefit}`
      ],
      improvementActions: [
        "Connect the pilot objective to a department-level goal, service metric, or continuous improvement target.",
        "Define the long-term owner responsible for monitoring value, quality, and governance controls after rollout."
      ],
      confidence
    }
  };
}

export function generateGovernanceReport(
  useCase: UseCase,
  signals = generateGovernanceSignals(useCase)
): GovernanceReportObject {
  const redFlags = signals.deterministicRedFlags;
  const controls = requiredControls(useCase, signals.riskLevel);

  return {
    executiveSummary: `${useCase.title} is classified as a ${formatEnumLabel(
      signals.riskLevel
    ).toLowerCase()} governance risk proposal with ${formatEnumLabel(
      useCase.dataSensitivity
    ).toLowerCase()} data and ${formatEnumLabel(
      useCase.decisionImpact
    ).toLowerCase()} decision impact. The deterministic review recommends ${formatEnumLabel(
      signals.finalRecommendation
    ).toLowerCase()} at this stage. This report was generated using local fallback analysis.`,
    executiveBriefing: executiveBriefing({
      useCase,
      signals,
      controls,
      redFlags
    }),
    useCaseClassification: {
      department: useCase.department,
      dataSensitivity: useCase.dataSensitivity,
      decisionImpact: useCase.decisionImpact,
      automationProfile: automationProfile(useCase)
    },
    governanceRiskAnalysis:
      redFlags.length > 0
        ? `The proposal triggered ${redFlags.length} governance red flag${
            redFlags.length === 1 ? "" : "s"
          }, primarily related to data sensitivity, decision impact, automation, or human oversight.`
        : "The proposal did not trigger major deterministic red flags, but basic ownership, monitoring, and review controls are still required.",
    businessImpactAnalysis: `${useCase.expectedBenefit} The stated benefit is plausible, but rollout should remain tied to measurable pilot outcomes and documented human accountability.`,
    analysisRationale: [
      {
        finding: "Decision impact assessment",
        whyItMatters:
          "Higher impact workflows require stronger oversight because errors can affect people, vendors, operations, or compliance outcomes.",
        evidenceFromProposal: `Decision impact is marked as ${formatEnumLabel(
          useCase.decisionImpact
        )}.`,
        recommendedAction:
          useCase.decisionImpact === "HIGH"
            ? "Require governance review before approving operational use."
            : "Proceed with standard pilot controls and documented review checkpoints."
      },
      {
        finding: "Human oversight plan",
        whyItMatters:
          "Human review defines who remains accountable for AI-assisted outputs.",
        evidenceFromProposal: `Human oversight is marked as ${formatEnumLabel(
          useCase.humanOversightPlanned
        )}.`,
        recommendedAction:
          useCase.humanOversightPlanned === "YES"
            ? "Document reviewer responsibilities and escalation criteria."
            : "Strengthen the oversight model before expansion."
      },
      {
        finding: "Data sensitivity",
        whyItMatters:
          "More sensitive data requires clearer access control, retention, and monitoring requirements.",
        evidenceFromProposal: `Data sensitivity is marked as ${formatEnumLabel(
          useCase.dataSensitivity
        )}.`,
        recommendedAction:
          ["CONFIDENTIAL", "SENSITIVE"].includes(useCase.dataSensitivity)
            ? "Confirm privacy and access-control requirements before pilot testing."
            : "Apply baseline data handling controls."
      }
    ],
    redFlags,
    requiredControls: controls,
    rolloutStrategy: rolloutStrategy(useCase, signals.riskLevel),
    changeManagementAnalysis: changeManagementAnalysis(useCase),
    stakeholderImpactAnalysis: `${useCase.affectedStakeholders} may experience changes to task flow, review responsibilities, and escalation expectations during pilot rollout.`,
    assessmentBreakdown: assessmentBreakdown(useCase, signals, controls),
    proposalChallenger: proposalChallenger(signals),
    successMetrics: successMetrics(useCase),
    assumptionsAndUncertainties: assumptionsAndUncertainties(useCase),
    simulatedGovernanceReviews: [
      {
        reviewer: "IT Governance",
        concerns: [
          "Ownership and operating model need to be explicit.",
          "Pilot metrics should distinguish productivity gains from quality loss."
        ],
        recommendations: [
          "Assign a named business owner.",
          "Review exceptions and overrides during the pilot."
        ],
        approvalConditions: ["Document monitoring and escalation steps."]
      },
      {
        reviewer: "Security and Privacy",
        concerns: [
          "Data classification and access boundaries must match the proposed workflow."
        ],
        recommendations: [
          "Limit test data to approved sources.",
          "Confirm retention expectations before launch."
        ],
        approvalConditions: ["Complete a data handling review for the pilot."]
      },
      {
        reviewer: "Operations",
        concerns: [
          "Users may over-rely on generated summaries or recommendations."
        ],
        recommendations: [
          "Train reviewers to validate AI output.",
          "Capture feedback on false positives and false negatives."
        ],
        approvalConditions: ["Keep human review in place through the first rollout phase."]
      }
    ],
    generationMetadata: {
      generationMode: "LOCAL_FALLBACK",
      fallbackUsed: true,
      promptVersion: LOCAL_FALLBACK_PROMPT_VERSION
    },
    workflowTrace: {
      runId: "legacy-report",
      path: [],
      reviewerNodesExecuted: [],
      routingDecisions: [],
      agentFindings: [],
      humanReviewRequired: false
    },
    riskLevel: signals.riskLevel,
    aiReadinessScore: signals.aiReadinessScore,
    finalRecommendation: signals.finalRecommendation,
    confidenceLevel: signals.confidenceLevel
  };
}
