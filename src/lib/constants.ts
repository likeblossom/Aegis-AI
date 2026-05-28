export const DATA_SENSITIVITY_VALUES = [
  "PUBLIC",
  "INTERNAL",
  "CONFIDENTIAL",
  "SENSITIVE"
] as const;

export const DECISION_IMPACT_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;

export const HUMAN_OVERSIGHT_VALUES = ["YES", "PARTIAL", "NO"] as const;

export const USE_CASE_STATUS_VALUES = [
  "PENDING",
  "APPROVED",
  "APPROVED_WITH_CONTROLS",
  "NEEDS_REVIEW",
  "REJECTED"
] as const;

export const DEFAULT_USE_CASE_STATUS = "PENDING";

export function formatEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
