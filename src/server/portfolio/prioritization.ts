import type { GovernanceReport, UseCase } from "@/db/schema";

export type PriorityCategory =
  | "Quick Win"
  | "Strategic Bet"
  | "Needs Governance Review"
  | "Low Priority";

export type PortfolioPriorityInput = {
  proposal: Pick<
    UseCase,
    "id" | "dataSensitivity" | "decisionImpact" | "createdAt"
  >;
  report: Pick<
    GovernanceReport,
    | "riskLevel"
    | "aiReadinessScore"
    | "finalRecommendation"
    | "reportJson"
    | "createdAt"
  >;
};

export type PortfolioPriority = {
  priorityScore: number;
  priorityRank: number;
  priorityCategory: PriorityCategory;
  explanation: string;
};

export type RankedPortfolioPriority<T extends PortfolioPriorityInput> = T &
  PortfolioPriority;

type ImplementationComplexity = "LOW" | "MEDIUM" | "HIGH";

const riskWeight: Record<string, number> = {
  LOW: 25,
  MEDIUM: 18,
  HIGH: 8,
  CRITICAL: 0
};

const recommendationWeight: Record<string, number> = {
  APPROVED: 15,
  APPROVED_WITH_CONTROLS: 11,
  NEEDS_REVIEW: 4,
  REJECTED: 0
};

const decisionImpactWeight: Record<string, number> = {
  LOW: 4,
  MEDIUM: 6,
  HIGH: 8
};

const dataSensitivityWeight: Record<string, number> = {
  PUBLIC: 6,
  INTERNAL: 5,
  CONFIDENTIAL: 3,
  SENSITIVE: 0
};

const implementationComplexityWeight: Record<ImplementationComplexity, number> = {
  LOW: 6,
  MEDIUM: 3,
  HIGH: 0
};

export function prioritizePortfolio<T extends PortfolioPriorityInput>(
  items: T[]
): RankedPortfolioPriority<T>[] {
  return items
    .map((item) => ({
      ...item,
      ...calculatePriority(item)
    }))
    .sort(comparePortfolioPriorities)
    .map((item, index) => ({
      ...item,
      priorityRank: index + 1
    }));
}

export function calculatePriority(input: PortfolioPriorityInput): PortfolioPriority {
  const implementationComplexity = extractImplementationComplexity(
    input.report.reportJson
  );
  const priorityScore = calculatePriorityScore(input, implementationComplexity);
  const priorityCategory = categorizePriority(input, priorityScore);

  return {
    priorityScore,
    priorityRank: 0,
    priorityCategory,
    explanation: buildExplanation(input, priorityCategory, implementationComplexity)
  };
}

function calculatePriorityScore(
  { proposal, report }: PortfolioPriorityInput,
  implementationComplexity: ImplementationComplexity | null
) {
  const readiness = clamp(report.aiReadinessScore, 0, 100) * 0.4;
  const risk = riskWeight[report.riskLevel] ?? 10;
  const recommendation = recommendationWeight[report.finalRecommendation] ?? 4;
  const impact = decisionImpactWeight[proposal.decisionImpact] ?? 4;
  const data = dataSensitivityWeight[proposal.dataSensitivity] ?? 3;
  const complexity =
    implementationComplexity === null
      ? 4
      : implementationComplexityWeight[implementationComplexity];

  return Math.round(
    clamp(readiness + risk + recommendation + impact + data + complexity, 0, 100)
  );
}

function categorizePriority(
  { proposal, report }: PortfolioPriorityInput,
  priorityScore: number
): PriorityCategory {
  if (
    priorityScore >= 75 &&
    ["LOW", "MEDIUM"].includes(report.riskLevel) &&
    ["APPROVED", "APPROVED_WITH_CONTROLS"].includes(report.finalRecommendation)
  ) {
    return "Quick Win";
  }

  if (
    priorityScore >= 65 &&
    proposal.decisionImpact === "HIGH" &&
    report.riskLevel !== "CRITICAL" &&
    report.finalRecommendation !== "REJECTED"
  ) {
    return "Strategic Bet";
  }

  if (
    ["HIGH", "CRITICAL"].includes(report.riskLevel) ||
    report.finalRecommendation === "NEEDS_REVIEW"
  ) {
    return "Needs Governance Review";
  }

  return "Low Priority";
}

