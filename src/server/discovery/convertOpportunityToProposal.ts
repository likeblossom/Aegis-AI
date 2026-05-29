import { db } from "@/db";
import { auditLogs, useCases } from "@/db/schema";
import {
  buildOpportunityConvertedAuditNote,
  buildOpportunityDiscoveryRunAuditNote,
  buildProposalCreatedAuditNote
} from "@/lib/audit-log-formatter";
import { DEFAULT_USE_CASE_STATUS } from "@/lib/constants";
import type { CreateUseCaseInput } from "@/lib/validations";

export function convertOpportunityToProposal(proposal: CreateUseCaseInput) {
  const created = db
    .insert(useCases)
    .values({
      ...proposal,
      status: DEFAULT_USE_CASE_STATUS
    })
    .returning()
    .get();

  db.insert(auditLogs)
    .values([
      {
        useCaseId: created.id,
        action: "OPPORTUNITY_DISCOVERY_RUN",
        note: buildOpportunityDiscoveryRunAuditNote()
      },
      {
        useCaseId: created.id,
        action: "OPPORTUNITY_CONVERTED_TO_PROPOSAL",
        note: buildOpportunityConvertedAuditNote()
      },
      {
        useCaseId: created.id,
        action: "PROPOSAL_CREATED",
        note: buildProposalCreatedAuditNote()
      }
    ])
    .run();

  return created;
}
