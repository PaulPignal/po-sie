import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export function createDatabase(databasePath: string) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  ensureSchema(db);
  migrateSchema(db);
  return db;
}

function ensureSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      book_number INTEGER NOT NULL,
      book_label TEXT NOT NULL,
      item_number INTEGER NOT NULL,
      text TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      verse_count INTEGER NOT NULL,
      word_count INTEGER NOT NULL,
      estimated_reading_minutes INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'fable',
      author TEXT,
      source_url TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fable_id INTEGER NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
      unit_index INTEGER NOT NULL,
      unit_type TEXT NOT NULL,
      start_verse INTEGER NOT NULL,
      end_verse INTEGER NOT NULL,
      verse_count INTEGER NOT NULL,
      text TEXT NOT NULL,
      UNIQUE (fable_id, unit_index)
    );

    CREATE TABLE IF NOT EXISTS exercise_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fable_id INTEGER NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
      unit_id INTEGER NOT NULL REFERENCES learning_units(id) ON DELETE CASCADE,
      exercise_type TEXT NOT NULL,
      support_level TEXT NOT NULL,
      hints_used INTEGER NOT NULL DEFAULT 0,
      accuracy_score REAL NOT NULL,
      normalized_score REAL NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unit_progress (
      unit_id INTEGER PRIMARY KEY REFERENCES learning_units(id) ON DELETE CASCADE,
      memory_stage INTEGER NOT NULL DEFAULT 0,
      consecutive_criterion_passes INTEGER NOT NULL DEFAULT 0,
      failure_streak INTEGER NOT NULL DEFAULT 0,
      last_support_level TEXT NOT NULL DEFAULT 'high',
      mastery_score REAL NOT NULL DEFAULT 0,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      next_review_at TEXT
    );

    CREATE TABLE IF NOT EXISTS fable_progress (
      fable_id INTEGER PRIMARY KEY REFERENCES fables(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'jamais_vue',
      mastery_score REAL NOT NULL DEFAULT 0,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_stats (
      fable_id INTEGER NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
      exercise_type TEXT NOT NULL,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      avg_score REAL NOT NULL DEFAULT 0,
      best_score REAL NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0,
      last_practiced_at TEXT,
      PRIMARY KEY (fable_id, exercise_type)
    );

    CREATE TABLE IF NOT EXISTS daily_evaluations (
      fable_id INTEGER NOT NULL REFERENCES fables(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      score INTEGER NOT NULL,
      recited_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (fable_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_units_fable_id ON learning_units(fable_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_fable_id ON exercise_sessions(fable_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON exercise_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_unit_progress_next_review_at ON unit_progress(next_review_at);
  `);
}

// Idempotent, additive migrations for databases created before a column existed.
// Safe to run on every boot: each ALTER is guarded, and the backfill only touches NULLs.
function migrateSchema(db: DatabaseSync) {
  const columns = (db.prepare("PRAGMA table_info(fables)").all() as Array<{ name: string }>).map(
    (column) => column.name
  );

  if (!columns.includes("kind")) {
    db.exec("ALTER TABLE fables ADD COLUMN kind TEXT NOT NULL DEFAULT 'fable'");
  }
  if (!columns.includes("author")) {
    db.exec("ALTER TABLE fables ADD COLUMN author TEXT");
  }

  // Every pre-migration row is a La Fontaine fable, so backfill its author once.
  db.exec("UPDATE fables SET author = 'Jean de La Fontaine' WHERE author IS NULL AND kind = 'fable'");
}

export function inTransaction<T>(db: DatabaseSync, callback: () => T) {
  db.exec("BEGIN");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
