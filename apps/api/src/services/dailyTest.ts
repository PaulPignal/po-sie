import type { DailyTestPoint, DailyTestResult, DailyTestStatus } from "@la-fontaine/shared";
import { BY_HEART_THRESHOLD } from "@la-fontaine/shared";
import type { DatabaseSync } from "node:sqlite";
import { scoreTextAnswer, splitVerses, tokenize } from "../utils/text";

function getFocusFable(db: DatabaseSync, slug: string) {
  return db.prepare("SELECT id, text FROM fables WHERE slug = :slug").get({ slug }) as
    | { id: number; text: string }
    | undefined;
}

function dateKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

export function getDailyTestStatus(
  db: DatabaseSync,
  slug: string,
  now = new Date()
): DailyTestStatus | null {
  const fable = getFocusFable(db, slug);
  if (!fable) {
    return null;
  }

  const rows = db
    .prepare(
      "SELECT date, score FROM daily_evaluations WHERE fable_id = :id ORDER BY date ASC"
    )
    .all({ id: fable.id }) as Array<{ date: string; score: number }>;

  const history: DailyTestPoint[] = rows.map((row) => ({
    date: String(row.date),
    score: Number(row.score)
  }));

  const today = dateKey(now);
  const todayPoint = history.find((point) => point.date === today) ?? null;
  const best = history.reduce((max, point) => Math.max(max, point.score), 0);
  const masteredPoint = history.find((point) => point.score >= BY_HEART_THRESHOLD) ?? null;

  return {
    todayDone: todayPoint !== null,
    todayScore: todayPoint ? todayPoint.score : null,
    best,
    latest: history.length > 0 ? history[history.length - 1]!.score : null,
    daysPracticed: history.length,
    masteredAt: masteredPoint ? masteredPoint.date : null,
    history
  };
}

export function submitDailyTest(
  db: DatabaseSync,
  slug: string,
  recited: string,
  now = new Date()
): DailyTestResult | null {
  const fable = getFocusFable(db, slug);
  if (!fable) {
    return null;
  }

  const score = scoreTextAnswer(recited, fable.text);
  const today = dateKey(now);
  const nowIso = now.toISOString();

  const existing = db
    .prepare("SELECT score FROM daily_evaluations WHERE fable_id = :id AND date = :date")
    .get({ id: fable.id, date: today }) as { score: number } | undefined;

  // One entry per day; keep the best attempt of the day so retries can only help.
  const isBestToday = !existing || score > existing.score;
  if (!existing) {
    db.prepare(
      `INSERT INTO daily_evaluations (fable_id, date, score, recited_text, created_at)
       VALUES (:id, :date, :score, :recited, :createdAt)`
    ).run({ id: fable.id, date: today, score, recited, createdAt: nowIso });
  } else if (score > existing.score) {
    db.prepare(
      `UPDATE daily_evaluations SET score = :score, recited_text = :recited, created_at = :createdAt
       WHERE fable_id = :id AND date = :date`
    ).run({ id: fable.id, date: today, score, recited, createdAt: nowIso });
  }

  return {
    score,
    date: today,
    isBestToday,
    mastered: score >= BY_HEART_THRESHOLD,
    missedLines: computeMissedLines(recited, fable.text),
    status: getDailyTestStatus(db, slug, now)!
  };
}

// Verses for which fewer than half the meaningful words were reproduced — what to review next.
function computeMissedLines(recited: string, fullText: string): string[] {
  const recitedTokens = new Set(tokenize(recited));
  const missed: string[] = [];

  for (const verse of splitVerses(fullText)) {
    const verseTokens = tokenize(verse).filter((token) => token.length >= 2);
    if (verseTokens.length === 0) {
      continue;
    }
    const matched = verseTokens.filter((token) => recitedTokens.has(token)).length;
    if (matched / verseTokens.length < 0.5) {
      missed.push(verse);
    }
  }

  return missed.slice(0, 10);
}
