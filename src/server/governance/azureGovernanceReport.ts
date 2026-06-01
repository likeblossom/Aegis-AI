import type { UseCase } from "@/db/schema";
import { extractJsonObject } from "@/lib/extractJsonObject";
import { ZodError } from "zod";
import type { GovernanceSignals } from "./generateGovernanceSignals";
import {
  AzureGenerationError,
  classifyAzureError,
  getErrorMessage,
  isTransientAzureFailure
} from "./classifyAzureError";
import {
  governanceReportSchema,
  type GovernanceReportObject
} from "./reportTypes";

export const GOVERNANCE_PROMPT_VERSION = "governance-analysis-azure-v2.2";

const DEFAULT_AZURE_AI_MODEL = "gpt-4o-mini";
const DEFAULT_AZURE_OPENAI_API_VERSION = "2024-10-21";
const DEFAULT_AZURE_MODEL_INFERENCE_API_VERSION = "2025-04-01";
const DEFAULT_AZURE_TIMEOUT_MS = 30000;
const DEFAULT_AZURE_RETRY_COUNT = 2;

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
  if (!process.env.AZURE_AI_ENDPOINT || !process.env.AZURE_AI_KEY) {
    return false;
  }

  const normalizedEndpoint = process.env.AZURE_AI_ENDPOINT.replace(/\/$/, "");
  const usesAzureOpenAIResource =
    normalizedEndpoint.includes(".openai.azure.com") &&
    !normalizedEndpoint.endsWith("/chat/completions");

  return !usesAzureOpenAIResource || Boolean(getAzureOpenAIDeployment());
}

export function getAzureEndpointHost() {
  const endpoint = process.env.AZURE_AI_ENDPOINT;

  if (!endpoint) {
    return null;
  }

  try {
    return new URL(endpoint).hostname;
  } catch {
    return "invalid-endpoint-url";
  }
}

export function getAzureDiagnosticsContext() {
  return {
    deployment: getAzureGovernanceModel(),
    apiVersion: getAzureApiVersion(),
    endpointHost: getAzureEndpointHost(),
    env: {
      AZURE_AI_ENDPOINT: Boolean(process.env.AZURE_AI_ENDPOINT),
      AZURE_AI_KEY: Boolean(process.env.AZURE_AI_KEY),
      AZURE_AI_MODEL: Boolean(process.env.AZURE_AI_MODEL),
      AZURE_OPENAI_DEPLOYMENT: Boolean(process.env.AZURE_OPENAI_DEPLOYMENT),
      AZURE_OPENAI_API_VERSION: Boolean(process.env.AZURE_OPENAI_API_VERSION),
      AZURE_AI_API_VERSION: Boolean(process.env.AZURE_AI_API_VERSION)
    }
  };
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
    throw new AzureGenerationError({
      reason: "AZURE_NOT_CONFIGURED",
      message: "AZURE_AI_ENDPOINT is not configured."
    });
  }

  const normalizedEndpoint = endpoint.replace(/\/$/, "");
  const apiVersion = getAzureApiVersion();

  if (normalizedEndpoint.endsWith("/chat/completions")) {
    return appendApiVersion(normalizedEndpoint, apiVersion);
  }

  const deployment = getAzureOpenAIDeployment();

  if (deployment || normalizedEndpoint.includes(".openai.azure.com")) {
    if (!deployment) {
      throw new AzureGenerationError({
        reason: "AZURE_NOT_CONFIGURED",
        message: "AZURE_OPENAI_DEPLOYMENT is required for Azure OpenAI endpoints."
      });
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
    throw new AzureGenerationError({
      reason: "AZURE_NOT_CONFIGURED",
      message: "AZURE_AI_KEY is not configured."
    });
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
        const error = new AzureGenerationError({
          reason: classifyAzureError({ status: response.status, message }),
          message,
          status: response.status
        });

        if (
          attempt < DEFAULT_AZURE_RETRY_COUNT &&
          isTransientAzureFailure(error)
        ) {
          lastError = error;
          await sleep(backoffMs(attempt));
          continue;
        }

        throw error;
      }

      if (!body) {
        throw new AzureGenerationError({
          reason: "AZURE_UNKNOWN_ERROR",
          message: "Azure AI returned an empty response."
        });
      }

      const outputText = extractAzureMessageContent(body);

      if (!outputText) {
        throw new AzureGenerationError({
          reason: "AZURE_UNKNOWN_ERROR",
          message: "Azure AI response did not include message content."
        });
      }

      const extracted = extractJsonObject(outputText);

      if (!extracted.success) {
        throw new AzureGenerationError({
          reason: "AZURE_JSON_PARSE_FAILED",
          message: extracted.error
        });
      }

      const parsed = governanceReportSchema.safeParse(extracted.value);

      if (!parsed.success) {
        logSchemaValidationFailure(parsed.error);
        throw new AzureGenerationError({
          reason: "AZURE_SCHEMA_VALIDATION_FAILED",
          message: "Azure report failed schema validation.",
          cause: parsed.error
        });
      }

      return applyDeterministicGuardrails(
        parsed.data,
        signals
      );
    } catch (error) {
      lastError = error;

      if (
        attempt >= DEFAULT_AZURE_RETRY_COUNT ||
        !isTransientAzureFailure(error)
      ) {
        break;
      }

      await sleep(backoffMs(attempt));
    }
  }

  if (lastError instanceof AzureGenerationError) {
    throw lastError;
  }

  throw new AzureGenerationError({
    reason: classifyAzureError(lastError),
    message: getErrorMessage(lastError)
  });
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
            fallbackUsed: false,
            failureReason: null,
            azureDeployment: getAzureGovernanceModel(),
            apiVersion: getAzureApiVersion(),
            modelDeployment: getAzureGovernanceModel(),
            promptVersion: GOVERNANCE_PROMPT_VERSION
          },
          proposal: useCase,
          deterministicSignals: signals,
          instructions: [
            "Generate the full structured governance report. Azure OpenAI is responsible for stakeholder-facing narrative, rationale, controls, rollout, executive briefing, challenger analysis, success metrics, assumptions, change-management analysis, and assessmentBreakdown.",
            "Return valid JSON only. Do not include Markdown, code fences, prefaces, commentary, or explanatory text outside the JSON object.",
            "Enum values must exactly match the schema values.",
            "Allowed riskLevel values: LOW, MEDIUM, HIGH, CRITICAL.",
            "Allowed finalRecommendation values: APPROVED, APPROVED_WITH_CONTROLS, NEEDS_REVIEW, REJECTED.",
            "Allowed confidenceLevel and assessment confidence values: LOW, MEDIUM, HIGH.",
            "Allowed generationMetadata.generationMode values: AZURE_OPENAI, LOCAL_FALLBACK. Use AZURE_OPENAI for this response.",
            "assessmentBreakdown must evaluate businessValue, implementationComplexity, governanceRisk, changeManagementRisk, dataReadiness, humanOversightStrength, and strategicAlignment.",
            "For every assessment area, provide a 0-100 score, a distinct rationale, proposal-specific evidence, actionable improvement actions, and confidence.",
            "Evidence must quote or closely reference actual proposal content from fields such as currentProcess, proposedSolution, expectedBenefit, affectedStakeholders, implementationTimeline, dataSensitivity, decisionImpact, and humanOversightPlanned.",
            "Do not use generic evidence such as 'the proposal mentions governance' unless the specific proposal text is included.",
            "Improvement actions must be concrete actions a team can implement, such as mandatory human review, named owners, pilot metrics, data-source inventory, escalation criteria, or approval checkpoints.",
            "Avoid generic consulting language and do not repeat the same rationale across assessment categories.",
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
            "Set generationMetadata.fallbackUsed to false.",
            "Set generationMetadata.failureReason to null for successful Azure reports.",
            "Set generationMetadata.azureDeployment to the configured model or deployment name.",
            "Set generationMetadata.apiVersion to the configured Azure API version.",
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
      fallbackUsed: false,
      azureDeployment: getAzureGovernanceModel(),
      apiVersion: getAzureApiVersion(),
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
      throw new AzureGenerationError({
        reason: "AZURE_TIMEOUT",
        message: `Azure AI request timed out after ${getAzureTimeoutMs()}ms.`,
        cause: error
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number) {
  return 250 * 2 ** attempt;
}

function logSchemaValidationFailure(error: ZodError) {
  console.error("Azure governance report schema validation failed.", {
    fieldErrors: error.flatten().fieldErrors,
    formErrors: error.flatten().formErrors,
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message
    }))
  });
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

const assessmentAreaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "score",
    "rationale",
    "evidenceFromProposal",
    "improvementActions",
    "confidence"
  ],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    rationale: { type: "string" },
    evidenceFromProposal: {
      type: "array",
      minItems: 1,
      items: { type: "string" }
    },
    improvementActions: {
      type: "array",
      minItems: 1,
      items: { type: "string" }
    },
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }
  }
};

const assessmentBreakdownSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessValue",
    "implementationComplexity",
    "governanceRisk",
    "changeManagementRisk",
    "dataReadiness",
    "humanOversightStrength",
    "strategicAlignment"
  ],
  properties: {
    businessValue: assessmentAreaSchema,
    implementationComplexity: assessmentAreaSchema,
    governanceRisk: assessmentAreaSchema,
    changeManagementRisk: assessmentAreaSchema,
    dataReadiness: assessmentAreaSchema,
    humanOversightStrength: assessmentAreaSchema,
    strategicAlignment: assessmentAreaSchema
  }
};

const generationMetadataSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "generationMode",
    "fallbackUsed",
    "failureReason",
    "azureDeployment",
    "apiVersion",
    "modelDeployment",
    "promptVersion"
  ],
  properties: {
    generationMode: {
      type: "string",
      enum: ["AZURE_OPENAI", "LOCAL_FALLBACK"]
    },
    fallbackUsed: { type: "boolean" },
    failureReason: {
      type: ["string", "null"],
      enum: [
        null,
        "AZURE_NOT_CONFIGURED",
        "AZURE_UNAUTHORIZED",
        "AZURE_FORBIDDEN",
        "AZURE_DEPLOYMENT_NOT_FOUND",
        "AZURE_RATE_LIMITED",
        "AZURE_CONTENT_FILTERED",
        "AZURE_BAD_REQUEST",
        "AZURE_TIMEOUT",
        "AZURE_JSON_PARSE_FAILED",
        "AZURE_SCHEMA_VALIDATION_FAILED",
        "AZURE_UNKNOWN_ERROR"
      ]
    },
    azureDeployment: { type: "string" },
    apiVersion: { type: "string" },
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
    "assessmentBreakdown",
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
    assessmentBreakdown: assessmentBreakdownSchema,
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
