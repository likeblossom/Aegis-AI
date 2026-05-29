type AuditAction =
  | "OPPORTUNITY_DISCOVERY_STARTED"
  | "OPPORTUNITY_DISCOVERY_COMPLETED"
  | "OPPORTUNITY_ANALYSIS_VIEWED"
  | "OPPORTUNITY_DISCOVERY_RUN"
  | "OPPORTUNITY_CONVERTED_TO_PROPOSAL"
  | "PROPOSAL_CREATED"
  | "REPORT_GENERATED"
  | "REVIEW_STATUS_UPDATED"
  | "REVIEW_NOTE_ADDED"
  | "REVIEW_NOTE_UPDATED"
  | "REVIEWER_ASSIGNED";

type AuditActor = "system" | "ai" | "reviewer" | "proposalOwner";

const enumLabels: Record<string, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  APPROVED_WITH_CONTROLS: "Approved with Controls",
  NEEDS_REVIEW: "Requires Review",
  REJECTED: "Rejected",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
  PUBLIC: "Public",
  INTERNAL: "Internal",
  CONFIDENTIAL: "Confidential",
  SENSITIVE: "Sensitive",
  YES: "Yes",
  PARTIAL: "Partial",
  NO: "No"
};

const actionLabels: Record<AuditAction, string> = {
  OPPORTUNITY_DISCOVERY_STARTED: "Opportunity Discovery Started",
  OPPORTUNITY_DISCOVERY_COMPLETED: "Opportunity Discovery Completed",
  OPPORTUNITY_ANALYSIS_VIEWED: "Opportunity Analysis Viewed",
  OPPORTUNITY_DISCOVERY_RUN: "Opportunity Discovery Run",
  OPPORTUNITY_CONVERTED_TO_PROPOSAL: "Opportunity Converted to Proposal",
  PROPOSAL_CREATED: "Proposal Created",
  REPORT_GENERATED: "Report Generated",
  REVIEW_STATUS_UPDATED: "Review Status Updated",
  REVIEW_NOTE_ADDED: "Review Note Added",
  REVIEW_NOTE_UPDATED: "Review Note Updated",
  REVIEWER_ASSIGNED: "Reviewer Assigned"
};

const actionActors: Record<AuditAction, AuditActor> = {
  OPPORTUNITY_DISCOVERY_STARTED: "proposalOwner",
  OPPORTUNITY_DISCOVERY_COMPLETED: "ai",
  OPPORTUNITY_ANALYSIS_VIEWED: "ai",
  OPPORTUNITY_DISCOVERY_RUN: "ai",
  OPPORTUNITY_CONVERTED_TO_PROPOSAL: "proposalOwner",
  PROPOSAL_CREATED: "proposalOwner",
  REPORT_GENERATED: "ai",
  REVIEW_STATUS_UPDATED: "reviewer",
  REVIEW_NOTE_ADDED: "reviewer",
  REVIEW_NOTE_UPDATED: "reviewer",
  REVIEWER_ASSIGNED: "system"
};

const actorLabels: Record<AuditActor, string> = {
  system: "System",
  ai: "AI Analysis Engine",
  reviewer: "Reviewer",
  proposalOwner: "Proposal Owner"
};

export function formatAuditEnumLabel(value: string) {
  return enumLabels[value] ?? toTitleCase(value);
}

export function formatAuditActionLabel(action: string) {
  return action in actionLabels
    ? actionLabels[action as AuditAction]
    : formatAuditEnumLabel(action);
}

export function getAuditActorLabel(action: string) {
  if (action in actionActors) {
    return actorLabels[actionActors[action as AuditAction]];
  }

  return actorLabels.system;
}

export function buildProposalCreatedAuditNote() {
  return "Proposal submitted through intake form.";
}

export function buildOpportunityDiscoveryRunAuditNote() {
  return "AI opportunity discovery completed.";
}

export function buildOpportunityDiscoveryStartedAuditNote() {
  return "AI opportunity discovery started.";
}

export function buildOpportunityDiscoveryCompletedAuditNote() {
  return "AI opportunity discovery completed.";
}

export function buildOpportunityAnalysisViewedAuditNote() {
  return "Opportunity analysis reviewed.";
}

export function buildOpportunityConvertedAuditNote() {
  return "Opportunity converted into governance proposal.";
}

export function buildReportGeneratedAuditNote({
  analysisMode,
  fallbackReason
}: {
  analysisMode: "AZURE_OPENAI" | "LOCAL_FALLBACK" | "azure" | "deterministic";
  reportVersion: number;
  riskLevel: string;
  fallbackReason: string | null;
}) {
  if (analysisMode === "AZURE_OPENAI" || analysisMode === "azure") {
    return "Governance report generated using Azure OpenAI with deterministic governance guardrails.";
  }

  if (fallbackReason) {
    return "Governance report generated using local fallback analysis after Azure OpenAI was unavailable.";
  }

  return "Governance report generated using local fallback analysis.";
}

