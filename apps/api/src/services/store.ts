import type {
  ContentKind,
  Difficulty,
  ExerciseResult,
  ExerciseStat,
  ExerciseSubmission,
  ExerciseType,
  FableDetail,
  FableFilters,
  FableListItem,
  LearningStatus,
  LearningUnit,
  ProgressSnapshot,
  ReviewQueueItem,
  SupportLevel,
  UnitProgressSnapshot
} from "@la-fontaine/shared";
import type { DatabaseSync } from "node:sqlite";
import { inTransaction } from "../db/database";
import {
  computeMasteryScore,
  computeNextUnitProgress,
  CurrentUnitProgress,
  deriveFableStatus
} from "./progress";
import { formatVerseRangeLabel, recommendedSupportFromStage, splitVerses } from "../utils/text";

export interface ImportedFableRecord {
  slug: string;
  title: string;
  kind?: ContentKind;
  author?: string | null;
  bookNumber: number;
  bookLabel: string;
  itemNumber: number;
  text: string;
  textHash: string;
  verseCount: number;
  wordCount: number;
  estimatedReadingMinutes: number;
  difficulty: Difficulty;
  sourceUrl: string;
  units: Array<Omit<LearningUnit, "id">>;
}

export interface ExerciseContext {
  fableId: number;
  slug: string;
  title: string;
  bookLabel: string;
  unit: LearningUnit;
  unitProgress: UnitProgressSnapshot;
  allVerses: string[];
}

export function countFables(db: DatabaseSync) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM fables").get() as { count: number };
  return row.count;
}

export function upsertImportedFable(db: DatabaseSync, record: ImportedFableRecord) {
  return inTransaction(db, () => {
    const now = new Date().toISOString();
    const existing = db
      .prepare("SELECT id, text_hash AS textHash FROM fables WHERE slug = :slug")
      .get({ slug: record.slug }) as { id: number; textHash: string } | undefined;

    let fableId = existing?.id ?? 0;
    let outcome: "inserted" | "updated" | "unchanged" = "inserted";

    if (!existing) {
      const baseParams = recordToSqlParams(record);
      const result = db
        .prepare(`
          INSERT INTO fables (
            slug, title, book_number, book_label, item_number, text, text_hash,
            verse_count, word_count, estimated_reading_minutes, difficulty,
            kind, author, source_url, imported_at, updated_at
          ) VALUES (
            :slug, :title, :bookNumber, :bookLabel, :itemNumber, :text, :textHash,
            :verseCount, :wordCount, :estimatedReadingMinutes, :difficulty,
            :kind, :author, :sourceUrl, :importedAt, :updatedAt
          )
        `)
        .run({
          ...baseParams,
          importedAt: now,
          updatedAt: now
        }) as { lastInsertRowid: number };

      fableId = Number(result.lastInsertRowid);
      db.prepare(`
        INSERT INTO fable_progress (fable_id, status, mastery_score, attempts_count, last_reviewed_at, updated_at)
        VALUES (:fableId, 'jamais_vue', 0, 0, NULL, :updatedAt)
      `).run({
        fableId,
        updatedAt: now
      });
    } else {
      outcome = existing.textHash === record.textHash ? "unchanged" : "updated";
      const { slug: _slug, ...baseParams } = recordToSqlParams(record);
      db.prepare(`
        UPDATE fables
        SET title = :title,
            book_number = :bookNumber,
            book_label = :bookLabel,
            item_number = :itemNumber,
            text = :text,
            text_hash = :textHash,
            verse_count = :verseCount,
            word_count = :wordCount,
            estimated_reading_minutes = :estimatedReadingMinutes,
            difficulty = :difficulty,
            kind = :kind,
            author = :author,
            source_url = :sourceUrl,
            updated_at = :updatedAt
        WHERE id = :fableId
      `).run({
        ...baseParams,
        fableId: existing.id,
        updatedAt: now
      });
      fableId = existing.id;
      db.prepare(`
        INSERT INTO fable_progress (fable_id, status, mastery_score, attempts_count, last_reviewed_at, updated_at)
        VALUES (:fableId, 'jamais_vue', 0, 0, NULL, :updatedAt)
        ON CONFLICT(fable_id) DO NOTHING
      `).run({
        fableId,
        updatedAt: now
      });
    }

    const existingUnits = db
      .prepare("SELECT id, unit_index AS unitIndex FROM learning_units WHERE fable_id = :fableId")
      .all({ fableId }) as Array<{ id: number; unitIndex: number }>;

    const byIndex = new Map(existingUnits.map((unit) => [unit.unitIndex, unit.id]));
    const keptIndexes = new Set<number>();

    for (const unit of record.units) {
      keptIndexes.add(unit.unitIndex);
      const existingUnitId = byIndex.get(unit.unitIndex);

      if (existingUnitId) {
        db.prepare(`
          UPDATE learning_units
          SET unit_type = :unitType,
              start_verse = :startVerse,
              end_verse = :endVerse,
              verse_count = :verseCount,
              text = :text
          WHERE id = :unitId
        `).run({
          unitId: existingUnitId,
          unitType: unit.unitType,
          startVerse: unit.startVerse,
          endVerse: unit.endVerse,
          verseCount: unit.verseCount,
          text: unit.text
        });
        db.prepare(`
          INSERT INTO unit_progress (
            unit_id, memory_stage, consecutive_criterion_passes, failure_streak,
            last_support_level, mastery_score, attempts_count, success_count,
            last_reviewed_at, next_review_at
          ) VALUES (
            :unitId, 0, 0, 0, 'high', 0, 0, 0, NULL, :nextReviewAt
          )
          ON CONFLICT(unit_id) DO NOTHING
        `).run({
          unitId: existingUnitId,
          nextReviewAt: now
        });
      } else {
        const insertedUnit = db
          .prepare(`
            INSERT INTO learning_units (
              fable_id, unit_index, unit_type, start_verse, end_verse, verse_count, text
            ) VALUES (
              :fableId, :unitIndex, :unitType, :startVerse, :endVerse, :verseCount, :text
            )
          `)
          .run({
            fableId,
            unitIndex: unit.unitIndex,
            unitType: unit.unitType,
            startVerse: unit.startVerse,
            endVerse: unit.endVerse,
            verseCount: unit.verseCount,
            text: unit.text
          }) as { lastInsertRowid: number };

        const unitId = Number(insertedUnit.lastInsertRowid);
        db.prepare(`
          INSERT INTO unit_progress (
            unit_id, memory_stage, consecutive_criterion_passes, failure_streak,
            last_support_level, mastery_score, attempts_count, success_count,
            last_reviewed_at, next_review_at
          ) VALUES (
            :unitId, 0, 0, 0, 'high', 0, 0, 0, NULL, :nextReviewAt
          )
        `).run({
          unitId,
          nextReviewAt: now
        });
      }
    }

    for (const unit of existingUnits) {
      if (!keptIndexes.has(unit.unitIndex)) {
        db.prepare("DELETE FROM learning_units WHERE id = :id").run({ id: unit.id });
      }
    }

    return { fableId, outcome };
  });
}

