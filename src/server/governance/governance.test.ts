import { describe, expect, it } from "vitest";
import type { UseCase } from "@/db/schema";
import { reviewStatusSchema } from "@/lib/validations";
import { detectRedFlags } from "./redFlags";
import { recommendGovernanceDecision } from "./recommendationEngine";
import { generateGovernanceReport } from "./generateGovernanceReport";
import { parseGovernanceReportJson } from "./reportTypes";
import { scoreGovernanceRisk } from "./riskScoring";

const baseUseCase: UseCase = {
  id: 1,
  title: "Internal FAQ summarization",
  department: "Information Technology",
  teamOwner: "Service Desk",
  currentProcess: "Support agents manually answer common questions.",
  proposedSolution: "Use AI to summarize approved FAQ entries for agents.",
  expectedBenefit: "Reduce repeat support effort.",
  dataSensitivity: "INTERNAL",
  decisionImpact: "LOW",
  humanOversightPlanned: "YES",
  affectedStakeholders: "Employees and service desk analysts",
  implementationTimeline: "4 weeks",
  status: "PENDING",
  createdAt: "2026-05-28 00:00:00",
  updatedAt: "2026-05-28 00:00:00"
};

describe("deterministic governance analysis", () => {
  it("detects HR applicant screening as a high-severity red flag", () => {
    const flags = detectRedFlags({
      ...baseUseCase,
      title: "Job applicant screening",
      department: "Human Resources",
      proposedSolution: "Use AI to rank resumes for hiring manager review.",
      dataSensitivity: "SENSITIVE",
      decisionImpact: "HIGH",
      humanOversightPlanned: "PARTIAL"
    });

    expect(flags.some((flag) => flag.issue === "HR or applicant workflow")).toBe(
      true
    );
    expect(flags.some((flag) => flag.severity === "HIGH")).toBe(true);
  });

  it("scores high-impact no-oversight proposals as critical risk", () => {
    const useCase = {
      ...baseUseCase,
      proposedSolution: "Use AI for fully automated approval decisions.",
      dataSensitivity: "SENSITIVE",
      decisionImpact: "HIGH",
      humanOversightPlanned: "NO"
    };

    const score = scoreGovernanceRisk(useCase, detectRedFlags(useCase));

    expect(score.riskLevel).toBe("CRITICAL");
    expect(score.aiReadinessScore).toBeLessThan(45);
  });

  it("maps low-risk proposals to approval and high-risk proposals to review", () => {
    expect(
      recommendGovernanceDecision({
        riskLevel: "LOW",
        aiReadinessScore: 90,
        redFlags: []
      })
    ).toBe("APPROVED");

    expect(
      recommendGovernanceDecision({
        riskLevel: "HIGH",
        aiReadinessScore: 40,
        redFlags: [
          {
            issue: "Sensitive workflow",
            severity: "HIGH",
            explanation: "Requires governance review."
          }
        ]
      })
    ).toBe("NEEDS_REVIEW");
  });

  it("parses valid report JSON safely and rejects invalid JSON", () => {
    const report = generateGovernanceReport(baseUseCase);

    expect(parseGovernanceReportJson(JSON.stringify(report))?.riskLevel).toBe(
      report.riskLevel
    );
    expect(parseGovernanceReportJson("{not valid")).toBeNull();
  });

  it("validates review status updates without allowing pending", () => {
    expect(reviewStatusSchema.safeParse("APPROVED_WITH_CONTROLS").success).toBe(
      true
    );
    expect(reviewStatusSchema.safeParse("PENDING").success).toBe(false);
  });
});
