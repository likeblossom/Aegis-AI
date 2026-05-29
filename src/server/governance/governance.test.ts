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
  assignedReviewer: "IT Governance",
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
    expect(score.aiReadinessScore).toBeGreaterThanOrEqual(0);
    expect(score.aiReadinessScore).toBeLessThanOrEqual(100);
  });

  it("separates high AI readiness from high governance risk", () => {
    const useCase = {
      ...baseUseCase,
      title: "Resume screening assistant",
      department: "Human Resources",
      teamOwner: "Talent Operations",
      currentProcess:
        "Recruiters use a documented workflow, ATS records, historical resumes, and standard hiring criteria for initial review.",
      proposedSolution:
        "Use AI to rank resumes and recommend candidates for recruiter review, with human review before any decision.",
      expectedBenefit:
        "Reduce screening time while preserving documented recruiter accountability.",
      dataSensitivity: "SENSITIVE",
      decisionImpact: "HIGH",
      humanOversightPlanned: "PARTIAL",
      affectedStakeholders:
        "Applicants, recruiters, hiring managers, HR compliance, and talent operations",
      implementationTimeline: "8 weeks",
      assignedReviewer: "HR Governance"
    };

    const score = scoreGovernanceRisk(useCase, detectRedFlags(useCase));

    expect(score.riskLevel).toBe("CRITICAL");
    expect(score.aiReadinessScore).toBeGreaterThanOrEqual(70);
    expect(score.aiReadinessScore).toBeLessThanOrEqual(80);
  });

  it("scores high AI readiness with low governance risk", () => {
    const useCase = {
      ...baseUseCase,
      currentProcess:
        "Service desk analysts use a documented workflow, existing FAQ documents, ticket records, and a standard review checklist.",
      proposedSolution:
        "Use AI to summarize approved FAQ entries and draft responses for analyst review.",
      expectedBenefit:
        "Reduce repeat support effort while improving consistency in documented answers.",
      dataSensitivity: "INTERNAL",
      decisionImpact: "LOW",
      humanOversightPlanned: "YES",
      affectedStakeholders:
        "Employees, service desk analysts, knowledge managers, and IT operations",
      implementationTimeline: "6 weeks",
      assignedReviewer: "IT Governance"
    };

    const score = scoreGovernanceRisk(useCase, detectRedFlags(useCase));

    expect(score.riskLevel).toBe("LOW");
    expect(score.aiReadinessScore).toBeGreaterThanOrEqual(75);
  });

  it("scores low AI readiness with high governance risk", () => {
    const useCase = {
      ...baseUseCase,
      title: "Automated candidate rejection",
      department: "Human Resources",
      teamOwner: "Talent Operations",
      currentProcess:
        "The current process is ad hoc and undefined with missing data and no documented criteria.",
      proposedSolution:
        "Use a fully automated system to reject candidates without human review.",
      expectedBenefit: "Speed up hiring decisions.",
      dataSensitivity: "SENSITIVE",
      decisionImpact: "HIGH",
      humanOversightPlanned: "NO",
      affectedStakeholders: "Applicants",
      implementationTimeline: "TBD",
      assignedReviewer: "Unassigned"
    };

    const score = scoreGovernanceRisk(useCase, detectRedFlags(useCase));

    expect(score.riskLevel).toBe("CRITICAL");
    expect(score.aiReadinessScore).toBeLessThan(45);
  });

  it("scores low AI readiness with low governance risk", () => {
    const useCase = {
      ...baseUseCase,
      title: "Internal document helper",
      currentProcess:
        "The current process is ad hoc with unknown data sources and no documented workflow.",
      proposedSolution:
        "Explore whether AI could help employees with non-sensitive internal notes.",
      expectedBenefit: "Potential productivity benefit.",
      dataSensitivity: "PUBLIC",
      decisionImpact: "LOW",
      humanOversightPlanned: "YES",
      affectedStakeholders: "Employees",
      implementationTimeline: "Unknown",
      assignedReviewer: "Unassigned"
    };

    const score = scoreGovernanceRisk(useCase, detectRedFlags(useCase));

    expect(score.riskLevel).toBe("LOW");
    expect(score.aiReadinessScore).toBeLessThan(50);
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

  it("includes change management impact analysis in generated reports", () => {
    const report = generateGovernanceReport({
      ...baseUseCase,
      affectedStakeholders:
        "Employees, service desk analysts, knowledge managers, and IT operations",
      decisionImpact: "HIGH",
      dataSensitivity: "CONFIDENTIAL",
      humanOversightPlanned: "PARTIAL"
    });

    expect(report.changeManagementAnalysis.affectedTeams).toContain(
      "Information Technology"
    );
    expect(report.changeManagementAnalysis.adoptionRisk).toBe("High");
    expect(report.changeManagementAnalysis.expectedResistance.length).toBeGreaterThan(
      0
    );
    expect(report.changeManagementAnalysis.trainingNeeds.length).toBeGreaterThan(0);
    expect(report.changeManagementAnalysis.communicationPlan.length).toBeGreaterThan(
      0
    );
    expect(report.changeManagementAnalysis.mitigationActions.length).toBeGreaterThan(
      0
    );
  });

  it("includes a concise executive briefing in generated reports", () => {
    const report = generateGovernanceReport(baseUseCase);

    expect(report.executiveBriefing.headline).toContain(baseUseCase.title);
    expect(report.executiveBriefing.recommendationSummary.length).toBeGreaterThan(
      0
    );
    expect(report.executiveBriefing.expectedBusinessValue).toContain(
      baseUseCase.expectedBenefit
    );
    expect(report.executiveBriefing.topRisks.length).toBeGreaterThan(0);
    expect(report.executiveBriefing.requiredControls.length).toBeGreaterThan(0);
    expect(report.executiveBriefing.suggestedNextStep.length).toBeGreaterThan(0);
    expect(report.executiveBriefing.decisionQuestion).toContain("?");
  });

  it("parses older report JSON without change management analysis", () => {
    const report = generateGovernanceReport(baseUseCase);
    const {
      executiveBriefing: _executiveBriefing,
      changeManagementAnalysis: _changeManagementAnalysis,
      ...legacyReport
    } = report;

    const parsed = parseGovernanceReportJson(JSON.stringify(legacyReport));

    expect(parsed?.executiveBriefing.headline).toBe(
      "Executive briefing unavailable"
    );
    expect(parsed?.changeManagementAnalysis).toEqual({
      affectedTeams: [],
      adoptionRisk: "Low",
      expectedResistance: [],
      trainingNeeds: [],
      communicationPlan: [],
      mitigationActions: []
    });
  });

  it("validates review status updates without allowing pending", () => {
    expect(reviewStatusSchema.safeParse("APPROVED_WITH_CONTROLS").success).toBe(
      true
    );
    expect(reviewStatusSchema.safeParse("PENDING").success).toBe(false);
  });
});
