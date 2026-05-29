import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const useCases = sqliteTable("use_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  department: text("department").notNull(),
  teamOwner: text("team_owner").notNull(),
  currentProcess: text("current_process").notNull(),
  proposedSolution: text("proposed_solution").notNull(),
  expectedBenefit: text("expected_benefit").notNull(),
  dataSensitivity: text("data_sensitivity").notNull(),
  decisionImpact: text("decision_impact").notNull(),
  humanOversightPlanned: text("human_oversight_planned").notNull(),
  affectedStakeholders: text("affected_stakeholders").notNull(),
  implementationTimeline: text("implementation_timeline").notNull(),
  assignedReviewer: text("assigned_reviewer").notNull().default("Unassigned"),
  status: text("status").notNull().default("PENDING"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  useCaseId: integer("use_case_id")
    .notNull()
    .references(() => useCases.id),
  action: text("action").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const discoverySessions = sqliteTable("discovery_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  businessProblem: text("business_problem").notNull(),
  department: text("department").notNull(),
  affectedTeams: text("affected_teams").notNull(),
  currentPainPoints: text("current_pain_points").notNull(),
  goals: text("goals").notNull().default(""),
  analyticsJson: text("analytics_json").notNull(),
  generationMode: text("generation_mode").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const discoveryOpportunities = sqliteTable("discovery_opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => discoverySessions.id),
  opportunityJson: text("opportunity_json").notNull(),
  title: text("title").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const opportunityAnalyses = sqliteTable("opportunity_analyses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => discoveryOpportunities.id),
  analysisJson: text("analysis_json").notNull(),
  generationMode: text("generation_mode").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const discoveryAuditLogs = sqliteTable("discovery_audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").references(() => discoverySessions.id),
  opportunityId: integer("opportunity_id").references(
    () => discoveryOpportunities.id
  ),
  action: text("action").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const governanceReports = sqliteTable("governance_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  useCaseId: integer("use_case_id")
    .notNull()
    .references(() => useCases.id),
  reportJson: text("report_json").notNull(),
  riskLevel: text("risk_level").notNull(),
  aiReadinessScore: integer("ai_readiness_score").notNull(),
  finalRecommendation: text("final_recommendation").notNull(),
  confidenceLevel: text("confidence_level").notNull(),
  promptVersion: text("prompt_version").notNull().default("deterministic-v1.0"),
  generationProvider: text("generation_provider").notNull().default("LOCAL_FALLBACK"),
  model: text("model"),
  reportVersion: integer("report_version").notNull().default(1),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export const reviewerNotes = sqliteTable("reviewer_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  useCaseId: integer("use_case_id")
    .notNull()
    .references(() => useCases.id),
  status: text("status").notNull(),
  note: text("note").notNull(),
  reviewerName: text("reviewer_name").notNull().default("Governance reviewer"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export type UseCase = typeof useCases.$inferSelect;
export type NewUseCase = typeof useCases.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type DiscoverySession = typeof discoverySessions.$inferSelect;
export type DiscoveryOpportunity = typeof discoveryOpportunities.$inferSelect;
export type OpportunityAnalysis = typeof opportunityAnalyses.$inferSelect;
export type DiscoveryAuditLog = typeof discoveryAuditLogs.$inferSelect;
export type GovernanceReport = typeof governanceReports.$inferSelect;
export type ReviewerNote = typeof reviewerNotes.$inferSelect;
