import type { OpportunityDiscoveryInput } from "./discoveryTypes";
import {
  opportunityDiscoveryResultSchema,
  type OpportunityDiscoveryResult
} from "./discoveryTypes";
import {
  buildAzureChatCompletionsUrl,
  extractAzureMessageContent,
  getAzureGovernanceModel,
  getAzureOpenAIDeployment,
  getAzureTimeoutMs,
  isAzureGovernanceConfigured
} from "@/server/governance/azureGovernanceReport";

export const DISCOVERY_PROMPT_VERSION = "opportunity-discovery-v1.0";
export const LOCAL_DISCOVERY_PROMPT_VERSION =
  "local-opportunity-discovery-v1.0";

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

export async function generateOpportunityDiscovery(
  input: OpportunityDiscoveryInput
): Promise<OpportunityDiscoveryResult> {
  if (isAzureGovernanceConfigured()) {
    try {
      return await generateAzureOpportunityDiscovery(input);
    } catch {
      return generateLocalOpportunityDiscovery(input);
    }
  }

  return generateLocalOpportunityDiscovery(input);
}

export function generateLocalOpportunityDiscovery(
  input: OpportunityDiscoveryInput
): OpportunityDiscoveryResult {
  const teamLabel = input.affectedTeams;
  const goalText = input.goals || "improve cycle time, consistency, and follow-up";
  const opportunities = [
    {
      title: `${input.department} workflow summarization assistant`,
      description:
        "Summarize meetings, notes, or long-form updates into structured action items for the affected teams.",
      aiApproach:
        "Use generative AI to produce concise summaries, missing-information lists, and follow-up drafts for human review.",
      expectedBenefits: [
        "Reduce time spent documenting repetitive work",
        "Improve consistency of follow-up communication",
        "Make handoffs easier for coordinators and reviewers"
      ],
      implementationComplexity: "Low" as const,
      estimatedBusinessValue: "Medium" as const,
      confidence: "High" as const,
      reasoning: `The problem describes manual documentation and coordination pain for ${teamLabel}, which fits a human-reviewed summarization and follow-up workflow.`
    },
    {
      title: `${input.department} intake triage assistant`,
      description:
        "Classify incoming work, identify missing information, and recommend next handling steps before a human owner proceeds.",
      aiApproach:
        "Use AI classification and extraction to organize requests, flag gaps, and route items to the right team queue.",
      expectedBenefits: [
        "Reduce back-and-forth caused by incomplete requests",
        "Improve prioritization and routing consistency",
        "Create clearer status visibility for stakeholders"
      ],
      implementationComplexity: "Medium" as const,
      estimatedBusinessValue: "High" as const,
      confidence: "Medium" as const,
      reasoning: `The stated pain points suggest repeatable intake and follow-up gaps. Triage support is practical if ${input.department} has consistent request patterns.`
    },
    {
      title: `${input.department} knowledge retrieval assistant`,
      description:
        "Help users find approved procedures, prior examples, and next-step guidance related to the business problem.",
      aiApproach:
        "Use AI-assisted search and answer drafting over approved internal guidance, with source review by staff.",
      expectedBenefits: [
        "Reduce time spent searching for prior examples",
        "Improve consistency of responses",
        "Support onboarding and cross-team handoffs"
      ],
      implementationComplexity: "Medium" as const,
      estimatedBusinessValue: "Medium" as const,
      confidence: "Medium" as const,
      reasoning: `The goals mention ${goalText}. A retrieval assistant can help if relevant procedures and examples already exist.`
    }
  ];

  return opportunityDiscoveryResultSchema.parse({
    opportunities,
    analytics: {
      recommendedOpportunity: opportunities[0].title,
      expectedValueSummary:
        "The strongest near-term value is reducing manual documentation and follow-up effort without removing human accountability.",
      expectedEfficiencyImpact:
        "A focused pilot could reduce coordination time and improve handoff quality for repeatable work."
    },
    generationMode: "LOCAL_FALLBACK",
    promptVersion: LOCAL_DISCOVERY_PROMPT_VERSION
  });
}

async function generateAzureOpportunityDiscovery(
  input: OpportunityDiscoveryInput
): Promise<OpportunityDiscoveryResult> {
  const apiKey = process.env.AZURE_AI_KEY;

  if (!apiKey) {
    throw new Error("AZURE_AI_KEY is not configured.");
  }

  const response = await fetchWithTimeout(buildAzureChatCompletionsUrl(), {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildAzureDiscoveryBody(input))
  });

  const body = (await response.json().catch(() => null)) as
    | AzureChatCompletionsResponse
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error?.message ??
        `Azure AI discovery request failed with ${response.status}.`
    );
  }

  const outputText = body ? extractAzureMessageContent(body) : null;

  if (!outputText) {
    throw new Error("Azure AI discovery response did not include content.");
  }

  return opportunityDiscoveryResultSchema.parse(JSON.parse(outputText));
}

function buildAzureDiscoveryBody(input: OpportunityDiscoveryInput) {
  return {
    ...(getAzureOpenAIDeployment() ? {} : { model: getAzureGovernanceModel() }),
    messages: [
      {
        role: "system",
        content:
          "You are an enterprise AI strategy consultant helping identify practical GenAI and AI opportunities for continuous improvement. Identify realistic use cases grounded in the user's business problem. Avoid speculative, generic, or unrealistic recommendations. Return structured JSON only."
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: DISCOVERY_PROMPT_VERSION,
          expectedGenerationMetadata: {
            generationMode: "AZURE_OPENAI",
            modelDeployment: getAzureGovernanceModel(),
            promptVersion: DISCOVERY_PROMPT_VERSION
          },
          businessProblem: input,
          instructions: [
            "Generate between 3 and 5 opportunities.",
            "Every opportunity must directly address the user's business problem and pain points.",
            "Explain expected value and why the opportunity fits.",
            "Prefer practical human-in-the-loop GenAI and AI workflows.",
            "Do not invent facts beyond the provided problem context.",
            "Return valid JSON only."
          ]
        })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "opportunity_discovery",
        strict: true,
        schema: opportunityDiscoveryJsonSchema
      }
    },
    temperature: 0.3,
    max_tokens: 3500
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAzureTimeoutMs());

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

const opportunitySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "description",
    "aiApproach",
    "expectedBenefits",
    "implementationComplexity",
    "estimatedBusinessValue",
    "confidence",
    "reasoning"
  ],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    aiApproach: { type: "string" },
    expectedBenefits: { type: "array", items: { type: "string" } },
    implementationComplexity: {
      type: "string",
      enum: ["Low", "Medium", "High"]
    },
    estimatedBusinessValue: {
      type: "string",
      enum: ["Low", "Medium", "High"]
    },
    confidence: { type: "string", enum: ["Low", "Medium", "High"] },
    reasoning: { type: "string" }
  }
};

const opportunityDiscoveryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "opportunities",
    "analytics",
    "generationMode",
    "modelDeployment",
    "promptVersion"
  ],
  properties: {
    opportunities: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: opportunitySchema
    },
    analytics: {
      type: "object",
      additionalProperties: false,
      required: [
        "recommendedOpportunity",
        "expectedValueSummary",
        "expectedEfficiencyImpact"
      ],
      properties: {
        recommendedOpportunity: { type: "string" },
        expectedValueSummary: { type: "string" },
        expectedEfficiencyImpact: { type: "string" }
      }
    },
    generationMode: { type: "string", enum: ["AZURE_OPENAI"] },
    modelDeployment: { type: "string" },
    promptVersion: { type: "string" }
  }
};
