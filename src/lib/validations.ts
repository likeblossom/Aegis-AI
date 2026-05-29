import { z } from "zod";
import {
  CONFIDENCE_LEVEL_VALUES,
  DATA_SENSITIVITY_VALUES,
  DECISION_IMPACT_VALUES,
  FINAL_RECOMMENDATION_VALUES,
  HUMAN_OVERSIGHT_VALUES,
  REVIEW_STATUS_VALUES,
  RISK_LEVEL_VALUES,
  USE_CASE_STATUS_VALUES
} from "@/lib/constants";

const requiredText = z.string().trim().min(1, "This field is required");
const longText = requiredText.max(4000, "Keep this under 4,000 characters");

export const useCaseStatusSchema = z.enum(USE_CASE_STATUS_VALUES);
export const reviewStatusSchema = z.enum(REVIEW_STATUS_VALUES);
export const riskLevelSchema = z.enum(RISK_LEVEL_VALUES);
export const confidenceLevelSchema = z.enum(CONFIDENCE_LEVEL_VALUES);
export const finalRecommendationSchema = z.enum(FINAL_RECOMMENDATION_VALUES);

export const createUseCaseSchema = z.object({
  title: requiredText.max(160),
  department: requiredText.max(120),
  teamOwner: requiredText.max(120),
  currentProcess: longText,
  proposedSolution: longText,
  expectedBenefit: longText,
  dataSensitivity: z.enum(DATA_SENSITIVITY_VALUES),
  decisionImpact: z.enum(DECISION_IMPACT_VALUES),
  humanOversightPlanned: z.enum(HUMAN_OVERSIGHT_VALUES),
  affectedStakeholders: longText,
  implementationTimeline: requiredText.max(240)
});

export type CreateUseCaseInput = z.infer<typeof createUseCaseSchema>;
export type UseCaseStatus = z.infer<typeof useCaseStatusSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
