import { z } from "zod";
import {
  CONFIDENCE_LEVEL_VALUES,
  FINAL_RECOMMENDATION_VALUES,
  RISK_LEVEL_VALUES
} from "@/lib/constants";
import {
  GENERATION_FAILURE_REASONS,
  type GenerationFailureReason
} from "./classifyAzureError";

export type RedFlagSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RedFlag = {
  issue: string;
  severity: RedFlagSeverity;
  explanation: string;
};

export type RationaleItem = {
  finding: string;
  whyItMatters: string;
  evidenceFromProposal: string;
  recommendedAction: string;
};

export type SimulatedGovernanceReview = {
  reviewer: string;
  concerns: string[];
  recommendations: string[];
  approvalConditions: string[];
};

export type ChangeManagementAnalysis = {
  affectedTeams: string[];
  adoptionRisk: "LOW" | "MEDIUM" | "HIGH";
  expectedResistance: string[];
  trainingNeeds: string[];
  communicationPlan: string[];
  mitigationActions: string[];
};

export type ExecutiveBriefing = {
  headline: string;
  recommendationSummary: string;
  expectedBusinessValue: string;
  topRisks: string[];
  requiredControls: string[];
  suggestedNextStep: string;
  decisionQuestion: string;
};

export type AssessmentArea = {
  score: number;
  rationale: string;
  evidenceFromProposal: string[];
  improvementActions: string[];
  confidence: "LOW" | "MEDIUM" | "HIGH";
};

export type AssessmentBreakdown = {
  businessValue: AssessmentArea;
  implementationComplexity: AssessmentArea;
  governanceRisk: AssessmentArea;
  changeManagementRisk: AssessmentArea;
  dataReadiness: AssessmentArea;
  humanOversightStrength: AssessmentArea;
  strategicAlignment: AssessmentArea;
};

export type ProposalChallenger = {
  reasonsThisMightFail: string[];
  assumptionsToValidate: string[];
  questionsForStakeholders: string[];
};

export type ReportGenerationMetadata = {
  generationMode: "AZURE_OPENAI" | "LOCAL_FALLBACK";
  fallbackUsed: boolean;
  failureReason?: GenerationFailureReason;
  azureDeployment?: string;
  apiVersion?: string;
  modelDeployment?: string;
  promptVersion: string;
};

export type GovernanceReportObject = {
  executiveSummary: string;
  executiveBriefing: ExecutiveBriefing;
  useCaseClassification: {
    department: string;
    dataSensitivity: string;
    decisionImpact: string;
    automationProfile: string;
  };
  governanceRiskAnalysis: string;
  businessImpactAnalysis: string;
  analysisRationale: RationaleItem[];
  redFlags: RedFlag[];
  requiredControls: string[];
  rolloutStrategy: string[];
  changeManagementAnalysis: ChangeManagementAnalysis;
  stakeholderImpactAnalysis: string;
  assessmentBreakdown: AssessmentBreakdown;
  proposalChallenger: ProposalChallenger;
  successMetrics: string[];
  assumptionsAndUncertainties: string[];
  simulatedGovernanceReviews: SimulatedGovernanceReview[];
  generationMetadata: ReportGenerationMetadata;
  riskLevel: (typeof RISK_LEVEL_VALUES)[number];
  aiReadinessScore: number;
  finalRecommendation: (typeof FINAL_RECOMMENDATION_VALUES)[number];
  confidenceLevel: (typeof CONFIDENCE_LEVEL_VALUES)[number];
};

const redFlagSchema = z.object({
  issue: z.string(),
  severity: z.enum(RISK_LEVEL_VALUES),
  explanation: z.string()
});

const changeManagementAnalysisSchema = z
  .object({
    affectedTeams: z.array(z.string()),
    adoptionRisk: z.preprocess(
      (value) =>
        typeof value === "string" ? value.toUpperCase() : value,
      z.enum(["LOW", "MEDIUM", "HIGH"])
    ),
    expectedResistance: z.array(z.string()),
    trainingNeeds: z.array(z.string()),
    communicationPlan: z.array(z.string()),
    mitigationActions: z.array(z.string())
  })
  .default({
    affectedTeams: [],
    adoptionRisk: "LOW",
    expectedResistance: [],
    trainingNeeds: [],
    communicationPlan: [],
    mitigationActions: []
  });

const proposalChallengerSchema = z
  .object({
    reasonsThisMightFail: z.array(z.string()),
    assumptionsToValidate: z.array(z.string()),
    questionsForStakeholders: z.array(z.string())
  })
  .default({
    reasonsThisMightFail: [],
    assumptionsToValidate: [],
    questionsForStakeholders: []
  });

