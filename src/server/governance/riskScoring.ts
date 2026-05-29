import type { UseCase } from "@/db/schema";
import type { RedFlag } from "./reportTypes";

type RiskScore = {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  aiReadinessScore: number;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  numericRiskScore: number;
};

type ReadinessFactor = {
  score: number;
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

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function proposalText(useCase: UseCase) {
  return [
    useCase.title,
    useCase.currentProcess,
    useCase.proposedSolution,
    useCase.expectedBenefit,
    useCase.affectedStakeholders,
    useCase.implementationTimeline
  ].join(" ");
}

function scoreFactor(
  text: string,
  positiveTerms: string[],
  negativeTerms: string[],
  baseScore = 8
): ReadinessFactor {
  const positiveMatches = positiveTerms.filter((term) =>
    includesAny(text, [term])
  ).length;
  const negativeMatches = negativeTerms.filter((term) =>
    includesAny(text, [term])
  ).length;

  return {
    score: Math.max(
      0,
      Math.min(16, baseScore + positiveMatches * 2 - negativeMatches * 4)
    )
  };
}

function scoreImplementationTimeline(timeline: string): ReadinessFactor {
  const monthMatch = timeline.match(/(\d+)\s*(month|months)/i);
  const weekMatch = timeline.match(/(\d+)\s*(week|weeks)/i);
  const quarterMatch = timeline.match(/(\d+)\s*(quarter|quarters)/i);

  if (includesAny(timeline, ["unknown", "tbd", "not sure", "unclear"])) {
    return { score: 6 };
  }

  if (weekMatch) {
    const weeks = Number(weekMatch[1]);
    return {
      score: weeks <= 12 ? 18 : weeks <= 26 ? 14 : 9
    };
  }

  if (monthMatch) {
    const months = Number(monthMatch[1]);
    return {
      score: months <= 3 ? 18 : months <= 6 ? 14 : months <= 12 ? 10 : 6
    };
  }

  if (quarterMatch) {
    const quarters = Number(quarterMatch[1]);
    return {
      score: quarters <= 1 ? 16 : quarters <= 2 ? 12 : 8
    };
  }

  return { score: 12 };
}

function scoreStakeholderPreparedness(useCase: UseCase): ReadinessFactor {
  const stakeholderDetail =
    useCase.affectedStakeholders.trim().split(/\s+/).length >= 4 ? 5 : 2;
  const ownerDetail = useCase.teamOwner.trim() ? 4 : 0;
  const reviewerDetail =
    useCase.assignedReviewer.trim() &&
    useCase.assignedReviewer !== "Unassigned"
      ? 3
      : 0;
  const oversightDetail =
    useCase.humanOversightPlanned === "YES"
      ? 5
      : useCase.humanOversightPlanned === "PARTIAL"
        ? 3
        : 0;

  return {
    score: Math.min(
      20,
      stakeholderDetail + ownerDetail + reviewerDetail + oversightDetail
    )
  };
}

function scoreAiReadiness(useCase: UseCase) {
  const text = proposalText(useCase);
  const dataAvailability = scoreFactor(
    text,
    [
      "approved data",
      "existing data",
      "historical",
      "records",
      "tickets",
      "questionnaires",
      "documents",
      "faq",
      "ats",
      "database",
      "structured"
    ],
    ["no data", "missing data", "unknown data", "new data", "unstructured"]
  );
  const processMaturity = scoreFactor(
    text,
    [
      "documented",
      "standard",
      "existing process",
      "current process",
      "review",
      "routing",
      "workflow",
      "criteria",
      "checklist"
    ],
    [
      "ad hoc",
      "undefined",
      "manual only",
      "no documented",
      "no process",
      "immature"
    ]
  );
  const implementationFeasibility = scoreImplementationTimeline(
    useCase.implementationTimeline
  );
  const stakeholderPreparedness = scoreStakeholderPreparedness(useCase);
  const technicalFeasibility = scoreFactor(
    text,
    [
      "summarize",
      "classify",
      "draft",
      "recommend",
      "rank",
      "extract",
      "search",
      "review",
      "pilot",
      "human review"
    ],
    [
      "fully automated",
      "real-time",
      "replace human",
      "without human",
      "production-wide",
      "unknown integration"
    ]
  );

  return clampScore(
    dataAvailability.score +
      processMaturity.score +
      implementationFeasibility.score +
      stakeholderPreparedness.score +
      technicalFeasibility.score
  );
}

export function scoreGovernanceRisk(useCase: UseCase, redFlags: RedFlag[]): RiskScore {
  const numericRiskScore = clampScore(
    (sensitivityWeight[useCase.dataSensitivity] ?? 10) +
      (impactWeight[useCase.decisionImpact] ?? 10) +
      (oversightWeight[useCase.humanOversightPlanned] ?? 0) +
      redFlags.reduce((total, flag) => total + severityWeight[flag.severity], 0)
  );

  const riskLevel =
    numericRiskScore >= 80
      ? "CRITICAL"
      : numericRiskScore >= 55
        ? "HIGH"
        : numericRiskScore >= 30
          ? "MEDIUM"
          : "LOW";

  const aiReadinessScore = scoreAiReadiness(useCase);

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
