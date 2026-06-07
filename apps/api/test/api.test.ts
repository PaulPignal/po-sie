import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ActiveReadingPayload } from "@la-fontaine/shared";
import { buildApp } from "../src/app";
import { buildLearningUnits, countWords, createTextHash, estimateDifficulty, splitVerses } from "../src/utils/text";
import { upsertImportedFable } from "../src/services/store";

const tempPaths: string[] = [];

function createTempPath() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "la-fontaine-test-"));
  tempPaths.push(directory);
  return directory;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const directory = tempPaths.pop();
    if (directory) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("API", () => {
  it("liste les fables, sert un exercice et enregistre une tentative", async () => {
    const directory = createTempPath();
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
      slug: "livre-01-01-la-cigale-et-la-fourmi",
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
      sourceUrl:
        "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)/La_Cigale_et_la_Fourmi",
      units: buildLearningUnits(text)
    });

    await app.ready();

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/fables"
    });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.json();
    expect(list).toHaveLength(1);

    const exerciseResponse = await app.inject({
      method: "GET",
      url: "/api/fables/livre-01-01-la-cigale-et-la-fourmi/exercises/lecture-active"
    });
    expect(exerciseResponse.statusCode).toBe(200);
    const payload = exerciseResponse.json() as ActiveReadingPayload;

    const submitResponse = await app.inject({
      method: "POST",
      url: "/api/fables/livre-01-01-la-cigale-et-la-fourmi/exercises/lecture-active/submit",
      payload: {
        unitIndex: payload.unit.unitIndex,
        seed: payload.seed,
        supportLevel: payload.supportLevel,
        hintsUsed: 0,
        latencyMs: 1200,
        answer: payload.expectedAnswer,
        expectedAnswer: payload.expectedAnswer
      }
    });

    expect(submitResponse.statusCode).toBe(200);
    const result = submitResponse.json();
    expect(result.normalizedScore).toBeGreaterThanOrEqual(70);
    expect(result.fableProgress.status).toBe("en_cours");

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/dashboard"
    });
    expect(dashboardResponse.statusCode).toBe(200);
    const dashboard = dashboardResponse.json();
    expect(dashboard.totalFables).toBe(1);
    expect(dashboard.totalSessions).toBe(1);

    await app.close();
  });
});