function buildExplanation(
  { proposal, report }: PortfolioPriorityInput,
  priorityCategory: PriorityCategory,
  implementationComplexity: ImplementationComplexity | null
) {
  const readiness = describeReadiness(report.aiReadinessScore);
  const risk = describeRisk(report.riskLevel);
  const recommendation = describeRecommendation(report.finalRecommendation);
  const impact =
    proposal.decisionImpact === "HIGH"
      ? "high decision impact"
      : `${proposal.decisionImpact.toLowerCase()} decision impact`;
  const data =
    proposal.dataSensitivity === "SENSITIVE"
      ? "sensitive data"
      : `${proposal.dataSensitivity.toLowerCase()} data`;
  const complexity = implementationComplexity
    ? ` and ${implementationComplexity.toLowerCase()} implementation complexity`
    : "";

  if (priorityCategory === "Quick Win") {
    return `${readiness}, ${risk}, and ${recommendation} make this a strong early AI adoption candidate with ${impact} and ${data}${complexity}.`;
  }

  if (priorityCategory === "Strategic Bet") {
    return `${readiness} and ${impact} indicate meaningful business value, but ${risk} and ${data}${complexity} mean rollout should be sequenced with governance controls.`;
  }

  if (priorityCategory === "Needs Governance Review") {
    return `${risk} and ${recommendation} indicate this proposal should receive additional governance review before it is prioritized for implementation.`;
  }

  return `${readiness}, ${risk}, and ${recommendation} place this below stronger portfolio candidates for near-term implementation.`;
}

function describeReadiness(score: number) {
  if (score >= 75) {
    return "High readiness";
  }

  if (score >= 50) {
    return "Moderate readiness";
  }

  return "Low readiness";
}

function describeRisk(riskLevel: string) {
  if (riskLevel === "LOW") {
    return "manageable risk";
  }

  if (riskLevel === "MEDIUM") {
    return "moderate risk";
  }

  if (riskLevel === "HIGH") {
    return "elevated risk";
  }

  return "critical risk";
}

function describeRecommendation(recommendation: string) {
  if (recommendation === "APPROVED") {
    return "a clear approval recommendation";
  }

  if (recommendation === "APPROVED_WITH_CONTROLS") {
    return "an approval-with-controls recommendation";
  }

  if (recommendation === "NEEDS_REVIEW") {
    return "a needs-review recommendation";
  }

  return "a rejection recommendation";
}

function comparePortfolioPriorities(
  a: RankedPortfolioPriority<PortfolioPriorityInput>,
  b: RankedPortfolioPriority<PortfolioPriorityInput>
) {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }

  if (b.report.aiReadinessScore !== a.report.aiReadinessScore) {
    return b.report.aiReadinessScore - a.report.aiReadinessScore;
  }

  return compareDates(a.proposal.createdAt, b.proposal.createdAt);
}

function extractImplementationComplexity(
  reportJson: string
): ImplementationComplexity | null {
  try {
    const parsed = JSON.parse(reportJson) as Record<string, unknown>;
    return normalizeImplementationComplexity(
      parsed.implementationComplexity ??
        parsed.implementation_complexity ??
        parsed.complexity ??
        getNestedComplexity(parsed)
    );
  } catch {
    return null;
  }
}

function getNestedComplexity(parsed: Record<string, unknown>) {
  const implementation = parsed.implementation;

  if (
    implementation &&
    typeof implementation === "object" &&
    "complexity" in implementation
  ) {
    return (implementation as Record<string, unknown>).complexity;
  }

  return null;
}

function normalizeImplementationComplexity(
  value: unknown
): ImplementationComplexity | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase().replaceAll(" ", "_");

  if (normalized.includes("LOW")) {
    return "LOW";
  }

  if (normalized.includes("MEDIUM") || normalized.includes("MODERATE")) {
    return "MEDIUM";
  }

  if (normalized.includes("HIGH") || normalized.includes("COMPLEX")) {
    return "HIGH";
  }

  return null;
}

function compareDates(a: string, b: string) {
  return new Date(`${a}Z`).getTime() - new Date(`${b}Z`).getTime();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