export function listFables(db: DatabaseSync, filters: FableFilters = {}): FableListItem[] {
  const clauses = ["1 = 1"];
  const params: Record<string, string | number> = {
    now: new Date().toISOString()
  };

  if (filters.query) {
    clauses.push("LOWER(f.title) LIKE :query");
    params.query = `%${filters.query.toLowerCase()}%`;
  }

  if (filters.status && filters.status !== "tous") {
    clauses.push("COALESCE(fp.status, 'jamais_vue') = :status");
    params.status = filters.status;
  }

  if (filters.kind && filters.kind !== "tous") {
    clauses.push("f.kind = :kind");
    params.kind = filters.kind;
  }

  if (filters.difficulty && filters.difficulty !== "toutes") {
    clauses.push("f.difficulty = :difficulty");
    params.difficulty = filters.difficulty;
  }

  if (filters.length === "courte") {
    clauses.push("f.verse_count <= 16");
  } else if (filters.length === "moyenne") {
    clauses.push("f.verse_count BETWEEN 17 AND 32");
  } else if (filters.length === "longue") {
    clauses.push("f.verse_count > 32");
  }

  const orderBy = getOrderBy(filters.sort);

  const rows = db
    .prepare(`
      SELECT
        f.slug,
        f.title,
        f.kind,
        f.author,
        f.book_number AS bookNumber,
        f.book_label AS bookLabel,
        f.item_number AS itemNumber,
        f.verse_count AS verseCount,
        f.estimated_reading_minutes AS estimatedReadingMinutes,
        f.difficulty,
        COALESCE(fp.status, 'jamais_vue') AS status,
        COALESCE(fp.mastery_score, 0) AS masteryScore,
        fp.last_reviewed_at AS lastReviewedAt,
        (
          SELECT COUNT(*)
          FROM learning_units lu
          LEFT JOIN unit_progress up ON up.unit_id = lu.id
          WHERE lu.fable_id = f.id
            AND (up.next_review_at IS NULL OR up.next_review_at <= :now)
        ) AS dueUnits
      FROM fables f
      LEFT JOIN fable_progress fp ON fp.fable_id = f.id
      WHERE ${clauses.join(" AND ")}
      ORDER BY ${orderBy}
    `)
    .all(params) as Array<Record<string, string | number | null>>;

  return rows.map((row) => ({
    slug: String(row.slug),
    title: String(row.title),
    kind: (row.kind as ContentKind | null) ?? "fable",
    author: (row.author as string | null) ?? null,
    bookNumber: Number(row.bookNumber),
    bookLabel: String(row.bookLabel),
    itemNumber: Number(row.itemNumber),
    verseCount: Number(row.verseCount),
    estimatedReadingMinutes: Number(row.estimatedReadingMinutes),
    difficulty: row.difficulty as Difficulty,
    status: row.status as LearningStatus,
    masteryScore: Number(row.masteryScore),
    lastReviewedAt: (row.lastReviewedAt as string | null) ?? null,
    dueUnits: Number(row.dueUnits)
  }));
}

