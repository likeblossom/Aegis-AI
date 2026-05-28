import { describe, expect, it } from "vitest";
import { createUseCaseSchema } from "@/lib/validations";

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
