import { describe, expect, it } from "vitest";
import type { GovernanceReport, UseCase } from "@/db/schema";
import { calculatePriority, prioritizePortfolio } from "./prioritization";

const baseProposal: Pick<
  UseCase,
  "id" | "dataSensitivity" | "decisionImpact" | "createdAt"
> = {
  id: 1,
  dataSensitivity: "INTERNAL",
  decisionImpact: "LOW",
  createdAt: "2026-05-28 00:00:00"
};

const baseReport: Pick<
  GovernanceReport,
  | "riskLevel"
  | "aiReadinessScore"
  | "finalRecommendation"
  | "reportJson"
  | "createdAt"
> = {
  riskLevel: "LOW",
  aiReadinessScore: 92,
  finalRecommendation: "APPROVED",
  reportJson: "{}",
  createdAt: "2026-05-28 00:00:00"
};

describe("portfolio prioritization", () => {
  it("scores low-risk high-readiness proposals as quick wins", () => {
    const priority = calculatePriority({
      proposal: baseProposal,
      report: baseReport
    });

    expect(priority.priorityScore).toBeGreaterThanOrEqual(75);
    expect(priority.priorityScore).toBeLessThanOrEqual(100);
    expect(priority.priorityCategory).toBe("Quick Win");
    expect(priority.explanation).toContain("High readiness");
  });

  it("routes high-risk proposals to governance review even with business impact", () => {
    const priority = calculatePriority({
      proposal: {
        ...baseProposal,
        dataSensitivity: "SENSITIVE",
        decisionImpact: "HIGH"
      },
      report: {
        ...baseReport,
        riskLevel: "HIGH",
        finalRecommendation: "NEEDS_REVIEW",
        aiReadinessScore: 66
      }
    });

    expect(priority.priorityCategory).toBe("Needs Governance Review");
    expect(priority.explanation).toContain("additional governance review");
  });

  it("ranks proposals by score and assigns sequential ranks", () => {
    const ranked = prioritizePortfolio([
      {
        proposal: {
          ...baseProposal,
          id: 1
        },
        report: {
          ...baseReport,
          riskLevel: "MEDIUM",
          aiReadinessScore: 70,
          finalRecommendation: "APPROVED_WITH_CONTROLS"
        }
      },
      {
        proposal: {
          ...baseProposal,
          id: 2
        },
        report: baseReport
      }
    ]);

    expect(ranked[0].proposal.id).toBe(2);
    expect(ranked[0].priorityRank).toBe(1);
    expect(ranked[1].priorityRank).toBe(2);
  });

  it("uses implementation complexity when it exists in report JSON", () => {
    const lowComplexity = calculatePriority({
      proposal: baseProposal,
      report: {
        ...baseReport,
        reportJson: JSON.stringify({ implementationComplexity: "LOW" })
      }
    });
    const highComplexity = calculatePriority({
      proposal: baseProposal,
      report: {
        ...baseReport,
        reportJson: JSON.stringify({ implementationComplexity: "HIGH" })
      }
    });

    expect(lowComplexity.priorityScore).toBeGreaterThan(
      highComplexity.priorityScore
    );
  });
});