export function getFableDetail(db: DatabaseSync, slug: string): FableDetail | null {
  const row = db
    .prepare(`
      SELECT
        f.id,
        f.slug,
        f.title,
        f.kind,
        f.author,
        f.book_number AS bookNumber,
        f.book_label AS bookLabel,
        f.item_number AS itemNumber,
        f.verse_count AS verseCount,
        f.word_count AS wordCount,
        f.estimated_reading_minutes AS estimatedReadingMinutes,
        f.difficulty,
        f.source_url AS sourceUrl,
        f.text
      FROM fables f
      WHERE f.slug = :slug
    `)
    .get({ slug }) as Record<string, string | number> | undefined;

  if (!row) {
    return null;
  }

  const fableId = Number(row.id);
  const progress = getProgressSnapshot(db, fableId);
  const units = getLearningUnits(db, fableId);
  const unitProgress = getUnitProgressForFable(db, fableId);
  const exerciseStats = db
    .prepare(`
      SELECT
        exercise_type AS exerciseType,
        attempts_count AS attemptsCount,
        avg_score AS avgScore,
        best_score AS bestScore,
        success_rate AS successRate,
        last_practiced_at AS lastPracticedAt
      FROM exercise_stats
      WHERE fable_id = :fableId
      ORDER BY exerciseType
    `)
    .all({ fableId }) as Array<Record<string, string | number | null>>;

  return {
    slug: String(row.slug),
    title: String(row.title),
    kind: (row.kind as ContentKind | null) ?? "fable",
    author: (row.author as string | null) ?? null,
    bookNumber: Number(row.bookNumber),
    bookLabel: String(row.bookLabel),
    itemNumber: Number(row.itemNumber),
    verseCount: Number(row.verseCount),
    wordCount: Number(row.wordCount),
    estimatedReadingMinutes: Number(row.estimatedReadingMinutes),
    difficulty: row.difficulty as Difficulty,
    sourceUrl: String(row.sourceUrl),
    text: String(row.text),
    progress,
    units,
    unitProgress,
    exerciseStats: exerciseStats.map((item) => ({
      exerciseType: item.exerciseType as ExerciseType,
      attemptsCount: Number(item.attemptsCount),
      avgScore: Number(item.avgScore),
      bestScore: Number(item.bestScore),
      successRate: Number(item.successRate),
      lastPracticedAt: (item.lastPracticedAt as string | null) ?? null
    }))
  };
}

export function getExerciseContext(
  db: DatabaseSync,
  slug: string,
  unitIndex?: number
): ExerciseContext | null {
  const fable = db
    .prepare("SELECT id, slug, title, book_label AS bookLabel, text FROM fables WHERE slug = :slug")
    .get({ slug }) as
    | { id: number; slug: string; title: string; bookLabel: string; text: string }
    | undefined;

  if (!fable) {
    return null;
  }

  const units = getLearningUnits(db, fable.id);
  const selectedUnit =
    units.find((item) => item.unitIndex === unitIndex) ??
    getDueUnitForFable(db, fable.id) ??
    units.at(0);

  if (!selectedUnit) {
    return null;
  }

  const unitProgress = getUnitProgressByUnitId(db, selectedUnit.id, selectedUnit.unitIndex);

  return {
    fableId: fable.id,
    slug: fable.slug,
    title: fable.title,
    bookLabel: fable.bookLabel,
    unit: selectedUnit,
    unitProgress,
    allVerses: splitVerses(fable.text)
  };
}

