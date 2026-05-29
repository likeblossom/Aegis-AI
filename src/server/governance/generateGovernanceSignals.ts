import type { UseCase } from "@/db/schema";
import { detectRedFlags } from "./redFlags";
import { recommendGovernanceDecision } from "./recommendationEngine";
import type { RedFlag } from "./reportTypes";
import { scoreGovernanceRisk } from "./riskScoring";

export type GovernanceSignals = {
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  aiReadinessScore: number;
  finalRecommendation:
    | "APPROVED"
    | "APPROVED_WITH_CONTROLS"
    | "NEEDS_REVIEW"
    | "REJECTED";
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  deterministicRedFlags: RedFlag[];
  guardrailWarnings: string[];
  classification: {
    department: string;
    dataSensitivity: string;
    decisionImpact: string;
    humanOversightPlanned: string;
  };
};

export function generateGovernanceSignals(useCase: UseCase): GovernanceSignals {
  const deterministicRedFlags = detectRedFlags(useCase);
  const score = scoreGovernanceRisk(useCase, deterministicRedFlags);
  const finalRecommendation = recommendGovernanceDecision({
    riskLevel: score.riskLevel,
    aiReadinessScore: score.aiReadinessScore,
    redFlags: deterministicRedFlags
  });

  return {
    riskScore: score.numericRiskScore,
    riskLevel: score.riskLevel,
    aiReadinessScore: score.aiReadinessScore,
    finalRecommendation,
    confidenceLevel: score.confidenceLevel,
    deterministicRedFlags,
    guardrailWarnings: buildGuardrailWarnings(useCase, deterministicRedFlags),
    classification: {
      department: useCase.department,
      dataSensitivity: useCase.dataSensitivity,
      decisionImpact: useCase.decisionImpact,
      humanOversightPlanned: useCase.humanOversightPlanned
    }
  };
}

function buildGuardrailWarnings(useCase: UseCase, redFlags: RedFlag[]) {
  const warnings = redFlags.map(
    (flag) => `${flag.severity}: ${flag.issue} - ${flag.explanation}`
  );

  if (useCase.decisionImpact === "HIGH") {
    warnings.push(
      "High-impact use cases require documented human accountability, appeal paths, and reviewer override procedures."
    );
  }

  if (["CONFIDENTIAL", "SENSITIVE"].includes(useCase.dataSensitivity)) {
    warnings.push(
      "Sensitive or confidential data requires privacy, access-control, retention, and monitoring controls before pilot use."
    );
  }

  if (useCase.humanOversightPlanned !== "YES") {
    warnings.push(
      "Human oversight is not fully planned; final authority and escalation checkpoints must be defined before rollout."
    );
  }

  if (
    redFlags.some((flag) =>
      ["HR or applicant workflow", "High-impact decision without human oversight"].includes(
        flag.issue
      )
    )
  ) {
    warnings.push(
      "Employment or high-impact decision workflows must not be downgraded by generated analysis; preserve deterministic risk and review findings."
    );
  }

  return Array.from(new Set(warnings));
}
