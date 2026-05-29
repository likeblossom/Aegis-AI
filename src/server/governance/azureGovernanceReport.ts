import type { UseCase } from "@/db/schema";
import type { GovernanceSignals } from "./generateGovernanceSignals";
import {
  governanceReportSchema,
  type GovernanceReportObject
} from "./reportTypes";

export const GOVERNANCE_PROMPT_VERSION = "governance-analysis-azure-v2.0";

const DEFAULT_AZURE_AI_MODEL = "gpt-4o-mini";
const DEFAULT_AZURE_OPENAI_API_VERSION = "2024-10-21";
const DEFAULT_AZURE_MODEL_INFERENCE_API_VERSION = "2025-04-01";
const DEFAULT_AZURE_TIMEOUT_MS = 30000;
const DEFAULT_AZURE_RETRY_COUNT = 1;

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

export function getAzureTimeoutMs() {
  const value = Number(process.env.AZURE_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AZURE_TIMEOUT_MS;
}

export function isRetryableAzureStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

export async function generateAzureGovernanceReport({
  useCase,
  signals
}: {
  useCase: UseCase;
  signals: GovernanceSignals;
}) {
  const apiKey = process.env.AZURE_AI_KEY;

  if (!apiKey) {
    throw new Error("AZURE_AI_KEY is not configured.");
  }

  const request = {
    url: buildAzureChatCompletionsUrl(),
    body: JSON.stringify(
      buildAzureChatCompletionsBody({ useCase, signals })
    )
  };

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= DEFAULT_AZURE_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetchWithTimeout(request.url, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: request.body
      });

      const body = (await response.json().catch(() => null)) as
        | AzureChatCompletionsResponse
        | null;

      if (!response.ok) {
        const message =
          body?.error?.message ?? `Azure AI request failed with ${response.status}.`;

        if (
          attempt < DEFAULT_AZURE_RETRY_COUNT &&
          isRetryableAzureStatus(response.status)
        ) {
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      if (!body) {
        throw new Error("Azure AI returned an empty response.");
      }

      const outputText = extractAzureMessageContent(body);

      if (!outputText) {
        throw new Error("Azure AI response did not include message content.");
      }

      return applyDeterministicGuardrails(
        governanceReportSchema.parse(JSON.parse(outputText)),
        signals
      );
    } catch (error) {
      lastError = error;

      if (attempt >= DEFAULT_AZURE_RETRY_COUNT) {
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Azure AI generation failed.");
}

export function buildAzureChatCompletionsBody({
  useCase,
  signals
}: {
  useCase: UseCase;
  signals: GovernanceSignals;
}) {
  return {
    ...(getAzureOpenAIDeployment() ? {} : { model: getAzureGovernanceModel() }),
    messages: [
      {
        role: "system",
        content:
          "You are an enterprise AI governance analyst. Produce stakeholder-ready governance report content for internal AI use-case proposals. You support human reviewers and must not claim to be the final decision-maker. Deterministic governance signals are authoritative guardrails. Return only valid JSON matching the requested schema."
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: GOVERNANCE_PROMPT_VERSION,
          expectedGenerationMetadata: {
            generationMode: "AZURE_OPENAI",
            modelDeployment: getAzureGovernanceModel(),
            promptVersion: GOVERNANCE_PROMPT_VERSION
          },
          proposal: useCase,
          deterministicSignals: signals,
          instructions: [
            "Generate the full structured governance report. Azure OpenAI is responsible for stakeholder-facing narrative, rationale, controls, rollout, executive briefing, challenger analysis, success metrics, assumptions, and change-management analysis.",
            "Preserve deterministic riskLevel exactly.",
            "Preserve deterministic finalRecommendation exactly.",
            "Preserve deterministic aiReadinessScore and confidenceLevel exactly.",
            "Preserve deterministicRedFlags exactly in the redFlags field and explain them.",
            "Do not downgrade or soften critical deterministic guardrail findings.",
            "Use guardrailWarnings as mandatory constraints for recommendations.",
            "Base findings only on the proposal and deterministic signals.",
            "Do not invent facts not supported by the proposal.",
            "Include assumptionsAndUncertainties when information is missing.",
            "Keep explanations concise, business-oriented, and practical for an early enterprise pilot.",
            "Set generationMetadata.generationMode to AZURE_OPENAI.",
            "Set generationMetadata.modelDeployment to the configured model or deployment name.",
            "Set generationMetadata.promptVersion to the provided promptVersion.",
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
    max_tokens: 6000
  };
}

export function applyDeterministicGuardrails(
  report: GovernanceReportObject,
  signals: GovernanceSignals
): GovernanceReportObject {
  return {
    ...report,
    redFlags: signals.deterministicRedFlags,
    riskLevel: signals.riskLevel,
    aiReadinessScore: signals.aiReadinessScore,
    finalRecommendation: signals.finalRecommendation,
    confidenceLevel: signals.confidenceLevel,
    generationMetadata: {
      generationMode: "AZURE_OPENAI",
      modelDeployment: getAzureGovernanceModel(),
      promptVersion: GOVERNANCE_PROMPT_VERSION
    }
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

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAzureTimeoutMs());

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Azure AI request timed out after ${getAzureTimeoutMs()}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
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

const changeManagementAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "affectedTeams",
    "adoptionRisk",
    "expectedResistance",
    "trainingNeeds",
    "communicationPlan",
    "mitigationActions"
  ],
  properties: {
    affectedTeams: { type: "array", items: { type: "string" } },
    adoptionRisk: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
    expectedResistance: { type: "array", items: { type: "string" } },
    trainingNeeds: { type: "array", items: { type: "string" } },
    communicationPlan: { type: "array", items: { type: "string" } },
    mitigationActions: { type: "array", items: { type: "string" } }
  }
};

const proposalChallengerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "reasonsThisMightFail",
    "assumptionsToValidate",
    "questionsForStakeholders"
  ],
  properties: {
    reasonsThisMightFail: { type: "array", items: { type: "string" } },
    assumptionsToValidate: { type: "array", items: { type: "string" } },
    questionsForStakeholders: { type: "array", items: { type: "string" } }
  }
};

const executiveBriefingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "recommendationSummary",
    "expectedBusinessValue",
    "topRisks",
    "requiredControls",
    "suggestedNextStep",
    "decisionQuestion"
  ],
  properties: {
    headline: { type: "string" },
    recommendationSummary: { type: "string" },
    expectedBusinessValue: { type: "string" },
    topRisks: { type: "array", items: { type: "string" } },
    requiredControls: { type: "array", items: { type: "string" } },
    suggestedNextStep: { type: "string" },
    decisionQuestion: { type: "string" }
  }
};

const generationMetadataSchema = {
  type: "object",
  additionalProperties: false,
  required: ["generationMode", "modelDeployment", "promptVersion"],
  properties: {
    generationMode: {
      type: "string",
      enum: ["AZURE_OPENAI", "LOCAL_FALLBACK"]
    },
    modelDeployment: { type: "string" },
    promptVersion: { type: "string" }
  }
};

const governanceReportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "executiveBriefing",
    "useCaseClassification",
    "governanceRiskAnalysis",
    "businessImpactAnalysis",
    "analysisRationale",
    "redFlags",
    "requiredControls",
    "rolloutStrategy",
    "changeManagementAnalysis",
    "stakeholderImpactAnalysis",
    "proposalChallenger",
    "successMetrics",
    "assumptionsAndUncertainties",
    "simulatedGovernanceReviews",
    "generationMetadata",
    "riskLevel",
    "aiReadinessScore",
    "finalRecommendation",
    "confidenceLevel"
  ],
  properties: {
    executiveSummary: { type: "string" },
    executiveBriefing: executiveBriefingSchema,
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
    changeManagementAnalysis: changeManagementAnalysisSchema,
    stakeholderImpactAnalysis: { type: "string" },
    proposalChallenger: proposalChallengerSchema,
    successMetrics: { type: "array", items: { type: "string" } },
    assumptionsAndUncertainties: { type: "array", items: { type: "string" } },
    simulatedGovernanceReviews: {
      type: "array",
      items: simulatedReviewSchema
    },
    generationMetadata: generationMetadataSchema,
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