export function getReviewQueue(db: DatabaseSync, limit = 8): ReviewQueueItem[] {
  const rows = db
    .prepare(`
      SELECT
        f.slug,
        f.title,
        lu.unit_index AS unitIndex,
        lu.start_verse AS startVerse,
        lu.end_verse AS endVerse,
        COALESCE(up.next_review_at, f.imported_at) AS nextReviewAt,
        COALESCE(up.memory_stage, 0) AS memoryStage
      FROM learning_units lu
      JOIN fables f ON f.id = lu.fable_id
      LEFT JOIN unit_progress up ON up.unit_id = lu.id
      WHERE up.next_review_at IS NULL OR up.next_review_at <= :now
      ORDER BY nextReviewAt ASC, memoryStage ASC, f.title ASC, lu.unit_index ASC
      LIMIT :fetchLimit
    `)
    .all({
      now: new Date().toISOString(),
      fetchLimit: limit * 3
    }) as Array<Record<string, string | number | null>>;

  const scheduled: typeof rows = [];
  const pool = [...rows];

  while (pool.length > 0 && scheduled.length < limit) {
    const lastTwo = scheduled.slice(-2);
    let nextIndex = pool.findIndex((candidate) => {
      if (lastTwo.length < 2) {
        return true;
      }

      return !lastTwo.every((entry) => entry.slug === candidate.slug);
    });

    if (nextIndex === -1) {
      nextIndex = 0;
    }

    const [candidate] = pool.splice(nextIndex, 1);
    if (candidate) {
      scheduled.push(candidate);
    }
  }

  return scheduled.map((row) => ({
    slug: String(row.slug),
    title: String(row.title),
    unitIndex: Number(row.unitIndex),
    exerciseType: pickExerciseType(Number(row.unitIndex), Number(row.memoryStage)),
    supportLevel: recommendedSupportFromStage(Number(row.memoryStage)),
    nextReviewAt: (row.nextReviewAt as string | null) ?? null,
    memoryStage: Number(row.memoryStage),
    verseRangeLabel: formatVerseRangeLabel({
      startVerse: Number(row.startVerse),
      endVerse: Number(row.endVerse)
    })
  }));
}

