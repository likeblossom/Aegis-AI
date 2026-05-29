import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
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

  it("persists deterministic fallback reports when Azure is not configured", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    delete process.env.AZURE_AI_ENDPOINT;
    delete process.env.AZURE_AI_KEY;

    const useCase = createUseCase();
    const result = await generateGovernanceReportWithWorkflow(useCase);

    expect(result.analysisMode).toBe("deterministic");
    expect(result.fallbackReason).toBeNull();
    expect(result.reportRecord.reportVersion).toBe(1);
    expect(result.reportRecord.generationProvider).toBe("deterministic");
    expect(result.workflowRunId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(result.workflowPath).toEqual([
      "deterministic_analysis",
      "validate_report",
      "persist_report"
    ]);

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
