import type { UseCase } from "@/db/schema";
import type { RedFlag } from "./reportTypes";

function includesAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function proposalText(useCase: UseCase) {
  return [
    useCase.title,
    useCase.department,
    useCase.currentProcess,
    useCase.proposedSolution,
    useCase.expectedBenefit,
    useCase.affectedStakeholders
  ].join(" ");
}

export function detectRedFlags(useCase: UseCase): RedFlag[] {
  const flags: RedFlag[] = [];
  const text = proposalText(useCase);
  const hasAutomationLanguage = includesAny(text, [
    "automate",
    "automation",
    "approval",
    "approve",
    "reject",
    "rank",
    "screen",
    "decision"
  ]);

  if (
    useCase.decisionImpact === "HIGH" &&
    useCase.humanOversightPlanned === "NO"
  ) {
    flags.push({
      issue: "High-impact decision without human oversight",
      severity: "CRITICAL",
      explanation:
        "The proposal describes a high-impact decision workflow without planned human review."
    });
  }

  if (
    includesAny(text, ["job applicant", "resume", "recruit", "candidate", "hiring"]) ||
    useCase.department.toLowerCase().includes("human resources")
  ) {
    flags.push({
      issue: "HR or applicant workflow",
      severity: "HIGH",
      explanation:
        "Employment-related AI workflows can affect access to opportunities and require fairness, bias, and compliance review."
    });
  }

  if (includesAny(text, ["vendor approval", "supplier approval", "approve vendor"])) {
    flags.push({
      issue: "Vendor approval automation",
      severity: "HIGH",
      explanation:
        "Vendor approval recommendations can affect commercial access and should retain documented human accountability."
    });
  }

  if (
    ["SENSITIVE", "CONFIDENTIAL"].includes(useCase.dataSensitivity) &&
    hasAutomationLanguage
  ) {
    flags.push({
      issue: "Sensitive or confidential data with automation",
      severity: useCase.dataSensitivity === "SENSITIVE" ? "HIGH" : "MEDIUM",
      explanation:
        "Automating workflows that use sensitive or confidential data increases privacy, access-control, and monitoring requirements."
    });
  }

  if (includesAny(text, ["replace human", "removes human", "rank", "recommend approval", "recommend rejection"])) {
    flags.push({
      issue: "AI may replace human judgment",
      severity: "HIGH",
      explanation:
        "The proposal suggests AI could shape or substitute judgment in a decision workflow, so reviewer accountability must be explicit."
    });
  }

  if (
    useCase.humanOversightPlanned === "NO" ||
    includesAny(text, ["fully automated", "without human", "no human"])
  ) {
    flags.push({
      issue: "Fully automated decision-making",
      severity: useCase.decisionImpact === "HIGH" ? "CRITICAL" : "HIGH",
      explanation:
        "Fully automated decisions need stronger controls, escalation paths, and evidence that affected users can contest outcomes."
    });
  }

  return flags;
}