export function getDashboard(db: DatabaseSync) {
  const totals = db
    .prepare(`
      SELECT
        COUNT(*) AS totalFables,
        SUM(CASE WHEN COALESCE(fp.status, 'jamais_vue') = 'en_cours' THEN 1 ELSE 0 END) AS startedFables,
        SUM(CASE WHEN COALESCE(fp.status, 'jamais_vue') = 'maîtrisée' THEN 1 ELSE 0 END) AS masteredFables
      FROM fables f
      LEFT JOIN fable_progress fp ON fp.fable_id = f.id
    `)
    .get() as { totalFables: number; startedFables: number | null; masteredFables: number | null };

  const dueUnitsRow = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM unit_progress
      WHERE next_review_at IS NULL OR next_review_at <= :now
    `)
    .get({ now: new Date().toISOString() }) as { count: number };

  const sessionTotals = db
    .prepare(`
      SELECT
        COUNT(*) AS totalSessions,
        COALESCE(SUM(latency_ms), 0) AS totalLatency
      FROM exercise_sessions
    `)
    .get() as { totalSessions: number; totalLatency: number };

  const recentFables = db
    .prepare(`
      SELECT
        f.slug,
        f.title,
        COALESCE(fp.mastery_score, 0) AS masteryScore,
        fp.last_reviewed_at AS lastReviewedAt,
        COALESCE(fp.status, 'jamais_vue') AS status
      FROM fables f
      LEFT JOIN fable_progress fp ON fp.fable_id = f.id
      WHERE fp.last_reviewed_at IS NOT NULL
      ORDER BY fp.last_reviewed_at DESC
      LIMIT 6
    `)
    .all() as Array<Record<string, string | number | null>>;

  const progressByStatus = db
    .prepare(`
      SELECT
        COALESCE(fp.status, 'jamais_vue') AS status,
        COUNT(*) AS count
      FROM fables f
      LEFT JOIN fable_progress fp ON fp.fable_id = f.id
      GROUP BY status
    `)
    .all() as Array<{ status: LearningStatus; count: number }>;

  const recentSessions = db
    .prepare(`
      SELECT
        f.slug,
        f.title,
        es.exercise_type AS exerciseType,
        es.normalized_score AS normalizedScore,
        es.created_at AS createdAt
      FROM exercise_sessions es
      JOIN fables f ON f.id = es.fable_id
      ORDER BY es.created_at DESC
      LIMIT 10
    `)
    .all() as Array<Record<string, string | number>>;

  const activity = db
    .prepare(`
      SELECT
        substr(created_at, 1, 10) AS date,
        COUNT(*) AS sessions
      FROM exercise_sessions
      WHERE created_at >= :since
      GROUP BY date
      ORDER BY date ASC
    `)
    .all({
      since: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString()
    }) as Array<{ date: string; sessions: number }>;

  const dateIndex = new Map(activity.map((item) => [item.date, item.sessions]));
  const activity14Days = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (13 - offset));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      sessions: dateIndex.get(key) ?? 0
    };
  });

  return {
    totalFables: totals.totalFables,
    startedFables: Number(totals.startedFables ?? 0),
    masteredFables: Number(totals.masteredFables ?? 0),
    dueUnits: dueUnitsRow.count,
    totalSessions: sessionTotals.totalSessions,
    minutesPracticed: Math.round(sessionTotals.totalLatency / 60000),
    dueNow: getReviewQueue(db, 8),
    recentFables: recentFables.map((item) => ({
      slug: String(item.slug),
      title: String(item.title),
      masteryScore: Number(item.masteryScore),
      lastReviewedAt: (item.lastReviewedAt as string | null) ?? null,
      status: item.status as LearningStatus
    })),
    progressByStatus: ensureStatusBuckets(progressByStatus),
    activity14Days,
    recentSessions: recentSessions.map((item) => ({
      slug: String(item.slug),
      title: String(item.title),
      exerciseType: item.exerciseType as ExerciseType,
      normalizedScore: Number(item.normalizedScore),
      createdAt: String(item.createdAt)
    }))
  };
}

export function persistExerciseResult(
  db: DatabaseSync,
  context: ExerciseContext,
  submission: ExerciseSubmission,
  accuracyScore: number,
  result: Pick<
    ExerciseResult,
    "normalizedScore" | "criterionPassed" | "recommendation" | "nextReviewAt" | "recommendedSupportLevel" | "corrections"
  >
) {
  return inTransaction(db, () => {
    const now = new Date();
    const nowIso = now.toISOString();
    db.prepare(`
      INSERT INTO exercise_sessions (
        fable_id, unit_id, exercise_type, support_level, hints_used,
        accuracy_score, normalized_score, latency_ms,
        payload_json, created_at
      ) VALUES (
        :fableId, :unitId, :exerciseType, :supportLevel, :hintsUsed,
        :accuracyScore, :normalizedScore, :latencyMs,
        :payloadJson, :createdAt
      )
    `).run({
      fableId: context.fableId,
      unitId: context.unit.id,
      exerciseType: submission.type,
      supportLevel: submission.supportLevel,
      hintsUsed: submission.hintsUsed,
      accuracyScore,
      normalizedScore: result.normalizedScore,
      latencyMs: submission.latencyMs,
      payloadJson: JSON.stringify(submission),
      createdAt: nowIso
    });

    const current = getUnitProgressByUnitId(db, context.unit.id, context.unit.unitIndex);
    const nextState = computeNextUnitProgress({
      current: toCurrentUnitProgress(current),
      now,
      normalizedScore: result.normalizedScore,
      criterionPassed: result.criterionPassed,
      supportLevel: submission.supportLevel
    });

    const masteryScore = computeMasteryScore(getRecentUnitSessions(db, context.unit.id));
    db.prepare(`
      UPDATE unit_progress
      SET memory_stage = :memoryStage,
          consecutive_criterion_passes = :consecutiveCriterionPasses,
          failure_streak = :failureStreak,
          last_support_level = :lastSupportLevel,
          mastery_score = :masteryScore,
          attempts_count = :attemptsCount,
          success_count = :successCount,
          last_reviewed_at = :lastReviewedAt,
          next_review_at = :nextReviewAt
      WHERE unit_id = :unitId
    `).run({
      unitId: context.unit.id,
      memoryStage: nextState.memoryStage,
      consecutiveCriterionPasses: nextState.consecutiveCriterionPasses,
      failureStreak: nextState.failureStreak,
      lastSupportLevel: nextState.lastSupportLevel,
      masteryScore,
      attemptsCount: nextState.attemptsCount,
      successCount: nextState.successCount,
      lastReviewedAt: nextState.lastReviewedAt,
      nextReviewAt: nextState.nextReviewAt
    });

    refreshExerciseStats(db, context.fableId, submission.type);
    const fableProgress = recomputeFableProgress(db, context.fableId);
    const unitProgress = getUnitProgressByUnitId(db, context.unit.id, context.unit.unitIndex);

    return {
      normalizedScore: result.normalizedScore,
      accuracyScore,
      criterionPassed: result.criterionPassed,
      recommendation: result.recommendation,
      nextReviewAt: result.nextReviewAt,
      recommendedSupportLevel: result.recommendedSupportLevel,
      corrections: result.corrections,
      unitProgress,
      fableProgress
    };
  });
}

export function getProgressSnapshot(db: DatabaseSync, fableId: number): ProgressSnapshot {
  const row = db
    .prepare(`
      SELECT
        COALESCE(status, 'jamais_vue') AS status,
        COALESCE(mastery_score, 0) AS masteryScore,
        COALESCE(attempts_count, 0) AS attemptsCount,
        last_reviewed_at AS lastReviewedAt
      FROM fable_progress
      WHERE fable_id = :fableId
    `)
    .get({ fableId }) as
    | { status: LearningStatus; masteryScore: number; attemptsCount: number; lastReviewedAt: string | null }
    | undefined;

  const stageRows = db
    .prepare(`
      SELECT COALESCE(memory_stage, 0) AS stage, COUNT(*) AS count
      FROM learning_units lu
      LEFT JOIN unit_progress up ON up.unit_id = lu.id
      WHERE lu.fable_id = :fableId
      GROUP BY stage
    `)
    .all({ fableId }) as Array<{ stage: number; count: number }>;

  const dueUnits = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM learning_units lu
      LEFT JOIN unit_progress up ON up.unit_id = lu.id
      WHERE lu.fable_id = :fableId
        AND (up.next_review_at IS NULL OR up.next_review_at <= :now)
    `)
    .get({
      fableId,
      now: new Date().toISOString()
    }) as { count: number };

  const stageCounts: Record<string, number> = {};
  for (const stage of stageRows) {
    stageCounts[String(stage.stage)] = stage.count;
  }

  return {
    status: row?.status ?? "jamais_vue",
    masteryScore: Number(row?.masteryScore ?? 0),
    attemptsCount: Number(row?.attemptsCount ?? 0),
    lastReviewedAt: row?.lastReviewedAt ?? null,
    dueUnits: dueUnits.count,
    stageCounts
  };
}

