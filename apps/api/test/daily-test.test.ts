import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { buildLearningUnits, countWords, createTextHash, estimateDifficulty, splitVerses } from "../src/utils/text";
import { upsertImportedFable } from "../src/services/store";
import { getDailyTestStatus, submitDailyTest } from "../src/services/dailyTest";

const SLUG = "test-fable";
const FULL = [
  "Maître corbeau, sur un arbre perché,",
  "Tenait en son bec un fromage.",
  "Maître renard, par l’odeur alléché,",
  "Lui tint à peu près ce langage :"
].join("\n");

const temp: string[] = [];
let app: ReturnType<typeof buildApp>;

beforeEach(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-daily-"));
  temp.push(dir);
  app = buildApp({ databasePath: path.join(dir, "t.sqlite"), dataDir: dir, webDistPath: path.join(dir, "x") });
  const verses = splitVerses(FULL);
  upsertImportedFable(app.db, {
    slug: SLUG,
    title: "Le Corbeau et le Renard",
    bookNumber: 1,
    bookLabel: "Livre 1",
    itemNumber: 2,
    text: FULL,
    textHash: createTextHash(FULL),
    verseCount: verses.length,
    wordCount: countWords(FULL),
    estimatedReadingMinutes: 1,
    difficulty: estimateDifficulty(verses.length),
    sourceUrl: "https://example.test",
    units: buildLearningUnits(FULL)
  });
  await app.ready();
});
afterEach(async () => {
  await app.close();
  while (temp.length) {
    const d = temp.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("test du jour", () => {
  it("note la part du poème retrouvée de mémoire", () => {
    const perfect = submitDailyTest(app.db, SLUG, FULL, new Date("2026-06-07T08:00:00Z"))!;
    expect(perfect.score).toBe(100);
    expect(perfect.mastered).toBe(true);
    expect(perfect.missedLines).toHaveLength(0);

    const partial = submitDailyTest(app.db, SLUG, "Maître corbeau sur un arbre perché", new Date("2026-06-08T08:00:00Z"))!;
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.score).toBeLessThan(100);
    expect(partial.missedLines.length).toBeGreaterThan(0);
  });

  it("garde la meilleure tentative du jour et construit l'historique", () => {
    const day = new Date("2026-06-07T08:00:00Z");
    submitDailyTest(app.db, SLUG, "Maître corbeau", day);
    const better = submitDailyTest(app.db, SLUG, FULL, day)!;
    expect(better.isBestToday).toBe(true);

    const worseAgain = submitDailyTest(app.db, SLUG, "rien du tout", day)!;
    expect(worseAgain.isBestToday).toBe(false);

    const status = getDailyTestStatus(app.db, SLUG, day)!;
    expect(status.todayDone).toBe(true);
    expect(status.todayScore).toBe(100); // best of the day kept
    expect(status.daysPracticed).toBe(1); // same day → one point
    expect(status.history).toHaveLength(1);
  });

  it("expose le statut via l'API", async () => {
    const res = await app.inject({ method: "POST", url: `/api/fables/${SLUG}/daily-test`, payload: { recited: FULL } });
    expect(res.statusCode).toBe(200);
    expect(res.json().score).toBe(100);

    const status = await app.inject({ method: "GET", url: `/api/fables/${SLUG}/daily-test` });
    expect(status.statusCode).toBe(200);
    expect(status.json().todayDone).toBe(true);
  });
});
