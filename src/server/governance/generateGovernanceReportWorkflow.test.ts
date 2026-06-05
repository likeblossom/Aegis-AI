import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import {
  auditLogs,
  governanceReports,
  reviewerNotes,
  type UseCase,
  useCases
} from "@/db/schema";
import { generateGovernanceReportWithWorkflow } from "./generateGovernanceReportWorkflow";

const baseUseCaseInput = {
  title: "Workflow test proposal",
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
  status: "PENDING"
};

const createdUseCaseIds: number[] = [];

describe("generateGovernanceReportWithWorkflow", () => {
  afterEach(() => {
    for (const id of createdUseCaseIds) {
      db.delete(governanceReports)
        .where(eq(governanceReports.useCaseId, id))
        .run();
      db.delete(reviewerNotes).where(eq(reviewerNotes.useCaseId, id)).run();
      db.delete(auditLogs).where(eq(auditLogs.useCaseId, id)).run();
      db.delete(useCases).where(eq(useCases.id, id)).run();
    }
    createdUseCaseIds.length = 0;
  });

  it("persists local fallback reports when Azure is not configured", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    delete process.env.AZURE_AI_ENDPOINT;
    delete process.env.AZURE_AI_KEY;

    const useCase = createUseCase();
    const result = await generateGovernanceReportWithWorkflow(useCase);

    expect(result.analysisMode).toBe("LOCAL_FALLBACK");
    expect(result.fallbackReason).toBe("AZURE_NOT_CONFIGURED");
    expect(result.report.generationMetadata).toMatchObject({
      generationMode: "LOCAL_FALLBACK",
      fallbackUsed: true,
      failureReason: "AZURE_NOT_CONFIGURED"
    });
    expect(result.reportRecord.reportVersion).toBe(1);
    expect(result.reportRecord.generationProvider).toBe("LOCAL_FALLBACK");
    expect(result.workflowRunId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(result.workflowPath).toEqual([
      "deterministic_analysis",
      "risk_triage",
      "portfolio_prioritizer",
      "local_fallback",
      "synthesis",
      "validate_report",
      "persist_report"
    ]);
    expect(result.report.workflowTrace).toMatchObject({
      runId: result.workflowRunId,
      path: result.workflowPath,
      reviewerNodesExecuted: ["risk_triage", "portfolio_prioritizer"],
      humanReviewRequired: false
    });
    expect(result.report.workflowTrace.agentFindings).toHaveLength(2);
    expect(result.report.workflowTrace.agentFindings[0]).toMatchObject({
      agent: "risk_triage",
      summary: expect.stringContaining(baseUseCaseInput.title),
      evidence: expect.arrayContaining([
        expect.stringContaining(baseUseCaseInput.proposedSolution)
      ]),
      controlRationale: expect.stringContaining("accountability")
    });
    expect(result.report.workflowTrace.routingDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "risk_triage",
          to: "portfolio_prioritizer"
        })
      ])
    );

    const reportAuditLogs = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.useCaseId, useCase.id))
      .all();
    const reportAuditLog = reportAuditLogs.find(
      (log) => log.action === "REPORT_GENERATED_FALLBACK"
    );
    const assessmentAuditLog = reportAuditLogs.find(
      (log) => log.action === "ASSESSMENT_BREAKDOWN_GENERATED"
    );

    expect(reportAuditLog?.note).toBe(
      "Azure OpenAI generation failed. Azure is not configured. Set AZURE_AI_ENDPOINT and AZURE_AI_KEY. Local fallback report generated."
    );
    expect(reportAuditLog?.note).not.toContain(result.workflowRunId);
    expect(assessmentAuditLog?.note).toBe(
      "Detailed AI assessment breakdown generated."
    );

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
  });

  it("increments report versions for repeated workflow runs", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    delete process.env.AZURE_AI_ENDPOINT;
    delete process.env.AZURE_AI_KEY;

    const useCase = createUseCase();
    await generateGovernanceReportWithWorkflow(useCase);
    const second = await generateGovernanceReportWithWorkflow(useCase);

    expect(second.reportRecord.reportVersion).toBe(2);

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
  });

  it("routes sensitive high-impact proposals through privacy, oversight, and change reviewers", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    delete process.env.AZURE_AI_ENDPOINT;
    delete process.env.AZURE_AI_KEY;

    const useCase = createUseCase({
      dataSensitivity: "SENSITIVE",
      decisionImpact: "HIGH",
      affectedStakeholders: "Employees, managers, and compliance team",
      proposedSolution:
        "Use AI to recommend eligibility decisions for manager review."
    });
    const result = await generateGovernanceReportWithWorkflow(useCase);

    expect(result.workflowPath).toEqual([
      "deterministic_analysis",
      "risk_triage",
      "data_privacy_reviewer",
      "human_oversight_reviewer",
      "change_management_reviewer",
      "portfolio_prioritizer",
      "local_fallback",
      "synthesis",
      "validate_report",
      "persist_report"
    ]);
    expect(result.report.workflowTrace.humanReviewRequired).toBe(true);
    expect(result.report.workflowTrace.reviewerNodesExecuted).toEqual([
      "risk_triage",
      "data_privacy_reviewer",
      "human_oversight_reviewer",
      "change_management_reviewer",
      "portfolio_prioritizer"
    ]);
    expect(result.report.workflowTrace.agentFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agent: "data_privacy_reviewer",
          summary: expect.stringContaining("Sensitive data"),
          evidence: expect.arrayContaining([
            expect.stringContaining("Employees, managers, and compliance team")
          ]),
          recommendedControls: expect.arrayContaining([
            expect.stringContaining("prompts")
          ])
        }),
        expect.objectContaining({
          agent: "change_management_reviewer",
          findings: expect.arrayContaining([
            expect.stringContaining("adoption metrics")
          ])
        })
      ])
    );

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
  });

  it("routes HR proposals without oversight through critical review", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    delete process.env.AZURE_AI_ENDPOINT;
    delete process.env.AZURE_AI_KEY;

    const useCase = createUseCase({
      department: "Human Resources",
      currentProcess: "Recruiters manually screen candidates.",
      proposedSolution:
        "Use AI to rank applicants and reject low-scoring candidates.",
      decisionImpact: "HIGH",
      humanOversightPlanned: "NO",
      affectedStakeholders: "Candidates, recruiters, and hiring managers"
    });
    const result = await generateGovernanceReportWithWorkflow(useCase);
    const triageFinding = result.report.workflowTrace.agentFindings.find(
      (finding) => finding.agent === "risk_triage"
    );

    expect(result.report.workflowTrace.humanReviewRequired).toBe(true);
    expect(triageFinding?.findings[0]).toContain("critical");
    expect(triageFinding?.evidence.join(" ")).toContain(
      "HR or applicant workflow"
    );
    expect(result.workflowPath).toContain("human_oversight_reviewer");
    expect(result.workflowPath).toContain("change_management_reviewer");

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
  });

  it("persists schema validation fallback metadata and audit reason", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalFetch = global.fetch;

    process.env.AZURE_AI_ENDPOINT = "https://example.openai.azure.com";
    process.env.AZURE_AI_KEY = "test-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "{\"riskLevel\":\"INVALID\"}" } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const useCase = createUseCase();
    const result = await generateGovernanceReportWithWorkflow(useCase);
    const reportAuditLog = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.useCaseId, useCase.id))
      .all()
      .find((log) => log.action === "REPORT_GENERATED_FALLBACK");

    expect(result.analysisMode).toBe("LOCAL_FALLBACK");
    expect(result.fallbackReason).toBe("AZURE_SCHEMA_VALIDATION_FAILED");
    expect(result.report.generationMetadata.failureReason).toBe(
      "AZURE_SCHEMA_VALIDATION_FAILED"
    );
    expect(result.report.workflowTrace.path).toEqual(result.workflowPath);
    expect(result.report.workflowTrace.agentFindings.length).toBeGreaterThan(0);
    expect(reportAuditLog?.note).toBe(
      "Azure OpenAI generation failed. Azure response did not match the expected report schema. Local fallback report generated."
    );

    global.fetch = originalFetch;
    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
    vi.restoreAllMocks();
  });
});

function createUseCase(
  overrides: Partial<typeof baseUseCaseInput> = {}
): UseCase {
  const row = db
    .insert(useCases)
    .values({ ...baseUseCaseInput, ...overrides })
    .returning()
    .get();
  createdUseCaseIds.push(row.id);
  return row;
}

function restoreEnv(key: string, value: string | undefined) {
  if (value) {
    process.env[key] = value;
  } else {
    delete process.env[key];
  }
}
