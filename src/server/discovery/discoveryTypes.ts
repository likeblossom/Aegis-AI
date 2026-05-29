import { z } from "zod";

const requiredText = z.string().trim().min(1, "This field is required");
const longText = requiredText.max(4000, "Keep this under 4,000 characters");

export const opportunityDiscoveryInputSchema = z.object({
  businessProblem: longText,
  department: requiredText.max(120),
  affectedTeams: longText,
  currentPainPoints: longText,
  goals: z.string().trim().max(2000).optional().default("")
});

export const opportunitySchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1),
  aiApproach: z.string().trim().min(1),
  expectedBenefits: z.array(z.string().trim().min(1)).min(1),
  implementationComplexity: z.enum(["Low", "Medium", "High"]),
  estimatedBusinessValue: z.enum(["Low", "Medium", "High"]),
  confidence: z.enum(["Low", "Medium", "High"]),
  reasoning: z.string().trim().min(1)
});

export const opportunityDiscoveryResultSchema = z.object({
  opportunities: z.array(opportunitySchema).min(3).max(5),
  analytics: z.object({
    recommendedOpportunity: z.string().trim().min(1),
    expectedValueSummary: z.string().trim().min(1),
    expectedEfficiencyImpact: z.string().trim().min(1)
  }),
  generationMode: z.enum(["AZURE_OPENAI", "LOCAL_FALLBACK"]),
  modelDeployment: z.string().optional(),
  promptVersion: z.string()
});

export const opportunityAnalysisSchema = z.object({
  businessCase: z.object({
    expectedValueSummary: z.string().trim().min(1),
    efficiencyImpact: z.string().trim().min(1),
    costReductionPotential: z.string().trim().min(1),
    productivityImpact: z.string().trim().min(1)
  }),
  fitAnalysis: z.object({
    whyThisFits: z.string().trim().min(1),
    expectedChallenges: z.array(z.string().trim().min(1)).min(1),
    keyDependencies: z.array(z.string().trim().min(1)).min(1)
  }),
  governancePreview: z.object({
    predictedRiskLevel: z.string().trim().min(1),
    likelyReviewTeams: z.array(z.string().trim().min(1)).min(1),
    likelyConcerns: z.array(z.string().trim().min(1)).min(1)
  }),
  readinessEstimate: z.object({
    dataReadiness: z.number().int().min(0).max(100),
    processReadiness: z.number().int().min(0).max(100),
    technicalReadiness: z.number().int().min(0).max(100),
    stakeholderReadiness: z.number().int().min(0).max(100)
  }),
  recommendedPilot: z.object({
    pilotTeam: z.string().trim().min(1),
    pilotDuration: z.string().trim().min(1),
    successCriteria: z.array(z.string().trim().min(1)).min(1),
    rollbackCriteria: z.array(z.string().trim().min(1)).min(1)
  }),
  scorecard: z.object({
    businessValue: z.number().int().min(0).max(100),
    aiReadiness: z.number().int().min(0).max(100),
    implementationEffort: z.number().int().min(0).max(100),
    governanceRisk: z.number().int().min(0).max(100),
    strategicAlignment: z.number().int().min(0).max(100),
    overallRecommendation: z.enum([
      "Strong Candidate",
      "Worth Exploring",
      "Requires More Investigation",
      "Low Priority"
    ]),
    recommendationExplanation: z.string().trim().min(1)
  }),
  generationMode: z.enum(["AZURE_OPENAI", "LOCAL_FALLBACK"]),
  modelDeployment: z.string().optional(),
  promptVersion: z.string()
});

export type OpportunityDiscoveryInput = z.infer<
  typeof opportunityDiscoveryInputSchema
>;
export type OpportunityDiscoveryResult = z.infer<
  typeof opportunityDiscoveryResultSchema
>;
export type DiscoveredOpportunity = z.infer<typeof opportunitySchema>;
export type OpportunityAnalysisResult = z.infer<typeof opportunityAnalysisSchema>;