function getLearningUnits(db: DatabaseSync, fableId: number): LearningUnit[] {
  const rows = db
    .prepare(`
      SELECT
        id,
        unit_index AS unitIndex,
        unit_type AS unitType,
        start_verse AS startVerse,
        end_verse AS endVerse,
        verse_count AS verseCount,
        text
      FROM learning_units
      WHERE fable_id = :fableId
      ORDER BY unit_index ASC
    `)
    .all({ fableId }) as Array<Record<string, string | number>>;

  return rows.map((row) => ({
    id: Number(row.id),
    unitIndex: Number(row.unitIndex),
    unitType: row.unitType as "strophe" | "bloc",
    startVerse: Number(row.startVerse),
    endVerse: Number(row.endVerse),
    verseCount: Number(row.verseCount),
    text: String(row.text),
    verses: splitVerses(String(row.text))
  }));
}

function getUnitProgressForFable(db: DatabaseSync, fableId: number): UnitProgressSnapshot[] {
  const rows = db
    .prepare(`
      SELECT
        lu.id AS unitId,
        lu.unit_index AS unitIndex,
        COALESCE(up.memory_stage, 0) AS memoryStage,
        COALESCE(up.consecutive_criterion_passes, 0) AS consecutiveCriterionPasses,
        COALESCE(up.failure_streak, 0) AS failureStreak,
        COALESCE(up.last_support_level, 'high') AS lastSupportLevel,
        COALESCE(up.mastery_score, 0) AS masteryScore,
        COALESCE(up.attempts_count, 0) AS attemptsCount,
        COALESCE(up.success_count, 0) AS successCount,
        up.last_reviewed_at AS lastReviewedAt,
        up.next_review_at AS nextReviewAt
      FROM learning_units lu
      LEFT JOIN unit_progress up ON up.unit_id = lu.id
      WHERE lu.fable_id = :fableId
      ORDER BY lu.unit_index ASC
    `)
    .all({ fableId }) as Array<Record<string, string | number | null>>;

  return rows.map(mapUnitProgressRow);
}

function getDueUnitForFable(db: DatabaseSync, fableId: number) {
  const row = db
    .prepare(`
      SELECT lu.id
      FROM learning_units lu
      LEFT JOIN unit_progress up ON up.unit_id = lu.id
      WHERE lu.fable_id = :fableId
        AND (up.next_review_at IS NULL OR up.next_review_at <= :now)
      ORDER BY up.next_review_at ASC, lu.unit_index ASC
      LIMIT 1
    `)
    .get({
      fableId,
      now: new Date().toISOString()
    }) as { id: number } | undefined;

  if (!row) {
    return null;
  }

  return getLearningUnits(db, fableId).find((unit) => unit.id === row.id) ?? null;
}

