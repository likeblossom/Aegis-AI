import { describe, expect, it } from "vitest";
import {
  buildReportGeneratedAuditNote,
  buildReviewNoteAddedAuditNote,
  buildReviewerAssignedAuditNote,
  buildReviewStatusUpdatedAuditNote,
  formatAuditNoteForDisplay,
  getAuditActorLabel
} from "./audit-log-formatter";

describe("audit-log-formatter", () => {
  it("builds business-readable report generated messages", () => {
    expect(
      buildReportGeneratedAuditNote({
        analysisMode: "azure",
        reportVersion: 1,
        riskLevel: "CRITICAL",
        fallbackReason: null
      })
    ).toBe(
      "Governance report generated. Initial assessment identified a Critical Risk rating requiring further review."
    );
  });

  it("converts review status enum values to labels", () => {
    expect(
      buildReviewStatusUpdatedAuditNote({
        previousStatus: "PENDING",
        newStatus: "NEEDS_REVIEW"
      })
    ).toBe("Review status updated from Pending Review to Requires Review.");
  });

  it("keeps reviewer assignment messages simple for unchanged reviewers", () => {
    expect(
      buildReviewerAssignedAuditNote({
        previousReviewer: "Legal and Procurement Risk",
        newReviewer: "Legal and Procurement Risk"
      })
    ).toBe("Reviewer assigned: Legal and Procurement Risk.");
  });

  it("adds a truncated reviewer note preview", () => {
    expect(
      buildReviewNoteAddedAuditNote(
        "Human oversight requirements need clarification before approval."
      )
    ).toBe(
      "Reviewer note added: Human oversight requirements need clarification before approval."
    );
  });

  it("cleans legacy workflow IDs and enum values for display", () => {
    expect(
      formatAuditNoteForDisplay(
        "REPORT_GENERATED",
        "[workflow a2b9b3fd-6f92-4588-a478-4645f3c5b9c7] Azure AI governance report v1 generated with CRITICAL risk."
      )
    ).toBe(
      "Governance report generated. Initial assessment identified a Critical Risk rating requiring further review."
    );

    expect(
      formatAuditNoteForDisplay(
        "REVIEW_STATUS_UPDATED",
        "Review status updated from PENDING to NEEDS_REVIEW."
      )
    ).toBe("Review status updated from Pending Review to Requires Review.");

    expect(
      formatAuditNoteForDisplay(
        "REVIEWER_ASSIGNED",
        "Assigned reviewer changed from Legal and Procurement Risk to Legal and Procurement Risk."
      )
    ).toBe("Reviewer assigned: Legal and Procurement Risk.");
  });

  it("returns actor labels for audit sources", () => {
    expect(getAuditActorLabel("REPORT_GENERATED")).toBe("AI Analysis Engine");
    expect(getAuditActorLabel("REVIEW_NOTE_ADDED")).toBe("Reviewer");
    expect(getAuditActorLabel("PROPOSAL_CREATED")).toBe("Proposal Owner");
  });
});
