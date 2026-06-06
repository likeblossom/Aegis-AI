import { describe, expect, it } from "vitest";
import {
  assignmentUpdateSchema,
  createUseCaseSchema,
  reviewerNoteUpdateSchema,
  reviewUpdateSchema
} from "@/lib/validations";

const validProposal = {
  title: "Internal FAQ summarization",
  department: "IT",
  teamOwner: "Service Desk",
  currentProcess: "Analysts manually answer repeat questions.",
  proposedSolution: "Use AI to summarize approved FAQ answers.",
  expectedBenefit: "Reduce repeat tickets.",
  dataSensitivity: "INTERNAL",
  decisionImpact: "LOW",
  humanOversightPlanned: "YES",
  affectedStakeholders: "Employees and service desk analysts",
  implementationTimeline: "4 weeks"
};

describe("createUseCaseSchema", () => {
  it("accepts a complete proposal", () => {
    expect(createUseCaseSchema.safeParse(validProposal).success).toBe(true);
  });

  it("rejects unsupported enum-like values", () => {
    const result = createUseCaseSchema.safeParse({
      ...validProposal,
      dataSensitivity: "SECRET"
    });

    expect(result.success).toBe(false);
  });
});

describe("reviewUpdateSchema", () => {
  it("accepts reviewer status updates with notes", () => {
    const result = reviewUpdateSchema.safeParse({
      status: "NEEDS_REVIEW",
      note: "Requires privacy review before approval.",
      reviewerName: "IT Governance",
      reviewerAccessCode: "test-code"
    });

    expect(result.success).toBe(true);
  });

  it("rejects pending as a reviewer action", () => {
    expect(
      reviewUpdateSchema.safeParse({
        status: "PENDING",
        reviewerAccessCode: "test-code"
      }).success
    ).toBe(false);
  });

  it("rejects arbitrary reviewer names", () => {
    expect(
      reviewUpdateSchema.safeParse({
        status: "NEEDS_REVIEW",
        reviewerName: "External User",
        reviewerAccessCode: "test-code"
      }).success
    ).toBe(false);
  });
});

describe("assignmentUpdateSchema", () => {
  it("accepts an assigned reviewer name", () => {
    expect(
      assignmentUpdateSchema.safeParse({
        assignedReviewer: "HR Compliance",
        reviewerAccessCode: "test-code"
      }).success
    ).toBe(true);
  });

  it("rejects blank reviewer assignments", () => {
    expect(
      assignmentUpdateSchema.safeParse({
        assignedReviewer: "",
        reviewerAccessCode: "test-code"
      }).success
    ).toBe(false);
  });
});

describe("reviewerNoteUpdateSchema", () => {
  it("requires note text when editing reviewer notes", () => {
    expect(
      reviewerNoteUpdateSchema.safeParse({
        note: "",
        reviewerName: "Governance reviewer",
        reviewerAccessCode: "test-code"
      }).success
    ).toBe(false);
  });

  it("requires a reviewer access code when editing notes", () => {
    expect(
      reviewerNoteUpdateSchema.safeParse({
        note: "Updated rationale.",
        reviewerName: "Governance reviewer"
      }).success
    ).toBe(false);
  });
});