function getUnitProgressByUnitId(
  db: DatabaseSync,
  unitId: number,
  unitIndex: number
): UnitProgressSnapshot {
  const row = db
    .prepare(`
      SELECT
        :unitIndex AS unitIndex,
        unit_id AS unitId,
        COALESCE(memory_stage, 0) AS memoryStage,
        COALESCE(consecutive_criterion_passes, 0) AS consecutiveCriterionPasses,
        COALESCE(failure_streak, 0) AS failureStreak,
        COALESCE(last_support_level, 'high') AS lastSupportLevel,
        COALESCE(mastery_score, 0) AS masteryScore,
        COALESCE(attempts_count, 0) AS attemptsCount,
        COALESCE(success_count, 0) AS successCount,
        last_reviewed_at AS lastReviewedAt,
        next_review_at AS nextReviewAt
      FROM unit_progress
      WHERE unit_id = :unitId
    `)
    .get({
      unitId,
      unitIndex
    }) as Record<string, string | number | null> | undefined;

  if (!row) {
    return {
      unitId,
      unitIndex,
      memoryStage: 0,
      consecutiveCriterionPasses: 0,
      failureStreak: 0,
      lastSupportLevel: "high",
      masteryScore: 0,
      attemptsCount: 0,
      successCount: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date().toISOString()
    };
  }

  return mapUnitProgressRow(row);
}

function mapUnitProgressRow(row: Record<string, string | number | null>): UnitProgressSnapshot {
  return {
    unitId: Number(row.unitId),
    unitIndex: Number(row.unitIndex),
    memoryStage: Number(row.memoryStage),
    consecutiveCriterionPasses: Number(row.consecutiveCriterionPasses),
    failureStreak: Number(row.failureStreak),
    lastSupportLevel: row.lastSupportLevel as SupportLevel,
    masteryScore: Number(row.masteryScore),
    attemptsCount: Number(row.attemptsCount),
    successCount: Number(row.successCount),
    lastReviewedAt: (row.lastReviewedAt as string | null) ?? null,
    nextReviewAt: (row.nextReviewAt as string | null) ?? null
  };
}

function getRecentUnitSessions(db: DatabaseSync, unitId: number) {
  return db
    .prepare(`
      SELECT normalized_score AS normalizedScore, created_at AS createdAt
      FROM exercise_sessions
      WHERE unit_id = :unitId
      ORDER BY created_at DESC
      LIMIT 8
    `)
    .all({ unitId }) as Array<{ normalizedScore: number; createdAt: string }>;
}

function refreshExerciseStats(db: DatabaseSync, fableId: number, exerciseType: ExerciseType) {
  const row = db
    .prepare(`
      SELECT
        COUNT(*) AS attemptsCount,
        COALESCE(AVG(normalized_score), 0) AS avgScore,
        COALESCE(MAX(normalized_score), 0) AS bestScore,
        COALESCE(AVG(CASE WHEN normalized_score >= 70 THEN 100 ELSE 0 END), 0) AS successRate,
        MAX(created_at) AS lastPracticedAt
      FROM exercise_sessions
      WHERE fable_id = :fableId AND exercise_type = :exerciseType
    `)
    .get({
      fableId,
      exerciseType
    }) as {
      attemptsCount: number;
      avgScore: number;
      bestScore: number;
      successRate: number;
      lastPracticedAt: string | null;
    };

  db.prepare(`
    INSERT INTO exercise_stats (
      fable_id, exercise_type, attempts_count, avg_score, best_score, success_rate, last_practiced_at
    ) VALUES (
      :fableId, :exerciseType, :attemptsCount, :avgScore, :bestScore, :successRate, :lastPracticedAt
    )
    ON CONFLICT(fable_id, exercise_type)
    DO UPDATE SET
      attempts_count = excluded.attempts_count,
      avg_score = excluded.avg_score,
      best_score = excluded.best_score,
      success_rate = excluded.success_rate,
      last_practiced_at = excluded.last_practiced_at
  `).run({
    fableId,
    exerciseType,
    attemptsCount: row.attemptsCount,
    avgScore: Math.round(row.avgScore),
    bestScore: Math.round(row.bestScore),
    successRate: Math.round(row.successRate),
    lastPracticedAt: row.lastPracticedAt
  });
}

