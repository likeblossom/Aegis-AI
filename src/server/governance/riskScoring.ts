import type { UseCase } from "@/db/schema";
import type { RedFlag } from "./reportTypes";

type RiskScore = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  aiReadinessScore: number;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  numericRiskScore: number;
};

const sensitivityWeight: Record<string, number> = {
  PUBLIC: 0,
  INTERNAL: 10,
  CONFIDENTIAL: 20,
  SENSITIVE: 30
};

const impactWeight: Record<string, number> = {
  LOW: 5,
  MEDIUM: 20,
  HIGH: 35
};

const oversightWeight: Record<string, number> = {
  YES: -10,
  PARTIAL: 10,
  NO: 25
};

const severityWeight: Record<RedFlag["severity"], number> = {
  LOW: 5,
  MEDIUM: 10,
  HIGH: 18,
  CRITICAL: 28
};

export function scoreGovernanceRisk(useCase: UseCase, redFlags: RedFlag[]): RiskScore {
  const numericRiskScore = Math.min(
    100,
    Math.max(
      0,
      (sensitivityWeight[useCase.dataSensitivity] ?? 10) +
        (impactWeight[useCase.decisionImpact] ?? 10) +
        (oversightWeight[useCase.humanOversightPlanned] ?? 0) +
        redFlags.reduce((total, flag) => total + severityWeight[flag.severity], 0)
    )
  );

  const riskLevel =
    numericRiskScore >= 80
      ? "CRITICAL"
      : numericRiskScore >= 55
        ? "HIGH"
        : numericRiskScore >= 30
          ? "MEDIUM"
          : "LOW";

  const aiReadinessScore = Math.max(
    0,
    Math.min(
      100,
      100 -
        numericRiskScore +
        (useCase.humanOversightPlanned === "YES" ? 10 : 0) -
        (useCase.decisionImpact === "HIGH" ? 10 : 0)
    )
  );

  const confidenceLevel =
    redFlags.length >= 3 || useCase.decisionImpact === "HIGH"
      ? "HIGH"
      : redFlags.length === 0
        ? "MEDIUM"
        : "HIGH";

  return {
    riskLevel,
    aiReadinessScore,
    confidenceLevel,
    numericRiskScore
  };
}
