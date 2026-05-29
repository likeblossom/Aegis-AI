import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  auditLogs,
  discoveryAuditLogs,
  discoveryOpportunities,
  discoverySessions,
  governanceReports,
  opportunityAnalyses,
  reviewerNotes,
  useCases
} from "@/db/schema";
import { convertOpportunityToProposal } from "./convertOpportunityToProposal";
import {
  createDiscoverySession,
  getDiscoveryOpportunities,
  getOpportunityAnalysis,
  saveOpportunityAnalysis
} from "./discoveryRepository";
import { generateLocalOpportunityAnalysis } from "./generateOpportunityAnalysis";
import { generateLocalOpportunityDiscovery } from "./generateOpportunityDiscovery";
import {
  opportunityDiscoveryInputSchema,
  opportunityDiscoveryResultSchema
} from "./discoveryTypes";

const discoveryInput = {
  businessProblem:
    "Supplier onboarding takes too long because coordinators manually document meetings and follow up on missing information.",
  department: "Procurement",
  affectedTeams: "Supplier onboarding coordinators and procurement analysts",
  currentPainPoints:
    "Manual meeting notes, inconsistent follow-up, missing supplier information, and slow handoffs.",
  goals: "Reduce onboarding cycle time and improve follow-up consistency."
};

describe("opportunity discovery", () => {
  afterEach(() => {
    const sessions = db
      .select()
      .from(discoverySessions)
      .where(eq(discoverySessions.department, discoveryInput.department))
      .all();

    for (const session of sessions) {
      const opportunities = db
        .select()
        .from(discoveryOpportunities)
        .where(eq(discoveryOpportunities.sessionId, session.id))
        .all();

      for (const opportunity of opportunities) {
        db.delete(opportunityAnalyses)
          .where(eq(opportunityAnalyses.opportunityId, opportunity.id))
          .run();
        db.delete(discoveryAuditLogs)
          .where(eq(discoveryAuditLogs.opportunityId, opportunity.id))
          .run();
      }

      db.delete(discoveryAuditLogs)
        .where(eq(discoveryAuditLogs.sessionId, session.id))
        .run();
      db.delete(discoveryOpportunities)
        .where(eq(discoveryOpportunities.sessionId, session.id))
        .run();
      db.delete(discoverySessions)
        .where(eq(discoverySessions.id, session.id))
        .run();
    }

    const rows = db
      .select()
      .from(useCases)
      .where(eq(useCases.title, "Procurement workflow summarization assistant"))
      .all();

    for (const row of rows) {
      db.delete(governanceReports)
        .where(eq(governanceReports.useCaseId, row.id))
        .run();
      db.delete(reviewerNotes).where(eq(reviewerNotes.useCaseId, row.id)).run();
      db.delete(auditLogs).where(eq(auditLogs.useCaseId, row.id)).run();
      db.delete(useCases).where(eq(useCases.id, row.id)).run();
    }
  });

  it("validates discovery input and result schemas", () => {
    expect(opportunityDiscoveryInputSchema.safeParse(discoveryInput).success).toBe(
      true
    );

    const result = generateLocalOpportunityDiscovery(discoveryInput);

    expect(opportunityDiscoveryResultSchema.safeParse(result).success).toBe(true);
    expect(result.opportunities.length).toBeGreaterThanOrEqual(3);
    expect(result.opportunities.length).toBeLessThanOrEqual(5);
  });

  it("generates local fallback opportunities without Azure", () => {
    const result = generateLocalOpportunityDiscovery(discoveryInput);

    expect(result.generationMode).toBe("LOCAL_FALLBACK");
    expect(result.analytics.recommendedOpportunity).toContain("Procurement");
    expect(result.opportunities[0].reasoning).toContain(
      "Supplier onboarding coordinators"
    );
  });

  it("creates a persisted discovery session with opportunities and audit logs", () => {
    const result = generateLocalOpportunityDiscovery(discoveryInput);
    const { session } = createDiscoverySession(discoveryInput, result);
    const opportunities = getDiscoveryOpportunities(session.id);
    const logs = db
      .select()
      .from(discoveryAuditLogs)
      .where(eq(discoveryAuditLogs.sessionId, session.id))
      .all();

    expect(session.id).toBeGreaterThan(0);
    expect(opportunities).toHaveLength(3);
    expect(opportunities[0].opportunity.title).toContain("Procurement");
    expect(logs.map((log) => log.action)).toEqual([
      "OPPORTUNITY_DISCOVERY_STARTED",
      "OPPORTUNITY_DISCOVERY_COMPLETED"
    ]);
  });

  it("generates and stores opportunity analysis with a scorecard", () => {
    const result = generateLocalOpportunityDiscovery(discoveryInput);
    const { session } = createDiscoverySession(discoveryInput, result);
    const [{ record, opportunity }] = getDiscoveryOpportunities(session.id);
    const analysis = generateLocalOpportunityAnalysis({
      input: discoveryInput,
      opportunity
    });

    saveOpportunityAnalysis(record.id, analysis);
    const saved = getOpportunityAnalysis(record.id);

    expect(saved?.analysis.businessCase.expectedValueSummary).toContain(
      opportunity.title
    );
    expect(saved?.analysis.scorecard.businessValue).toBeGreaterThan(0);
    expect(saved?.analysis.scorecard.overallRecommendation).toBeTruthy();
  });

  it("converts a discovered opportunity into a proposal with audit logs", () => {
    const result = generateLocalOpportunityDiscovery(discoveryInput);
    const { session } = createDiscoverySession(discoveryInput, result);
    const opportunity = getDiscoveryOpportunities(session.id)[0].opportunity;

    const created = convertOpportunityToProposal({
      title: opportunity.title,
      department: discoveryInput.department,
      teamOwner: discoveryInput.affectedTeams,
      currentProcess: discoveryInput.businessProblem,
      proposedSolution: opportunity.aiApproach,
      expectedBenefit: opportunity.expectedBenefits.join("\n"),
      dataSensitivity: "INTERNAL",
      decisionImpact: "LOW",
      humanOversightPlanned: "YES",
      affectedStakeholders: discoveryInput.affectedTeams,
      implementationTimeline: "6 weeks"
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.status).toBe("PENDING");

    const logs = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.useCaseId, created.id))
      .all();

    expect(logs.map((log) => log.action)).toEqual([
      "OPPORTUNITY_DISCOVERY_RUN",
      "OPPORTUNITY_CONVERTED_TO_PROPOSAL",
      "PROPOSAL_CREATED"
    ]);
    expect(logs[0].note).toBe("AI opportunity discovery completed.");
    expect(logs[1].note).toBe(
      "Opportunity converted into governance proposal."
    );
  });
});
