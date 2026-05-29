import {
  buildAzureChatCompletionsUrl,
  extractAzureMessageContent,
  getAzureGovernanceModel,
  getAzureOpenAIDeployment,
  getAzureTimeoutMs,
  isAzureGovernanceConfigured
} from "@/server/governance/azureGovernanceReport";
import {
  opportunityAnalysisSchema,
  type DiscoveredOpportunity,
  type OpportunityAnalysisResult,
  type OpportunityDiscoveryInput
} from "./discoveryTypes";

export const OPPORTUNITY_ANALYSIS_PROMPT_VERSION =
  "opportunity-analysis-v1.0";
export const LOCAL_OPPORTUNITY_ANALYSIS_PROMPT_VERSION =
  "local-opportunity-analysis-v1.0";

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

export async function generateOpportunityAnalysis({
  input,
  opportunity
}: {
  input: OpportunityDiscoveryInput;
  opportunity: DiscoveredOpportunity;
}) {
  if (isAzureGovernanceConfigured()) {
    try {
      return await generateAzureOpportunityAnalysis({ input, opportunity });
    } catch {
      return generateLocalOpportunityAnalysis({ input, opportunity });
    }
  }

  return generateLocalOpportunityAnalysis({ input, opportunity });
}

export function generateLocalOpportunityAnalysis({
  input,
  opportunity
}: {
  input: OpportunityDiscoveryInput;
  opportunity: DiscoveredOpportunity;
}): OpportunityAnalysisResult {
  const complexityScore =
    opportunity.implementationComplexity === "Low"
      ? 78
      : opportunity.implementationComplexity === "Medium"
        ? 58
        : 34;
  const businessValue =
    opportunity.estimatedBusinessValue === "High"
      ? 86
      : opportunity.estimatedBusinessValue === "Medium"
        ? 68
        : 42;
  const readiness =
    opportunity.confidence === "High" ? 76 : opportunity.confidence === "Medium" ? 62 : 45;
  const governanceRisk =
    opportunity.aiApproach.toLowerCase().includes("approval") ? 68 : 42;
  const recommendation =
    businessValue >= 80 && readiness >= 70
      ? "Strong Candidate"
      : businessValue >= 60
        ? "Worth Exploring"
        : "Requires More Investigation";

  return opportunityAnalysisSchema.parse({
    businessCase: {
      expectedValueSummary: `${opportunity.title} could address the stated problem by focusing AI support on ${input.currentPainPoints}.`,
      efficiencyImpact:
        "The main efficiency gain is reducing manual coordination, drafting, searching, and follow-up work.",
      costReductionPotential:
        "Cost reduction potential depends on repeat volume and whether teams can retire manual rework after a pilot.",
      productivityImpact:
        "Productivity impact should appear as faster handoffs, fewer missing-information loops, and more consistent outputs."
    },
    fitAnalysis: {
      whyThisFits: opportunity.reasoning,
      expectedChallenges: [
        "Defining approved data sources and review responsibilities",
        "Keeping human oversight in place while teams learn the new workflow",
        "Measuring whether cycle-time gains come without quality loss"
      ],
      keyDependencies: [
        "Access to representative examples from the current process",
        "Named pilot owner and participating team",
        "Clear success criteria and rollback criteria"
      ]
    },
    governancePreview: {
      predictedRiskLevel: governanceRisk >= 60 ? "Medium" : "Low",
      likelyReviewTeams: ["IT Governance", "Operations", "Security and Privacy"],
      likelyConcerns: [
        "Human oversight requirements",
        "Data handling and access boundaries",
        "Over-reliance on AI-generated recommendations"
      ]
    },
    readinessEstimate: {
      dataReadiness: readiness,
      processReadiness: Math.max(35, readiness - 8),
      technicalReadiness: complexityScore,
      stakeholderReadiness: Math.max(40, readiness - 5)
    },
    recommendedPilot: {
      pilotTeam: input.affectedTeams,
      pilotDuration:
        opportunity.implementationComplexity === "High" ? "12 weeks" : "6 weeks",
      successCriteria: [
        "Pilot users report reduced manual effort",
        "Output quality meets reviewer expectations",
        "Exceptions and overrides are documented"
      ],
      rollbackCriteria: [
        "AI output introduces material errors",
        "Users bypass required human review",
        "Pilot metrics do not show meaningful efficiency gains"
      ]
    },
    scorecard: {
      businessValue,
      aiReadiness: readiness,
      implementationEffort: complexityScore,
      governanceRisk,
      strategicAlignment: input.goals ? 78 : 62,
      overallRecommendation: recommendation,
      recommendationExplanation:
        "This local estimate balances business value, readiness, effort, and governance risk before formal proposal review."
    },
    generationMode: "LOCAL_FALLBACK",
    promptVersion: LOCAL_OPPORTUNITY_ANALYSIS_PROMPT_VERSION
  });
}

