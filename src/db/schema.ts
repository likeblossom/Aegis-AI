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
  generationProvider: text("generation_provider").notNull().default("deterministic"),
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
export type GovernanceReport = typeof governanceReports.$inferSelect;
export type ReviewerNote = typeof reviewerNotes.$inferSelect;
