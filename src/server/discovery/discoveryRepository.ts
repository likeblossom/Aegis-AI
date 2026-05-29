import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  discoveryAuditLogs,
  discoveryOpportunities,
  discoverySessions,
  opportunityAnalyses
} from "@/db/schema";
import {
  buildOpportunityAnalysisViewedAuditNote,
  buildOpportunityDiscoveryCompletedAuditNote,
  buildOpportunityDiscoveryStartedAuditNote
} from "@/lib/audit-log-formatter";
import {
  opportunityAnalysisSchema,
  opportunitySchema,
  type DiscoveredOpportunity,
  type OpportunityAnalysisResult,
  type OpportunityDiscoveryInput,
  type OpportunityDiscoveryResult
} from "./discoveryTypes";

export function createDiscoverySession(
  input: OpportunityDiscoveryInput,
  result: OpportunityDiscoveryResult
) {
  const session = db
    .insert(discoverySessions)
    .values({
      businessProblem: input.businessProblem,
      department: input.department,
      affectedTeams: input.affectedTeams,
      currentPainPoints: input.currentPainPoints,
      goals: input.goals ?? "",
      analyticsJson: JSON.stringify(result.analytics),
      generationMode: result.generationMode,
      model: result.modelDeployment ?? null,
      promptVersion: result.promptVersion
    })
    .returning()
    .get();

  db.insert(discoveryAuditLogs)
    .values([
      {
        sessionId: session.id,
        action: "OPPORTUNITY_DISCOVERY_STARTED",
        note: buildOpportunityDiscoveryStartedAuditNote()
      },
      {
        sessionId: session.id,
        action: "OPPORTUNITY_DISCOVERY_COMPLETED",
        note: buildOpportunityDiscoveryCompletedAuditNote()
      }
    ])
    .run();

  const opportunities = result.opportunities.map((opportunity) =>
    db
      .insert(discoveryOpportunities)
      .values({
        sessionId: session.id,
        opportunityJson: JSON.stringify(opportunity),
        title: opportunity.title
      })
      .returning()
      .get()
  );

  return { session, opportunities };
}

export function getDiscoverySession(sessionId: number) {
  return db
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.id, sessionId))
    .get();
}

export function getRecentDiscoverySessions(limit = 10) {
  return db
    .select()
    .from(discoverySessions)
    .orderBy(desc(discoverySessions.createdAt))
    .limit(limit)
    .all();
}

export function getDiscoveryOpportunities(sessionId: number) {
  return db
    .select()
    .from(discoveryOpportunities)
    .where(eq(discoveryOpportunities.sessionId, sessionId))
    .all()
    .map((record) => ({
      record,
      opportunity: opportunitySchema.parse(JSON.parse(record.opportunityJson))
    }));
}

export function getDiscoveryOpportunity(opportunityId: number) {
  const record = db
    .select()
    .from(discoveryOpportunities)
    .where(eq(discoveryOpportunities.id, opportunityId))
    .get();

  if (!record) {
    return null;
  }

  const session = getDiscoverySession(record.sessionId);

  if (!session) {
    return null;
  }

  return {
    record,
    session,
    opportunity: opportunitySchema.parse(
      JSON.parse(record.opportunityJson)
    ) as DiscoveredOpportunity
  };
}

export function getOpportunityAnalysis(opportunityId: number) {
  const record = db
    .select()
    .from(opportunityAnalyses)
    .where(eq(opportunityAnalyses.opportunityId, opportunityId))
    .get();

  if (!record) {
    return null;
  }

  return {
    record,
    analysis: opportunityAnalysisSchema.parse(
      JSON.parse(record.analysisJson)
    ) as OpportunityAnalysisResult
  };
}

export function saveOpportunityAnalysis(
  opportunityId: number,
  analysis: OpportunityAnalysisResult
) {
  const record = db
    .insert(opportunityAnalyses)
    .values({
      opportunityId,
      analysisJson: JSON.stringify(analysis),
      generationMode: analysis.generationMode,
      model: analysis.modelDeployment ?? null,
      promptVersion: analysis.promptVersion
    })
    .returning()
    .get();

  db.insert(discoveryAuditLogs)
    .values({
      opportunityId,
      action: "OPPORTUNITY_ANALYSIS_VIEWED",
      note: buildOpportunityAnalysisViewedAuditNote()
    })
    .run();

  return record;
}

export function getDiscoveryAuditLogs(sessionId: number) {
  return db
    .select()
    .from(discoveryAuditLogs)
    .where(eq(discoveryAuditLogs.sessionId, sessionId))
    .all();
}