async function generateAzureOpportunityAnalysis({
  input,
  opportunity
}: {
  input: OpportunityDiscoveryInput;
  opportunity: DiscoveredOpportunity;
}) {
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
    body: JSON.stringify(buildAzureAnalysisBody({ input, opportunity }))
  });

  const body = (await response.json().catch(() => null)) as
    | AzureChatCompletionsResponse
    | null;

  if (!response.ok) {
    throw new Error(
      body?.error?.message ??
        `Azure AI opportunity analysis failed with ${response.status}.`
    );
  }

  const outputText = body ? extractAzureMessageContent(body) : null;

  if (!outputText) {
    throw new Error("Azure AI opportunity analysis response was empty.");
  }

  return opportunityAnalysisSchema.parse(JSON.parse(outputText));
}

function buildAzureAnalysisBody({
  input,
  opportunity
}: {
  input: OpportunityDiscoveryInput;
  opportunity: DiscoveredOpportunity;
}) {
  return {
    ...(getAzureOpenAIDeployment() ? {} : { model: getAzureGovernanceModel() }),
    messages: [
      {
        role: "system",
        content:
          "You are an enterprise AI strategy consultant. Produce practical opportunity analysis, business case, governance preview, readiness estimate, pilot plan, and scorecard for an AI opportunity. This is not a formal governance review. Return structured JSON only."
      },
      {
        role: "user",
        content: JSON.stringify({
          promptVersion: OPPORTUNITY_ANALYSIS_PROMPT_VERSION,
          expectedGenerationMetadata: {
            generationMode: "AZURE_OPENAI",
            modelDeployment: getAzureGovernanceModel(),
            promptVersion: OPPORTUNITY_ANALYSIS_PROMPT_VERSION
          },
          businessProblem: input,
          opportunity,
          instructions: [
            "Ground every statement in the business problem and selected opportunity.",
            "Do not generate final governance risk scores or final governance recommendations.",
            "Make the analysis stakeholder-friendly and consulting-style.",
            "Use scores from 0 to 100 for readiness and scorecard values.",
            "Return valid JSON only."
          ]
        })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "opportunity_analysis",
        strict: true,
        schema: opportunityAnalysisJsonSchema
      }
    },
    temperature: 0.25,
    max_tokens: 4500
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

const stringArray = { type: "array", items: { type: "string" } };
const score = { type: "integer", minimum: 0, maximum: 100 };

const opportunityAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessCase",
    "fitAnalysis",
    "governancePreview",
    "readinessEstimate",
    "recommendedPilot",
    "scorecard",
    "generationMode",
    "modelDeployment",
    "promptVersion"
  ],
  properties: {
    businessCase: {
      type: "object",
      additionalProperties: false,
      required: [
        "expectedValueSummary",
        "efficiencyImpact",
        "costReductionPotential",
        "productivityImpact"
      ],
      properties: {
        expectedValueSummary: { type: "string" },
        efficiencyImpact: { type: "string" },
        costReductionPotential: { type: "string" },
        productivityImpact: { type: "string" }
      }
    },
    fitAnalysis: {
      type: "object",
      additionalProperties: false,
      required: ["whyThisFits", "expectedChallenges", "keyDependencies"],
      properties: {
        whyThisFits: { type: "string" },
        expectedChallenges: stringArray,
        keyDependencies: stringArray
      }
    },
    governancePreview: {
      type: "object",
      additionalProperties: false,
      required: ["predictedRiskLevel", "likelyReviewTeams", "likelyConcerns"],
      properties: {
        predictedRiskLevel: { type: "string" },
        likelyReviewTeams: stringArray,
        likelyConcerns: stringArray
      }
    },
    readinessEstimate: {
      type: "object",
      additionalProperties: false,
      required: [
        "dataReadiness",
        "processReadiness",
        "technicalReadiness",
        "stakeholderReadiness"
      ],
      properties: {
        dataReadiness: score,
        processReadiness: score,
        technicalReadiness: score,
        stakeholderReadiness: score
      }
    },
    recommendedPilot: {
      type: "object",
      additionalProperties: false,
      required: [
        "pilotTeam",
        "pilotDuration",
        "successCriteria",
        "rollbackCriteria"
      ],
      properties: {
        pilotTeam: { type: "string" },
        pilotDuration: { type: "string" },
        successCriteria: stringArray,
        rollbackCriteria: stringArray
      }
    },
    scorecard: {
      type: "object",
      additionalProperties: false,
      required: [
        "businessValue",
        "aiReadiness",
        "implementationEffort",
        "governanceRisk",
        "strategicAlignment",
        "overallRecommendation",
        "recommendationExplanation"
      ],
      properties: {
        businessValue: score,
        aiReadiness: score,
        implementationEffort: score,
        governanceRisk: score,
        strategicAlignment: score,
        overallRecommendation: {
          type: "string",
          enum: [
            "Strong Candidate",
            "Worth Exploring",
            "Requires More Investigation",
            "Low Priority"
          ]
        },
        recommendationExplanation: { type: "string" }
      }
    },
    generationMode: { type: "string", enum: ["AZURE_OPENAI"] },
    modelDeployment: { type: "string" },
    promptVersion: { type: "string" }
  }
};
