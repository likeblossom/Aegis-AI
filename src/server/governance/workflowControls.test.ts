import { describe, expect, it } from "vitest";
import { validateReviewWorkflow } from "./workflowControls";

describe("review workflow controls", () => {
  it("requires a governance report before approval", () => {
    expect(
      validateReviewWorkflow({
        status: "APPROVED",
        note: "",
        hasReport: false
      })
    ).toBe("A governance report is required before approval.");
  });

  it("requires reviewer notes for review escalation and rejection", () => {
    expect(
      validateReviewWorkflow({
        status: "NEEDS_REVIEW",
        note: "",
        hasReport: true
      })
    ).toBe("A reviewer note is required for this decision.");

    expect(
      validateReviewWorkflow({
        status: "REJECTED",
        note: "Privacy concerns require a revised approach.",
        hasReport: true
      })
    ).toBeNull();
  });
});