function recomputeFableProgress(db: DatabaseSync, fableId: number): ProgressSnapshot {
  const unitRows = db
    .prepare(`
      SELECT
        lu.id AS unitId,
        lu.unit_index AS unitIndex,
        lu.verse_count AS verseCount,
        COALESCE(up.memory_stage, 0) AS memoryStage,
        COALESCE(up.consecutive_criterion_passes, 0) AS consecutiveCriterionPasses,
        COALESCE(up.failure_streak, 0) AS failureStreak,
        COALESCE(up.last_support_level, 'high') AS lastSupportLevel,
        COALESCE(up.mastery_score, 0) AS masteryScore,
        COALESCE(up.attempts_count, 0) AS attemptsCount,
        COALESCE(up.success_count, 0) AS successCount,
        up.last_reviewed_at AS lastReviewedAt,
        up.next_review_at AS nextReviewAt
      FROM learning_units lu
      LEFT JOIN unit_progress up ON up.unit_id = lu.id
      WHERE lu.fable_id = :fableId
      ORDER BY lu.unit_index ASC
    `)
    .all({ fableId }) as Array<Record<string, string | number | null>>;

  const progressRows = unitRows.map(mapUnitProgressRow);
  const weightedTotal = unitRows.reduce((total, row) => {
    return total + Number(row.masteryScore) * Number(row.verseCount);
  }, 0);
  const totalVerses = unitRows.reduce((total, row) => total + Number(row.verseCount), 0);
  const masteryScore = totalVerses > 0 ? Math.round(weightedTotal / totalVerses) : 0;
  const attemptsCount = progressRows.reduce((total, row) => total + row.attemptsCount, 0);
  const lastReviewedAt = progressRows
    .map((row) => row.lastReviewedAt)
    .filter(Boolean)
    .sort()
    .at(-1) as string | null | undefined;
  const status = deriveFableStatus(progressRows);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO fable_progress (fable_id, status, mastery_score, attempts_count, last_reviewed_at, updated_at)
    VALUES (:fableId, :status, :masteryScore, :attemptsCount, :lastReviewedAt, :updatedAt)
    ON CONFLICT(fable_id)
    DO UPDATE SET
      status = excluded.status,
      mastery_score = excluded.mastery_score,
      attempts_count = excluded.attempts_count,
      last_reviewed_at = excluded.last_reviewed_at,
      updated_at = excluded.updated_at
  `).run({
    fableId,
    status,
    masteryScore,
    attemptsCount,
    lastReviewedAt: lastReviewedAt ?? null,
    updatedAt: now
  });

  return getProgressSnapshot(db, fableId);
}

function pickExerciseType(unitIndex: number, stage: number): ExerciseType {
  const cycle: ExerciseType[] = [
    "lecture-active",
    "texte-a-trous",
    "remise-en-ordre",
    "quiz",
    "recitation"
  ];
  const selected = cycle[(unitIndex + stage) % cycle.length];
  return selected ?? "lecture-active";
}

function ensureStatusBuckets(rows: Array<{ status: LearningStatus; count: number }>) {
  const byStatus = new Map(rows.map((row) => [row.status, row.count]));
  return (["jamais_vue", "en_cours", "maîtrisée"] as const).map((status) => ({
    status,
    count: byStatus.get(status) ?? 0
  }));
}

function getOrderBy(sort: FableFilters["sort"]) {
  switch (sort) {
    case "plus_courte":
      return "f.verse_count ASC, f.title ASC";
    case "plus_longue":
      return "f.verse_count DESC, f.title ASC";
    case "mieux_maîtrisée":
      return "masteryScore DESC, f.title ASC";
    case "révisée_récemment":
      return "COALESCE(fp.last_reviewed_at, '') DESC, f.title ASC";
    case "à_réviser":
      return "dueUnits DESC, masteryScore ASC, f.title ASC";
    case "titre":
    default:
      return "f.title COLLATE NOCASE ASC";
  }
}

function toCurrentUnitProgress(progress: UnitProgressSnapshot): CurrentUnitProgress {
  return progress;
}

function recordToSqlParams(record: ImportedFableRecord) {
  return {
    slug: record.slug,
    title: record.title,
    kind: record.kind ?? "fable",
    author: record.author ?? null,
    bookNumber: record.bookNumber,
    bookLabel: record.bookLabel,
    itemNumber: record.itemNumber,
    text: record.text,
    textHash: record.textHash,
    verseCount: record.verseCount,
    wordCount: record.wordCount,
    estimatedReadingMinutes: record.estimatedReadingMinutes,
    difficulty: record.difficulty,
    sourceUrl: record.sourceUrl
  };
}
