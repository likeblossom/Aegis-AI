import type { RedFlag } from "./reportTypes";

export function recommendGovernanceDecision({
  riskLevel,
  aiReadinessScore,
  redFlags
}: {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  aiReadinessScore: number;
  redFlags: RedFlag[];
}) {
  if (riskLevel === "CRITICAL") {
    return "REJECTED" as const;
  }

  if (
    riskLevel === "HIGH" ||
    aiReadinessScore < 45 ||
    redFlags.some((flag) => flag.severity === "HIGH")
  ) {
    return "NEEDS_REVIEW" as const;
  }

  if (riskLevel === "MEDIUM" || redFlags.length > 0) {
    return "APPROVED_WITH_CONTROLS" as const;
  }

  return "APPROVED" as const;
}
