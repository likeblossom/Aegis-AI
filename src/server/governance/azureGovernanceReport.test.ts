import { afterEach, describe, expect, it, vi } from "vitest";
import type { UseCase } from "@/db/schema";
import { AzureGenerationError } from "./classifyAzureError";
import {
  applyDeterministicGuardrails,
  buildAzureChatCompletionsBody,
  buildAzureChatCompletionsUrl,
  extractAzureMessageContent,
  generateAzureGovernanceReport,
  getAzureApiVersion,
  getAzureGovernanceModel,
  getAzureTimeoutMs,
  isRetryableAzureStatus,
  isAzureGovernanceConfigured
} from "./azureGovernanceReport";
import { generateGovernanceReport } from "./generateGovernanceReport";
import { generateGovernanceSignals } from "./generateGovernanceSignals";

describe("Azure governance report integration helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects whether Azure governance generation is configured", () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    delete process.env.AZURE_AI_ENDPOINT;
    delete process.env.AZURE_AI_KEY;

    expect(isAzureGovernanceConfigured()).toBe(false);

    process.env.AZURE_AI_ENDPOINT = "https://example.services.ai.azure.com";
    process.env.AZURE_AI_KEY = "test-key";
    expect(isAzureGovernanceConfigured()).toBe(true);

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
  });

  it("builds the Azure chat completions URL from either resource or route URL", () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalApiVersion = process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_API_VERSION;

    process.env.AZURE_AI_ENDPOINT = "https://example.services.ai.azure.com/";
    expect(buildAzureChatCompletionsUrl()).toBe(
      "https://example.services.ai.azure.com/models/chat/completions?api-version=2025-04-01"
    );

    process.env.AZURE_AI_ENDPOINT =
      "https://example.services.ai.azure.com/models/chat/completions";
    expect(buildAzureChatCompletionsUrl()).toBe(
      "https://example.services.ai.azure.com/models/chat/completions?api-version=2025-04-01"
    );

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
    restoreEnv("AZURE_OPENAI_API_VERSION", originalApiVersion);
  });

  it("builds Azure OpenAI deployment URLs when a deployment is configured", () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalApiVersion = process.env.AZURE_OPENAI_API_VERSION;

    process.env.AZURE_AI_ENDPOINT = "https://example.openai.azure.com";
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    process.env.AZURE_OPENAI_API_VERSION = "2024-10-21";

    expect(buildAzureChatCompletionsUrl()).toBe(
      "https://example.openai.azure.com/openai/deployments/governance-model/chat/completions?api-version=2024-10-21"
    );

    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
    restoreEnv("AZURE_OPENAI_API_VERSION", originalApiVersion);
  });

  it("uses a stable default model unless AZURE_AI_MODEL is provided", () => {
    const originalModel = process.env.AZURE_AI_MODEL;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    delete process.env.AZURE_AI_MODEL;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;

    expect(getAzureGovernanceModel()).toBe("gpt-4o-mini");

    process.env.AZURE_AI_MODEL = "custom-model";
    expect(getAzureGovernanceModel()).toBe("custom-model");

    restoreEnv("AZURE_AI_MODEL", originalModel);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
  });

  it("uses Azure OpenAI API version when a deployment is configured", () => {
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalApiVersion = process.env.AZURE_OPENAI_API_VERSION;
    const originalAiVersion = process.env.AZURE_AI_API_VERSION;

    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.AZURE_AI_API_VERSION;
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    expect(getAzureApiVersion()).toBe("2024-10-21");

    process.env.AZURE_OPENAI_API_VERSION = "2024-08-01-preview";
    expect(getAzureApiVersion()).toBe("2024-08-01-preview");

    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
    restoreEnv("AZURE_OPENAI_API_VERSION", originalApiVersion);
    restoreEnv("AZURE_AI_API_VERSION", originalAiVersion);
  });

  it("omits model from the body for Azure OpenAI deployment endpoints", () => {
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";

    const body = buildAzureChatCompletionsBody({
      useCase: baseUseCase,
      signals: generateGovernanceSignals(baseUseCase)
    });

    expect("model" in body).toBe(false);
    const bodyText = JSON.stringify(body);
    expect(bodyText).toContain("deterministicSignals");
    expect(bodyText).toContain("guardrailWarnings");
    expect(bodyText).toContain("Preserve deterministic riskLevel exactly");
    expect(bodyText).toContain("assessmentBreakdown");
    expect(bodyText).toContain("proposal-specific evidence");

    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
  });

  it("parses Azure assessment breakdown output and reapplies guardrails", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalFetch = global.fetch;
    const signals = generateGovernanceSignals(baseUseCase);
    const azureReport = {
      ...generateGovernanceReport(baseUseCase),
      generationMetadata: {
        generationMode: "AZURE_OPENAI" as const,
        fallbackUsed: false,
        azureDeployment: "governance-model",
        apiVersion: "2024-10-21",
        modelDeployment: "governance-model",
        promptVersion: "governance-analysis-azure-v2.2"
      }
    };

    process.env.AZURE_AI_ENDPOINT = "https://example.openai.azure.com";
    process.env.AZURE_AI_KEY = "test-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(azureReport) } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const report = await generateAzureGovernanceReport({
      useCase: baseUseCase,
      signals
    });

    expect(report.assessmentBreakdown.businessValue.score).toBeGreaterThanOrEqual(
      0
    );
    expect(report.assessmentBreakdown.businessValue.score).toBeLessThanOrEqual(100);
    expect(
      report.assessmentBreakdown.businessValue.evidenceFromProposal[0]
    ).toContain(baseUseCase.expectedBenefit);
    expect(
      report.assessmentBreakdown.businessValue.improvementActions.length
    ).toBeGreaterThan(0);
    expect(report.riskLevel).toBe(signals.riskLevel);
    expect(report.generationMetadata.fallbackUsed).toBe(false);

    global.fetch = originalFetch;
    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
  });

  it("extracts JSON from Azure responses with surrounding text", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalFetch = global.fetch;
    const signals = generateGovernanceSignals(baseUseCase);
    const azureReport = {
      ...generateGovernanceReport(baseUseCase),
      generationMetadata: {
        generationMode: "AZURE_OPENAI" as const,
        fallbackUsed: false,
        azureDeployment: "governance-model",
        apiVersion: "2024-10-21",
        modelDeployment: "governance-model",
        promptVersion: "governance-analysis-azure-v2.2"
      }
    };

    process.env.AZURE_AI_ENDPOINT = "https://example.openai.azure.com";
    process.env.AZURE_AI_KEY = "test-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `Here is the report:\n${JSON.stringify(azureReport)}`
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const report = await generateAzureGovernanceReport({
      useCase: baseUseCase,
      signals
    });

    expect(report.generationMetadata.generationMode).toBe("AZURE_OPENAI");

    global.fetch = originalFetch;
    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
  });

  it("classifies and logs Azure schema validation failures", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalFetch = global.fetch;
    const invalidReport = {
      ...generateGovernanceReport(baseUseCase),
      riskLevel: "NOT_ALLOWED"
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    process.env.AZURE_AI_ENDPOINT = "https://example.openai.azure.com";
    process.env.AZURE_AI_KEY = "test-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(invalidReport) } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    await expect(
      generateAzureGovernanceReport({
        useCase: baseUseCase,
        signals: generateGovernanceSignals(baseUseCase)
      })
    ).rejects.toMatchObject({
      reason: "AZURE_SCHEMA_VALIDATION_FAILED"
    } satisfies Partial<AzureGenerationError>);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Azure governance report schema validation failed.",
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ path: "riskLevel" })
        ])
      })
    );

    global.fetch = originalFetch;
    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
  });

  it("retries transient Azure failures before succeeding", async () => {
    const originalEndpoint = process.env.AZURE_AI_ENDPOINT;
    const originalKey = process.env.AZURE_AI_KEY;
    const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const originalFetch = global.fetch;
    const signals = generateGovernanceSignals(baseUseCase);
    const azureReport = {
      ...generateGovernanceReport(baseUseCase),
      generationMetadata: {
        generationMode: "AZURE_OPENAI" as const,
        fallbackUsed: false,
        azureDeployment: "governance-model",
        apiVersion: "2024-10-21",
        modelDeployment: "governance-model",
        promptVersion: "governance-analysis-azure-v2.2"
      }
    };
    let callCount = 0;

    process.env.AZURE_AI_ENDPOINT = "https://example.openai.azure.com";
    process.env.AZURE_AI_KEY = "test-key";
    process.env.AZURE_OPENAI_DEPLOYMENT = "governance-model";
    global.fetch = async () => {
      callCount += 1;

      if (callCount === 1) {
        return new Response(
          JSON.stringify({ error: { message: "Rate limit exceeded." } }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(azureReport) } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const report = await generateAzureGovernanceReport({
      useCase: baseUseCase,
      signals
    });

    expect(callCount).toBe(2);
    expect(report.generationMetadata.generationMode).toBe("AZURE_OPENAI");

    global.fetch = originalFetch;
    restoreEnv("AZURE_AI_ENDPOINT", originalEndpoint);
    restoreEnv("AZURE_AI_KEY", originalKey);
    restoreEnv("AZURE_OPENAI_DEPLOYMENT", originalDeployment);
  });

  it("enforces deterministic guardrails over Azure report output", () => {
    const signals = generateGovernanceSignals({
      ...baseUseCase,
      title: "Resume screening assistant",
      department: "Human Resources",
      proposedSolution: "Use AI to rank resumes for recruiter review.",
      dataSensitivity: "SENSITIVE",
      decisionImpact: "HIGH",
      humanOversightPlanned: "PARTIAL"
    });
    const azureReport = {
      ...generateGovernanceReport(baseUseCase),
      riskLevel: "LOW" as const,
      aiReadinessScore: 100,
      finalRecommendation: "APPROVED" as const,
      confidenceLevel: "LOW" as const,
      redFlags: []
    };

    const report = applyDeterministicGuardrails(azureReport, signals);

    expect(report.riskLevel).toBe(signals.riskLevel);
    expect(report.finalRecommendation).toBe(signals.finalRecommendation);
    expect(report.aiReadinessScore).toBe(signals.aiReadinessScore);
    expect(report.confidenceLevel).toBe(signals.confidenceLevel);
    expect(report.redFlags).toEqual(signals.deterministicRedFlags);
    expect(report.generationMetadata.generationMode).toBe("AZURE_OPENAI");
  });

  it("extracts chat completion message content", () => {
    expect(
      extractAzureMessageContent({
        choices: [{ message: { content: "{\"ok\":true}" } }]
      })
    ).toBe("{\"ok\":true}");

    expect(extractAzureMessageContent({ choices: [] })).toBeNull();
  });

  it("identifies retryable Azure response statuses", () => {
    expect(isRetryableAzureStatus(429)).toBe(true);
    expect(isRetryableAzureStatus(500)).toBe(true);
    expect(isRetryableAzureStatus(400)).toBe(false);
  });

  it("uses a default Azure timeout unless configured", () => {
    const originalTimeout = process.env.AZURE_AI_TIMEOUT_MS;
    delete process.env.AZURE_AI_TIMEOUT_MS;

    expect(getAzureTimeoutMs()).toBe(30000);

    process.env.AZURE_AI_TIMEOUT_MS = "12000";
    expect(getAzureTimeoutMs()).toBe(12000);

    restoreEnv("AZURE_AI_TIMEOUT_MS", originalTimeout);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value) {
    process.env[key] = value;
  } else {
    delete process.env[key];
  }
}

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
