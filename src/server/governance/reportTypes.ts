import { z } from "zod";
import {
  CONFIDENCE_LEVEL_VALUES,
  FINAL_RECOMMENDATION_VALUES,
  RISK_LEVEL_VALUES
} from "@/lib/constants";

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

export type GovernanceReportObject = {
  executiveSummary: string;
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
  simulatedGovernanceReviews: SimulatedGovernanceReview[];
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

export const governanceReportSchema = z.object({
  executiveSummary: z.string(),
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
  simulatedGovernanceReviews: z.array(
    z.object({
      reviewer: z.string(),
      concerns: z.array(z.string()),
      recommendations: z.array(z.string()),
      approvalConditions: z.array(z.string())
    })
  ),
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
