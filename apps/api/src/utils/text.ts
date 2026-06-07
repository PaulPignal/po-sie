import crypto from "node:crypto";
import type { Difficulty, LearningUnit, SupportLevel } from "@la-fontaine/shared";

const FRENCH_STOPWORDS = new Set([
  "alors",
  "ainsi",
  "avec",
  "bien",
  "comme",
  "dans",
  "dont",
  "elle",
  "elles",
  "encore",
  "être",
  "font",
  "leur",
  "leurs",
  "mais",
  "même",
  "nous",
  "pour",
  "quand",
  "sans",
  "sera",
  "sont",
  "sous",
  "tous",
  "tout",
  "vous"
]);

export function cleanWhitespace(input: string) {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function stripHtmlNoise(input: string) {
  return cleanWhitespace(
    input
      .replace(/\[[^\]]*\d+[^\]]*]/g, "")
      .replace(/↑+/g, "")
      .replace(/[“”]/g, "\"")
      .replace(/[’]/g, "'")
  );
}

export function splitVerses(text: string) {
  return cleanWhitespace(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function countWords(text: string) {
  return normalizeComparison(text, true)
    .split(" ")
    .filter(Boolean).length;
}

export function estimateDifficulty(verseCount: number): Difficulty {
  if (verseCount <= 16) {
    return "facile";
  }

  if (verseCount <= 32) {
    return "intermédiaire";
  }

  return "avancée";
}

export function normalizeComparison(input: string, strictAccents = false) {
  const source = input ?? "";
  const ascii = strictAccents
    ? source
    : source.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return ascii
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string, strictAccents = false) {
  return normalizeComparison(input, strictAccents)
    .split(" ")
    .filter(Boolean);
}

export function tokenInitials(input: string) {
  return tokenize(input, true)
    .map((token) => token.at(0)?.toUpperCase() ?? "")
    .join(" ");
}

export function lineInitials(input: string) {
  return splitVerses(input)
    .map((line) =>
      tokenize(line, true)
        .map((token) => token.at(0)?.toUpperCase() ?? "")
        .join("")
    )
    .join("\n");
}

export function extractLastWord(input: string) {
  const words = tokenize(input);
  return words.at(-1) ?? "";
}

export function firstWords(input: string, count: number) {
  return tokenize(input, true)
    .slice(0, count)
    .join(" ");
}

export function lastWords(input: string, count: number) {
  return tokenize(input, true)
    .slice(-count)
    .join(" ");
}

export function scoreTextAnswer(answer: string, expected: string, strictAccents = false) {
  const normalizedAnswer = normalizeComparison(answer, strictAccents);
  const normalizedExpected = normalizeComparison(expected, strictAccents);

  if (!normalizedExpected) {
    return 0;
  }

  if (normalizedAnswer === normalizedExpected) {
    return 100;
  }

  const answerTokens = tokenize(answer, strictAccents);
  const expectedTokens = tokenize(expected, strictAccents);
  const expectedCounts = new Map<string, number>();

  for (const token of expectedTokens) {
    expectedCounts.set(token, (expectedCounts.get(token) ?? 0) + 1);
  }

  let overlap = 0;
  for (const token of answerTokens) {
    const remaining = expectedCounts.get(token) ?? 0;
    if (remaining > 0) {
      overlap += 1;
      expectedCounts.set(token, remaining - 1);
    }
  }

  let ordered = 0;
  const limit = Math.min(answerTokens.length, expectedTokens.length);
  for (let index = 0; index < limit; index += 1) {
    if (answerTokens[index] === expectedTokens[index]) {
      ordered += 1;
    }
  }

  const overlapRatio = overlap / expectedTokens.length;
  const orderedRatio = ordered / expectedTokens.length;
  return Math.round(Math.max(0, Math.min(1, overlapRatio * 0.7 + orderedRatio * 0.3)) * 100);
}

export function createTextHash(text: string) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

export function buildLearningUnits(text: string): Array<Omit<LearningUnit, "id">> {
  const normalized = cleanWhitespace(text);
  const stanzaBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const verses = splitVerses(normalized);

  if (stanzaBlocks.length > 1) {
    let verseIndex = 0;
    return stanzaBlocks.map((block, unitIndex) => {
      const blockVerses = splitVerses(block);
      const startVerse = verseIndex + 1;
      verseIndex += blockVerses.length;
      return {
        unitIndex,
        unitType: "strophe",
        startVerse,
        endVerse: verseIndex,
        verseCount: blockVerses.length,
        text: block,
        verses: blockVerses
      };
    });
  }

  const chunks: Array<Omit<LearningUnit, "id">> = [];
  for (let start = 0; start < verses.length; start += 4) {
    const chunk = verses.slice(start, start + 4);
    chunks.push({
      unitIndex: chunks.length,
      unitType: "bloc",
      startVerse: start + 1,
      endVerse: start + chunk.length,
      verseCount: chunk.length,
      text: chunk.join("\n"),
      verses: chunk
    });
  }
  return chunks;
}

export function formatVerseRangeLabel(unit: Pick<LearningUnit, "startVerse" | "endVerse">) {
  if (unit.startVerse === unit.endVerse) {
    return `vers ${unit.startVerse}`;
  }

  return `vers ${unit.startVerse}-${unit.endVerse}`;
}

export function recommendedSupportFromStage(stage: number): SupportLevel {
  if (stage <= 1) {
    return "high";
  }

  if (stage <= 3) {
    return "medium";
  }

  return "low";
}

export function romanToInt(input: string) {
  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000
  };

  let total = 0;
  let previous = 0;

  for (const character of input.toUpperCase().split("").reverse()) {
    const value = values[character] ?? 0;
    if (value < previous) {
      total -= value;
    } else {
      total += value;
      previous = value;
    }
  }

  return total;
}

export function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isContentWord(token: string) {
  const normalized = normalizeComparison(token, false);
  return normalized.length >= 4 && !FRENCH_STOPWORDS.has(normalized);
}

