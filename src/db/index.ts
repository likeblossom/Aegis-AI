import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DB_FILE_NAME ?? "aegis.db");
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS discovery_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_problem TEXT NOT NULL,
    department TEXT NOT NULL,
    affected_teams TEXT NOT NULL,
    current_pain_points TEXT NOT NULL,
    goals TEXT NOT NULL DEFAULT '',
    analytics_json TEXT NOT NULL,
    generation_mode TEXT NOT NULL,
    model TEXT,
    prompt_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS discovery_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES discovery_sessions(id),
    opportunity_json TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS opportunity_analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER NOT NULL REFERENCES discovery_opportunities(id),
    analysis_json TEXT NOT NULL,
    generation_mode TEXT NOT NULL,
    model TEXT,
    prompt_version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS discovery_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES discovery_sessions(id),
    opportunity_id INTEGER REFERENCES discovery_opportunities(id),
    action TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export const db = drizzle(sqlite, { schema });
