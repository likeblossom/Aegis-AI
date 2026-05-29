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
      promptVersion: LOCAL_FALLBACK_PROMPT_VERSION
    },
    riskLevel: signals.riskLevel,
    aiReadinessScore: signals.aiReadinessScore,
    finalRecommendation: signals.finalRecommendation,
    confidenceLevel: signals.confidenceLevel
  };
}