export function buildReviewStatusUpdatedAuditNote({
  previousStatus,
  newStatus
}: {
  previousStatus: string;
  newStatus: string;
}) {
  return `Review status updated from ${formatAuditEnumLabel(
    previousStatus
  )} to ${formatAuditEnumLabel(newStatus)}.`;
}

export function buildReviewerAssignedAuditNote({
  previousReviewer,
  newReviewer
}: {
  previousReviewer: string;
  newReviewer: string;
}) {
  if (previousReviewer === newReviewer) {
    return `Reviewer assigned: ${newReviewer}.`;
  }

  return `Reviewer assignment updated from ${previousReviewer} to ${newReviewer}.`;
}

export function buildReviewNoteAddedAuditNote(note: string) {
  const preview = truncateAuditPreview(note);

  if (!preview) {
    return "Reviewer note added.";
  }

  return `Reviewer note added: ${preview}`;
}

export function buildReviewNoteUpdatedAuditNote(note: string) {
  const preview = truncateAuditPreview(note);

  if (!preview) {
    return "Reviewer note updated.";
  }

  return `Reviewer note updated: ${preview}`;
}

export function formatAuditNoteForDisplay(action: string, note: string) {
  const withoutWorkflowId = note
    .replace(/\[workflow\s+[0-9a-f-]{36}\]\s*/gi, "")
    .replace(/\bworkflow\s+[0-9a-f-]{36}\b/gi, "workflow");

  if (action === "REPORT_GENERATED") {
    const riskMatch = withoutWorkflowId.match(/\b(LOW|MEDIUM|HIGH|CRITICAL)\b/i);
    const isFallback = /fallback|local fallback/i.test(withoutWorkflowId);
    return buildReportGeneratedAuditNote({
      analysisMode: !isFallback && withoutWorkflowId.toLowerCase().includes("azure")
        ? "azure"
        : "deterministic",
      reportVersion: 1,
      riskLevel: riskMatch?.[1]?.toUpperCase() ?? "MEDIUM",
      fallbackReason: isFallback ? "fallback" : null
    });
  }

  if (
    action === "OPPORTUNITY_DISCOVERY_RUN" ||
    action === "OPPORTUNITY_DISCOVERY_COMPLETED"
  ) {
    return buildOpportunityDiscoveryCompletedAuditNote();
  }

  if (action === "OPPORTUNITY_DISCOVERY_STARTED") {
    return buildOpportunityDiscoveryStartedAuditNote();
  }

  if (action === "OPPORTUNITY_ANALYSIS_VIEWED") {
    return buildOpportunityAnalysisViewedAuditNote();
  }

  if (action === "OPPORTUNITY_CONVERTED_TO_PROPOSAL") {
    return buildOpportunityConvertedAuditNote();
  }

  if (action === "REVIEW_STATUS_UPDATED") {
    const statusMatch = withoutWorkflowId.match(
      /from\s+([A-Z_]+)\s+to\s+([A-Z_]+)/i
    );

    if (statusMatch) {
      return buildReviewStatusUpdatedAuditNote({
        previousStatus: statusMatch[1].toUpperCase(),
        newStatus: statusMatch[2].toUpperCase()
      });
    }
  }

  if (action === "REVIEW_NOTE_ADDED") {
    const noteMatch = withoutWorkflowId.match(/^Reviewer note added:\s*(.+)$/i);
    if (noteMatch) {
      return buildReviewNoteAddedAuditNote(noteMatch[1]);
    }

    return "Reviewer note added.";
  }

  if (action === "REVIEW_NOTE_UPDATED") {
    const noteMatch = withoutWorkflowId.match(/^Reviewer note updated:\s*(.+)$/i);
    if (noteMatch) {
      return buildReviewNoteUpdatedAuditNote(noteMatch[1]);
    }

    return "Reviewer note updated.";
  }

  if (action === "REVIEWER_ASSIGNED") {
    const assignmentMatch = withoutWorkflowId.match(
      /(?:Assigned reviewer changed|Reviewer assignment updated)\s+from\s+(.+)\s+to\s+(.+)\.$/i
    );

    if (assignmentMatch) {
      return buildReviewerAssignedAuditNote({
        previousReviewer: assignmentMatch[1],
        newReviewer: assignmentMatch[2]
      });
    }
  }

  return replaceRawEnumValues(withoutWorkflowId);
}

function truncateAuditPreview(value: string, maxLength = 96) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function replaceRawEnumValues(value: string) {
  return Object.entries(enumLabels).reduce(
    (current, [enumValue, label]) =>
      current.replace(new RegExp(`\\b${enumValue}\\b`, "g"), label),
    value
  );
}

function toTitleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
