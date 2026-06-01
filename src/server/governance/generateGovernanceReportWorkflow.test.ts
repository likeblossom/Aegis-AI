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

describe("generateGovernanceReportWithWorkflow", () => {
  afterEach(() => {
    const rows = db
      .select()
      .from(useCases)
      .where(eq(useCases.title, baseUseCaseInput.title))
      .all();

    for (const row of rows) {
      db.delete(governanceReports)
        .where(eq(governanceReports.useCaseId, row.id))
        .run();
      db.delete(reviewerNotes).where(eq(reviewerNotes.useCaseId, row.id)).run();
      db.delete(auditLogs).where(eq(auditLogs.useCaseId, row.id)).run();
      db.delete(useCases).where(eq(useCases.id, row.id)).run();
    }
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
      "local_fallback",
      "validate_report",
      "persist_report"
    ]);

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

function createUseCase(): UseCase {
  return db.insert(useCases).values(baseUseCaseInput).returning().get();
}

function restoreEnv(key: string, value: string | undefined) {
  if (value) {
    process.env[key] = value;
  } else {
    delete process.env[key];
  }
}
