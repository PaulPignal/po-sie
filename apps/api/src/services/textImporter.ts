import type { DatabaseSync } from "node:sqlite";
import type { ContentKind } from "@la-fontaine/shared";
import { contentKinds } from "@la-fontaine/shared";
import { slugify } from "../utils/slug";
import {
  buildLearningUnits,
  cleanWhitespace,
  countWords,
  createTextHash,
  estimateDifficulty,
  splitVerses
} from "../utils/text";
import { ImportedFableRecord, upsertImportedFable } from "./store";

// Generic, source-agnostic ingestion: any text (psaume, poème, …) split into verses
// runs through the exact same learning engine as the La Fontaine fables. No scraping.
export interface TextManifestEntry {
  title: string;
  text: string;
  kind?: ContentKind;
  author?: string | null;
  collection?: string;
  sourceUrl?: string;
}

export interface TextManifest {
  collection?: string;
  author?: string | null;
  kind?: ContentKind;
  entries: TextManifestEntry[];
}

export interface TextImportSummary {
  discovered: number;
  imported: number;
  updated: number;
  unchanged: number;
  failed: number;
  errors: Array<{ title: string; message: string }>;
}

const DEFAULT_COLLECTION_LABEL: Record<ContentKind, string> = {
  fable: "Fables",
  psaume: "Psaumes",
  poeme: "Poèmes",
  texte: "Textes"
};

// Non-fable collections live above the 12 La Fontaine books so they sort after them.
const COLLECTION_BOOK_BASE = 101;

export function importTextManifest(
  db: DatabaseSync,
  input: TextManifest | TextManifestEntry[]
): TextImportSummary {
  const manifest: TextManifest = Array.isArray(input) ? { entries: input } : input;
  const entries = manifest.entries ?? [];
  const collectionBookNumber = new Map<string, number>();
  const collectionSequence = new Map<string, number>();
  const summary: TextImportSummary = {
    discovered: entries.length,
    imported: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    errors: []
  };

  for (const entry of entries) {
    try {
      const record = buildRecord(entry, manifest, collectionBookNumber, collectionSequence);
      const outcome = upsertImportedFable(db, record);
      if (outcome.outcome === "inserted") {
        summary.imported += 1;
      } else if (outcome.outcome === "updated") {
        summary.updated += 1;
      } else {
        summary.unchanged += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        title: typeof entry?.title === "string" && entry.title ? entry.title : "(sans titre)",
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  return summary;
}

function buildRecord(
  entry: TextManifestEntry,
  manifest: TextManifest,
  collectionBookNumber: Map<string, number>,
  collectionSequence: Map<string, number>
): ImportedFableRecord {
  if (typeof entry.title !== "string" || entry.title.trim() === "") {
    throw new Error("titre manquant");
  }
  if (typeof entry.text !== "string" || entry.text.trim() === "") {
    throw new Error("texte manquant");
  }

  const kind = resolveKind(entry.kind ?? manifest.kind);
  const author = entry.author ?? manifest.author ?? null;
  const collection = (entry.collection ?? manifest.collection ?? DEFAULT_COLLECTION_LABEL[kind]).trim();

  if (!collectionBookNumber.has(collection)) {
    collectionBookNumber.set(collection, COLLECTION_BOOK_BASE + collectionBookNumber.size);
  }
  const itemNumber = (collectionSequence.get(collection) ?? 0) + 1;
  collectionSequence.set(collection, itemNumber);

  const text = cleanWhitespace(entry.text);
  const verses = splitVerses(text);
  if (verses.length === 0) {
    throw new Error("aucun vers exploitable");
  }
  const wordCount = countWords(text);

  return {
    // Prefixed by collection so generic slugs never collide with `livre-XX-YY-…` fables.
    slug: `${slugify(collection)}-${String(itemNumber).padStart(3, "0")}-${slugify(entry.title)}`,
    title: entry.title.trim(),
    kind,
    author,
    bookNumber: collectionBookNumber.get(collection)!,
    bookLabel: collection,
    itemNumber,
    text,
    textHash: createTextHash(text),
    verseCount: verses.length,
    wordCount,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 140)),
    difficulty: estimateDifficulty(verses.length),
    sourceUrl: entry.sourceUrl ?? "import local",
    units: buildLearningUnits(text)
  };
}

function resolveKind(kind: ContentKind | undefined): ContentKind {
  if (kind && contentKinds.includes(kind)) {
    return kind;
  }
  if (kind) {
    throw new Error(`genre inconnu : ${kind}`);
  }
  return "texte";
}
