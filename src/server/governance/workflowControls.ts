import type { ReviewStatus } from "@/lib/validations";

type ReviewControlInput = {
  status: ReviewStatus;
  note: string;
  hasReport: boolean;
};

export function validateReviewWorkflow({
  status,
  note,
  hasReport
}: ReviewControlInput) {
  if (["APPROVED", "APPROVED_WITH_CONTROLS"].includes(status) && !hasReport) {
    return "A governance report is required before approval.";
  }

  if (["NEEDS_REVIEW", "REJECTED"].includes(status) && note.trim().length === 0) {
    return "A reviewer note is required for this decision.";
  }

  return null;
}
