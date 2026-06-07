import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ActiveReadingPayload, ClozePayload, QuizPayload } from "@la-fontaine/shared";
import { buildApp } from "../src/app";
import { buildLearningUnits, countWords, createTextHash, estimateDifficulty, splitVerses } from "../src/utils/text";
import { upsertImportedFable } from "../src/services/store";

const SLUG = "test-fable";
const tempPaths: string[] = [];

function makeApp() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "la-fontaine-ex-"));
  tempPaths.push(directory);
  const app = buildApp({
    databasePath: path.join(directory, "test.sqlite"),
    dataDir: directory,
    webDistPath: path.join(directory, "missing-dist")
  });

  const text = [
    "La Cigale, ayant chanté",
    "Tout l’Été,",
    "Se trouva fort dépourvue",
    "Quand la bise fut venue :",
    "",
    "Pas un seul petit morceau",
    "De mouche ou de vermisseau.",
    "Elle alla crier famine",
    "Chez la Fourmi sa voisine."
  ].join("\n");
  const verses = splitVerses(text);
  upsertImportedFable(app.db, {
    slug: SLUG,
    title: "La Cigale et la Fourmi",
    bookNumber: 1,
    bookLabel: "Livre 1",
    itemNumber: 1,
    text,
    textHash: createTextHash(text),
    verseCount: verses.length,
    wordCount: countWords(text),
    estimatedReadingMinutes: 1,
    difficulty: estimateDifficulty(verses.length),
    sourceUrl: "https://example.test",
    units: buildLearningUnits(text)
  });
  return app;
}

let app: ReturnType<typeof buildApp>;
beforeEach(async () => {
  app = makeApp();
  await app.ready();
});
afterEach(async () => {
  await app.close();
  while (tempPaths.length > 0) {
    const directory = tempPaths.pop();
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("lecture active (regression: BUG-1 crash)", () => {
  it("note la soumission même sans expectedAnswer fourni par le client", async () => {
    const gen = await app.inject({ method: "GET", url: `/api/fables/${SLUG}/exercises/lecture-active` });
    const payload = gen.json() as ActiveReadingPayload;

    // Reproduit EXACTEMENT ce que l'UI envoie : pas de champ expectedAnswer.
    const res = await app.inject({
      method: "POST",
      url: `/api/fables/${SLUG}/exercises/lecture-active/submit`,
      payload: {
        answer: payload.expectedAnswer,
        confidenceRating: 3,
        unitIndex: payload.unit.unitIndex,
        seed: payload.seed,
        supportLevel: payload.supportLevel,
        hintsUsed: 0,
        latencyMs: 1000
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accuracyScore).toBe(100);
    expect(body.corrections.length).toBeGreaterThan(0);
  });

  it("ne plante pas et note 0 si la réponse est vide", async () => {
    const gen = await app.inject({ method: "GET", url: `/api/fables/${SLUG}/exercises/lecture-active` });
    const payload = gen.json() as ActiveReadingPayload;
    const res = await app.inject({
      method: "POST",
      url: `/api/fables/${SLUG}/exercises/lecture-active/submit`,
      payload: {
        answer: "",
        unitIndex: payload.unit.unitIndex,
        seed: payload.seed,
        supportLevel: payload.supportLevel,
        hintsUsed: 0,
        latencyMs: 1000
      }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accuracyScore).toBe(0);
  });
});

describe("texte à trous (regression: BUG-2 score gonflé)", () => {
  it("pénalise les trous laissés vides", async () => {
    const gen = await app.inject({ method: "GET", url: `/api/fables/${SLUG}/exercises/texte-a-trous?support=medium` });
    const payload = gen.json() as ClozePayload;
    expect(payload.blanks.length).toBeGreaterThan(1);

    const first = payload.blanks[0]!;
    const res = await app.inject({
      method: "POST",
      url: `/api/fables/${SLUG}/exercises/texte-a-trous/submit`,
      payload: {
        answers: { [first.id]: first.answer }, // un seul trou rempli sur N
        unitIndex: payload.unit.unitIndex,
        seed: payload.seed,
        supportLevel: payload.supportLevel,
        hintsUsed: 0,
        latencyMs: 1000
      }
    });
    expect(res.statusCode).toBe(200);
    const score = res.json().accuracyScore;
    // 1 bon sur N → autour de (1/N)*100, jamais 100.
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it("note 100 quand tous les trous sont corrects", async () => {
    const gen = await app.inject({ method: "GET", url: `/api/fables/${SLUG}/exercises/texte-a-trous?support=medium` });
    const payload = gen.json() as ClozePayload;
    const answers = Object.fromEntries(payload.blanks.map((b) => [b.id, b.answer]));
    const res = await app.inject({
      method: "POST",
      url: `/api/fables/${SLUG}/exercises/texte-a-trous/submit`,
      payload: {
        answers,
        unitIndex: payload.unit.unitIndex,
        seed: payload.seed,
        supportLevel: payload.supportLevel,
        hintsUsed: 0,
        latencyMs: 1000
      }
    });
    expect(res.json().accuracyScore).toBe(100);
  });
});

describe("quiz (regression: BUG-2 score gonflé)", () => {
  it("pénalise les questions non répondues", async () => {
    const gen = await app.inject({ method: "GET", url: `/api/fables/${SLUG}/exercises/quiz` });
    const payload = gen.json() as QuizPayload;
    expect(payload.questions.length).toBeGreaterThan(1);

    const first = payload.questions[0]!;
    const res = await app.inject({
      method: "POST",
      url: `/api/fables/${SLUG}/exercises/quiz/submit`,
      payload: {
        answers: { [first.id]: first.expectedAnswer }, // une seule réponse sur N
        unitIndex: payload.unit.unitIndex,
        seed: payload.seed,
        supportLevel: payload.supportLevel,
        hintsUsed: 0,
        latencyMs: 1000
      }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accuracyScore).toBeLessThan(100);
  });
});
