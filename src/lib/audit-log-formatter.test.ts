import { describe, expect, it } from "vitest";
import {
  buildAssessmentBreakdownGeneratedAuditNote,
  buildAzureReportGeneratedAuditNote,
  buildFallbackReportGeneratedAuditNote,
  buildReportGeneratedAuditNote,
  buildOpportunityConvertedAuditNote,
  buildOpportunityDiscoveryRunAuditNote,
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
        analysisMode: "AZURE_OPENAI",
        reportVersion: 1,
        riskLevel: "CRITICAL",
        fallbackReason: null
      })
    ).toBe(
      "Governance report generated using Azure OpenAI with deterministic governance guardrails."
    );

    expect(
      buildReportGeneratedAuditNote({
        analysisMode: "LOCAL_FALLBACK",
        reportVersion: 1,
        riskLevel: "LOW",
        fallbackReason: null
      })
    ).toBe("Governance report generated using local fallback analysis.");

    expect(buildAssessmentBreakdownGeneratedAuditNote()).toBe(
      "Detailed AI assessment breakdown generated."
    );

    expect(buildAzureReportGeneratedAuditNote()).toBe(
      "Governance report generated using Azure OpenAI with deterministic guardrails."
    );

    expect(
      buildFallbackReportGeneratedAuditNote("AZURE_SCHEMA_VALIDATION_FAILED")
    ).toBe(
      "Azure OpenAI generation failed. Azure response did not match the expected report schema. Local fallback report generated."
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

  it("builds business-readable opportunity discovery messages", () => {
    expect(buildOpportunityDiscoveryRunAuditNote()).toBe(
      "AI opportunity discovery completed."
    );
    expect(buildOpportunityConvertedAuditNote()).toBe(
      "Opportunity converted into governance proposal."
    );
    expect(
      formatAuditNoteForDisplay("OPPORTUNITY_DISCOVERY_RUN", "internal debug")
    ).toBe("AI opportunity discovery completed.");
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
      "Governance report generated using Azure OpenAI with deterministic governance guardrails."
    );

    expect(
      formatAuditNoteForDisplay(
        "REPORT_GENERATED_AZURE",
        "internal azure debug"
      )
    ).toBe(
      "Governance report generated using Azure OpenAI with deterministic guardrails."
    );

    expect(
      formatAuditNoteForDisplay(
        "REPORT_GENERATED_FALLBACK",
        "Azure OpenAI generation failed. Azure request timed out. Local fallback report generated."
      )
    ).toBe(
      "Azure OpenAI generation failed. Azure request timed out. Local fallback report generated."
    );

    expect(
      formatAuditNoteForDisplay(
        "ASSESSMENT_BREAKDOWN_GENERATED",
        "internal assessment debug"
      )
    ).toBe("Detailed AI assessment breakdown generated.");

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
    expect(getAuditActorLabel("ASSESSMENT_BREAKDOWN_GENERATED")).toBe(
      "AI Analysis Engine"
    );
    expect(getAuditActorLabel("REVIEW_NOTE_ADDED")).toBe("Reviewer");
    expect(getAuditActorLabel("PROPOSAL_CREATED")).toBe("Proposal Owner");
  });
});