const generationMetadataSchema = z
  .object({
    generationMode: z.enum(["AZURE_OPENAI", "LOCAL_FALLBACK"]),
    fallbackUsed: z.boolean().optional(),
    failureReason: z
      .preprocess(
        (value) =>
          value === "UNKNOWN_ERROR" || value === "AZURE_REQUEST_FAILED"
            ? "AZURE_UNKNOWN_ERROR"
            : value,
        z.enum(GENERATION_FAILURE_REASONS)
      )
      .optional(),
    azureDeployment: z.string().optional(),
    apiVersion: z.string().optional(),
    modelDeployment: z.string().optional(),
    promptVersion: z.string()
  })
  .transform((metadata) => ({
    ...metadata,
    fallbackUsed:
      metadata.fallbackUsed ?? metadata.generationMode === "LOCAL_FALLBACK"
  }))
  .default({
    generationMode: "LOCAL_FALLBACK",
    fallbackUsed: true,
    promptVersion: "legacy-report"
  });

const executiveBriefingSchema = z
  .object({
    headline: z.string(),
    recommendationSummary: z.string(),
    expectedBusinessValue: z.string(),
    topRisks: z.array(z.string()),
    requiredControls: z.array(z.string()),
    suggestedNextStep: z.string(),
    decisionQuestion: z.string()
  })
  .default({
    headline: "Executive briefing unavailable",
    recommendationSummary:
      "Generate a new governance report to produce an executive briefing.",
    expectedBusinessValue:
      "Business value was not summarized in this older report.",
    topRisks: [],
    requiredControls: [],
    suggestedNextStep:
      "Regenerate the governance report to create an executive briefing.",
    decisionQuestion:
      "Should this proposal be refreshed with the current report format?"
  });

const assessmentAreaSchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string(),
  evidenceFromProposal: z.array(z.string()).min(1),
  improvementActions: z.array(z.string()).min(1),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"])
});

const defaultAssessmentArea: AssessmentArea = {
  score: 50,
  rationale:
    "This legacy report was generated before detailed assessment scoring was available.",
  evidenceFromProposal: [
    "Regenerate the report to extract proposal-specific assessment evidence."
  ],
  improvementActions: [
    "Regenerate the governance report using the current assessment framework."
  ],
  confidence: "LOW"
};

const assessmentBreakdownSchema = z
  .object({
    businessValue: assessmentAreaSchema,
    implementationComplexity: assessmentAreaSchema,
    governanceRisk: assessmentAreaSchema,
    changeManagementRisk: assessmentAreaSchema,
    dataReadiness: assessmentAreaSchema,
    humanOversightStrength: assessmentAreaSchema,
    strategicAlignment: assessmentAreaSchema
  })
  .default({
    businessValue: defaultAssessmentArea,
    implementationComplexity: defaultAssessmentArea,
    governanceRisk: defaultAssessmentArea,
    changeManagementRisk: defaultAssessmentArea,
    dataReadiness: defaultAssessmentArea,
    humanOversightStrength: defaultAssessmentArea,
    strategicAlignment: defaultAssessmentArea
  });

export const governanceReportSchema = z.object({
  executiveSummary: z.string(),
  executiveBriefing: executiveBriefingSchema,
  useCaseClassification: z.object({
    department: z.string(),
    dataSensitivity: z.string(),
    decisionImpact: z.string(),
    automationProfile: z.string()
  }),
  governanceRiskAnalysis: z.string(),
  businessImpactAnalysis: z.string(),
  analysisRationale: z.array(
    z.object({
      finding: z.string(),
      whyItMatters: z.string(),
      evidenceFromProposal: z.string(),
      recommendedAction: z.string()
    })
  ),
  redFlags: z.array(redFlagSchema),
  requiredControls: z.array(z.string()),
  rolloutStrategy: z.array(z.string()),
  changeManagementAnalysis: changeManagementAnalysisSchema,
  stakeholderImpactAnalysis: z.string().default(""),
  assessmentBreakdown: assessmentBreakdownSchema,
  proposalChallenger: proposalChallengerSchema,
  successMetrics: z.array(z.string()).default([]),
  assumptionsAndUncertainties: z.array(z.string()).default([]),
  simulatedGovernanceReviews: z.array(
    z.object({
      reviewer: z.string(),
      concerns: z.array(z.string()),
      recommendations: z.array(z.string()),
      approvalConditions: z.array(z.string())
    })
  ),
  generationMetadata: generationMetadataSchema,
  riskLevel: z.enum(RISK_LEVEL_VALUES),
  aiReadinessScore: z.number().int().min(0).max(100),
  finalRecommendation: z.enum(FINAL_RECOMMENDATION_VALUES),
  confidenceLevel: z.enum(CONFIDENCE_LEVEL_VALUES)
});

export function parseGovernanceReportJson(value: string) {
  try {
    return governanceReportSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}
