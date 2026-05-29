import type { UseCase } from "@/db/schema";
import { formatEnumLabel } from "@/lib/constants";
import { detectRedFlags } from "./redFlags";
import { recommendGovernanceDecision } from "./recommendationEngine";
import type { GovernanceReportObject } from "./reportTypes";
import { scoreGovernanceRisk } from "./riskScoring";

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

function adoptionRisk(useCase: UseCase): "Low" | "Medium" | "High" {
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
    return "High";
  }

  if (riskSignals >= 2) {
    return "Medium";
  }

  return "Low";
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

  if (risk === "High") {
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
  riskLevel,
  finalRecommendation,
  controls,
  redFlags
}: {
  useCase: UseCase;
  riskLevel: string;
  finalRecommendation: string;
  controls: string[];
  redFlags: ReturnType<typeof detectRedFlags>;
}) {
  const recommendationLabel = formatEnumLabel(finalRecommendation).toLowerCase();
  const riskLabel = formatEnumLabel(riskLevel).toLowerCase();
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
    riskLevel === "CRITICAL"
      ? "Hold a governance review before any pilot or production use."
      : riskLevel === "HIGH"
        ? "Run a controlled pilot only after confirming ownership, controls, and success measures."
        : finalRecommendation === "APPROVED"
          ? "Proceed with a limited pilot and monitor quality, adoption, and exceptions."
          : "Confirm required controls, then decide whether to proceed with a limited pilot.";

  return {
    headline: `${useCase.title} is a ${riskLabel} proposal with a ${recommendationLabel} recommendation.`,
    recommendationSummary: `The current assessment recommends ${recommendationLabel} because the proposal has ${riskLabel} governance risk and an AI readiness score that should guide pilot timing.`,
    expectedBusinessValue: `${useCase.expectedBenefit} Managers should validate this value through measurable pilot outcomes before scaling.`,
    topRisks,
    requiredControls: controls.slice(0, 3),
    suggestedNextStep,
    decisionQuestion:
      "Is the expected business value strong enough to proceed with the required controls and oversight?"
  };
}

export function generateGovernanceReport(
  useCase: UseCase
): GovernanceReportObject {
  const redFlags = detectRedFlags(useCase);
  const score = scoreGovernanceRisk(useCase, redFlags);
  const finalRecommendation = recommendGovernanceDecision({
    riskLevel: score.riskLevel,
    aiReadinessScore: score.aiReadinessScore,
    redFlags
  });

  const controls = requiredControls(useCase, score.riskLevel);

  return {
    executiveSummary: `${useCase.title} is classified as a ${formatEnumLabel(
      score.riskLevel
    ).toLowerCase()} governance risk proposal with ${formatEnumLabel(
      useCase.dataSensitivity
    ).toLowerCase()} data and ${formatEnumLabel(
      useCase.decisionImpact
    ).toLowerCase()} decision impact. The deterministic review recommends ${formatEnumLabel(
      finalRecommendation
    ).toLowerCase()} at this stage.`,
    executiveBriefing: executiveBriefing({
      useCase,
      riskLevel: score.riskLevel,
      finalRecommendation,
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
    rolloutStrategy: rolloutStrategy(useCase, score.riskLevel),
    changeManagementAnalysis: changeManagementAnalysis(useCase),
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
    riskLevel: score.riskLevel,
    aiReadinessScore: score.aiReadinessScore,
    finalRecommendation,
    confidenceLevel: score.confidenceLevel
  };
}
