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
