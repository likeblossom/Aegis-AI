import type { UseCase } from "@/db/schema";
import {
  governanceReportSchema,
  type GovernanceReportObject
} from "./reportTypes";

export const GOVERNANCE_PROMPT_VERSION = "governance-analysis-azure-v1.0";

const DEFAULT_AZURE_AI_MODEL = "gpt-4o-mini";
const DEFAULT_AZURE_OPENAI_API_VERSION = "2024-10-21";
const DEFAULT_AZURE_MODEL_INFERENCE_API_VERSION = "2025-04-01";

type AzureChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function isAzureGovernanceConfigured() {
  return Boolean(process.env.AZURE_AI_ENDPOINT && process.env.AZURE_AI_KEY);
}

export function getAzureGovernanceModel() {
  return (
    process.env.AZURE_AI_MODEL ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    DEFAULT_AZURE_AI_MODEL
  );
}

export function getAzureOpenAIDeployment() {
  return process.env.AZURE_OPENAI_DEPLOYMENT;
}

export function getAzureApiVersion() {
  return (
    process.env.AZURE_OPENAI_API_VERSION ??
    process.env.AZURE_AI_API_VERSION ??
    (getAzureOpenAIDeployment()
      ? DEFAULT_AZURE_OPENAI_API_VERSION
      : DEFAULT_AZURE_MODEL_INFERENCE_API_VERSION)
  );
}

export function buildAzureChatCompletionsUrl() {
  const endpoint = process.env.AZURE_AI_ENDPOINT;

  if (!endpoint) {
    throw new Error("AZURE_AI_ENDPOINT is not configured.");
  }

  const normalizedEndpoint = endpoint.replace(/\/$/, "");
  const apiVersion = getAzureApiVersion();

  if (normalizedEndpoint.endsWith("/chat/completions")) {
    return appendApiVersion(normalizedEndpoint, apiVersion);
  }

  const deployment = getAzureOpenAIDeployment();

  if (deployment || normalizedEndpoint.includes(".openai.azure.com")) {
    if (!deployment) {
      throw new Error(
        "AZURE_OPENAI_DEPLOYMENT is required for Azure OpenAI endpoints."
      );
    }

    return appendApiVersion(
      `${normalizedEndpoint}/openai/deployments/${encodeURIComponent(
        deployment
      )}/chat/completions`,
      apiVersion
    );
  }

  return appendApiVersion(
    `${normalizedEndpoint}/models/chat/completions`,
    apiVersion
  );
}

export function extractAzureMessageContent(body: AzureChatCompletionsResponse) {
  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

export async function generateAzureGovernanceReport({
  useCase,
  deterministicReport
}: {
  useCase: UseCase;
  deterministicReport: GovernanceReportObject;
}) {
  const apiKey = process.env.AZURE_AI_KEY;

  if (!apiKey) {
    throw new Error("AZURE_AI_KEY is not configured.");
  }

  const response = await fetch(buildAzureChatCompletionsUrl(), {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildAzureChatCompletionsBody({ useCase, deterministicReport }))
  });

  const body = (await response.json().catch(() => null)) as
    | AzureChatCompletionsResponse
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error?.message ?? `Azure AI request failed with ${response.status}.`
    );
  }

  if (!body) {
    throw new Error("Azure AI returned an empty response.");
  }

  const outputText = extractAzureMessageContent(body);

  if (!outputText) {
    throw new Error("Azure AI response did not include message content.");
  }

  return governanceReportSchema.parse(JSON.parse(outputText));
}

export function buildAzureChatCompletionsBody({
  useCase,
  deterministicReport
}: {
  useCase: UseCase;
  deterministicReport: GovernanceReportObject;
}) {
  return {
    ...(getAzureOpenAIDeployment() ? {} : { model: getAzureGovernanceModel() }),
      messages: [
        {
          role: "system",
          content:
            "You are an enterprise AI governance analyst. Produce explainable, evidence-based governance analysis for internal AI use-case proposals. You support human reviewers and must not claim to be the final decision-maker. Return only valid JSON matching the requested schema."
        },
        {
          role: "user",
          content: JSON.stringify({
            promptVersion: GOVERNANCE_PROMPT_VERSION,
            proposal: useCase,
            deterministicSignals: {
              redFlags: deterministicReport.redFlags,
              riskLevel: deterministicReport.riskLevel,
              aiReadinessScore: deterministicReport.aiReadinessScore,
              finalRecommendation: deterministicReport.finalRecommendation,
              confidenceLevel: deterministicReport.confidenceLevel
            },
            instructions: [
              "Preserve the existing report structure exactly.",
              "Use the deterministic red flags as required evidence, but expand the rationale and controls where useful.",
              "Base findings only on the proposal and deterministic signals.",
              "Keep recommendations practical for an early enterprise pilot.",
              "Use concise paragraphs and concrete governance language.",
              "Return JSON only."
            ]
          })
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "governance_report",
          strict: true,
          schema: governanceReportJsonSchema
        }
      },
      temperature: 0.2,
      max_tokens: 4000
  };
}

function appendApiVersion(url: string, apiVersion: string) {
  if (url.includes("api-version=")) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}api-version=${encodeURIComponent(
    apiVersion
  )}`;
}

const rationaleItemSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "finding",
    "whyItMatters",
    "evidenceFromProposal",
    "recommendedAction"
  ],
  properties: {
    finding: { type: "string" },
    whyItMatters: { type: "string" },
    evidenceFromProposal: { type: "string" },
    recommendedAction: { type: "string" }
  }
};

const redFlagSchema = {
  type: "object",
  additionalProperties: false,
  required: ["issue", "severity", "explanation"],
  properties: {
    issue: { type: "string" },
    severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    explanation: { type: "string" }
  }
};

const simulatedReviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reviewer", "concerns", "recommendations", "approvalConditions"],
  properties: {
    reviewer: { type: "string" },
    concerns: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    approvalConditions: { type: "array", items: { type: "string" } }
  }
};

const governanceReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "useCaseClassification",
    "governanceRiskAnalysis",
    "businessImpactAnalysis",
    "analysisRationale",
    "redFlags",
    "requiredControls",
    "rolloutStrategy",
    "simulatedGovernanceReviews",
    "riskLevel",
    "aiReadinessScore",
    "finalRecommendation",
    "confidenceLevel"
  ],
  properties: {
    executiveSummary: { type: "string" },
    useCaseClassification: {
      type: "object",
      additionalProperties: false,
      required: [
        "department",
        "dataSensitivity",
        "decisionImpact",
        "automationProfile"
      ],
      properties: {
        department: { type: "string" },
        dataSensitivity: { type: "string" },
        decisionImpact: { type: "string" },
        automationProfile: { type: "string" }
      }
    },
    governanceRiskAnalysis: { type: "string" },
    businessImpactAnalysis: { type: "string" },
    analysisRationale: { type: "array", items: rationaleItemSchema },
    redFlags: { type: "array", items: redFlagSchema },
    requiredControls: { type: "array", items: { type: "string" } },
    rolloutStrategy: { type: "array", items: { type: "string" } },
    simulatedGovernanceReviews: {
      type: "array",
      items: simulatedReviewSchema
    },
    riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
    aiReadinessScore: { type: "integer", minimum: 0, maximum: 100 },
    finalRecommendation: {
      type: "string",
      enum: [
        "APPROVED",
        "APPROVED_WITH_CONTROLS",
        "NEEDS_REVIEW",
        "REJECTED"
      ]
    },
    confidenceLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }
  }
};
