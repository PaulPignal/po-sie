import fs from "node:fs/promises";
import { load } from "cheerio";
import type { AppConfig } from "../config";
import type { DatabaseSync } from "node:sqlite";
import { slugify } from "../utils/slug";
import {
  buildLearningUnits,
  cleanWhitespace,
  countWords,
  createTextHash,
  estimateDifficulty,
  normalizeComparison,
  romanToInt,
  stripHtmlNoise,
  splitVerses
} from "../utils/text";
import { countFables, ImportedFableRecord, upsertImportedFable } from "./store";
import type { ContentKind } from "@la-fontaine/shared";
import { importTextManifest } from "./textImporter";
import type { TextImportSummary, TextManifestEntry } from "./textImporter";

const USER_AGENT = "LaFontaineLocalApp/1.0 (+local learning app)";
const REQUEST_DELAY_MS = 350;
const FETCH_TIMEOUT_MS = 20000;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ImportEntry {
  title: string;
  bookNumber: number;
  bookLabel: string;
  itemNumber: number;
  url: string;
  slug: string;
}

export interface ImportOptions {
  force?: boolean;
}

export interface ImportSummary {
  sourceIndexUrl: string;
  discovered: number;
  imported: number;
  updated: number;
  unchanged: number;
  failed: number;
  skipped: boolean;
  errors: Array<{ url: string; message: string }>;
}

export async function importFables(
  db: DatabaseSync,
  config: AppConfig,
  options: ImportOptions = {}
): Promise<ImportSummary> {
  const existingCount = countFables(db);
  if (existingCount > 0 && !options.force) {
    const summary: ImportSummary = {
      sourceIndexUrl: config.sourceIndexUrl,
      discovered: existingCount,
      imported: 0,
      updated: 0,
      unchanged: existingCount,
      failed: 0,
      skipped: true,
      errors: []
    };
    await writeReport(config.importReportPath, summary);
    return summary;
  }

  const indexHtml = await fetchHtml(config.sourceIndexUrl);
  const entries = parseIndexHtml(indexHtml, config.sourceIndexUrl);
  const summary: ImportSummary = {
    sourceIndexUrl: config.sourceIndexUrl,
    discovered: entries.length,
    imported: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    skipped: false,
    errors: []
  };

  for (const [index, entry] of entries.entries()) {
    if (index > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
    try {
      const html = await fetchHtml(entry.url);
      const parsed = parseFablePageHtml(html, entry);
      const outcome = upsertImportedFable(db, parsed);
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
        url: entry.url,
        message: error instanceof Error ? error.message : "Erreur inconnue"
      });
    }
  }

  await writeReport(config.importReportPath, summary);
  return summary;
}

export function parseIndexHtml(html: string, sourceIndexUrl: string): ImportEntry[] {
  const $ = load(html);
  const root = getContentRoot($);
  const entries: ImportEntry[] = [];
  let currentBookNumber = 0;
  let currentBookLabel = "";

  root.find("div, p, ol, ul").each((_, element) => {
    const text = cleanWhitespace($(element).text());
    const bookMatch = text.match(/^LIVRE\s+([IVXLCDM]+)/i);
    if (bookMatch) {
      currentBookNumber = romanToInt(bookMatch[1] ?? "");
      currentBookLabel = `Livre ${currentBookNumber}`;
      return;
    }

    if (/^TABLE ALPHAB/i.test(text)) {
      return false;
    }

    if (currentBookNumber < 1 || currentBookNumber > 12) {
      return;
    }

    if (element.tagName === "ol" || element.tagName === "ul") {
      $(element)
        .children("li")
        .each((itemIndex, itemElement) => {
          const link = $(itemElement).find("a[href^=\"/wiki/\"]").first();
          const title = cleanWhitespace(link.text());
          const href = link.attr("href");

          if (!href || !title || shouldSkipIndexTitle(title)) {
            return;
          }

          entries.push({
            title,
            bookNumber: currentBookNumber,
            bookLabel: currentBookLabel,
            itemNumber: itemIndex + 1,
            url: new URL(href, sourceIndexUrl).toString(),
            slug: `livre-${String(currentBookNumber).padStart(2, "0")}-${String(itemIndex + 1).padStart(2, "0")}-${slugify(title)}`
          });
        });
      return;
    }

    const itemMatch = text.match(/^(\d+)\.\s*/);
    if (!itemMatch) {
      return;
    }

    const link = $(element).find("a[href^=\"/wiki/\"]").first();
    const title = cleanWhitespace(link.text());
    const href = link.attr("href");

    if (!href || !title || shouldSkipIndexTitle(title)) {
      return;
    }

    const itemNumber = Number(itemMatch[1]);
    entries.push({
      title,
      bookNumber: currentBookNumber,
      bookLabel: currentBookLabel,
      itemNumber,
      url: new URL(href, sourceIndexUrl).toString(),
      slug: `livre-${String(currentBookNumber).padStart(2, "0")}-${String(itemNumber).padStart(
        2,
        "0"
      )}-${slugify(title)}`
    });
  });

  return entries;
}

// Cœur du parsing d'une page Wikisource, réutilisable pour tout texte (pas que les fables).
export function extractWikisourceText(html: string, title: string): string {
  const $ = load(html);
  const root = getContentRoot($).clone();
  root
    .find(
      [
        "sup",
        ".reference",
        ".mw-editsection",
        "table",
        "script",
        "style",
        "ol.references",
        ".noprint",
        ".ws-noexport",
        "#headertemplate",
        "#subheader",
        "#ws-data",
        ".pagenum",
        ".ws-pagenum",
        "figure",
        "figcaption",
        "link",
        "meta"
      ].join(", ")
    )
    .remove();

  const blocks: string[] = [];
  root.children().each((_, element) => {
    const clone = $(element).clone();
    clone.find("br").replaceWith("\n");
    const block = stripHtmlNoise(cleanWhitespace(clone.text()));
    if (block) {
      blocks.push(block);
    }
  });

  const normalizedTitle = normalizeComparison(title);
  const titleIndex = blocks.findIndex((block) => normalizeComparison(block) === normalizedTitle);
  const contentBlocks = blocks
    .slice(titleIndex >= 0 ? titleIndex + 1 : 0)
    .filter((block) => !shouldSkipContentBlock(block));

  if (contentBlocks.length === 0) {
    throw new Error(`Impossible d’extraire le texte de ${title}`);
  }

  const cleanedBlocks = contentBlocks
    .map((block) =>
      splitVerses(block)
        .filter((line) => !shouldSkipLine(line))
        .join("\n")
    )
    .filter(Boolean);

  return stripLeadingTitle(cleanWhitespace(cleanedBlocks.join("\n\n")), title);
}

export function parseFablePageHtml(html: string, entry: ImportEntry): ImportedFableRecord {
  const text = extractWikisourceText(html, entry.title);
  const verses = splitVerses(text);
  const wordCount = countWords(text);

  return {
    slug: entry.slug,
    title: entry.title,
    kind: "fable",
    author: "Jean de La Fontaine",
    bookNumber: entry.bookNumber,
    bookLabel: entry.bookLabel,
    itemNumber: entry.itemNumber,
    text,
    textHash: createTextHash(text),
    verseCount: verses.length,
    wordCount,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 140)),
    difficulty: estimateDifficulty(verses.length),
    sourceUrl: entry.url,
    units: buildLearningUnits(text)
  };
}

export interface WikisourceImportEntry {
  url: string;
  title: string;
  kind?: ContentKind;
  author?: string | null;
  collection?: string;
}

// Importe une liste curatée de pages Wikisource (par URL) : on réutilise le parsing
// éprouvé sur les fables pour obtenir un texte propre, puis le même pipeline d'upsert
// que l'import local. Ce n'est PAS un scraper d'index (fragile) — juste des URLs choisies.
export async function importWikisourceList(
  db: DatabaseSync,
  list: WikisourceImportEntry[]
): Promise<TextImportSummary> {
  const entries: TextManifestEntry[] = [];
  const fetchErrors: TextImportSummary["errors"] = [];

  for (const [index, item] of list.entries()) {
    if (index > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
    try {
      const html = await fetchHtml(item.url);
      const text = extractWikisourceText(html, item.title);
      entries.push({
        title: item.title,
        text,
        sourceUrl: item.url,
        ...(item.kind ? { kind: item.kind } : {}),
        ...(item.author !== undefined ? { author: item.author } : {}),
        ...(item.collection ? { collection: item.collection } : {})
      });
    } catch (error) {
      fetchErrors.push({
        title: item.title,
        message: error instanceof Error ? error.message : "Erreur de récupération"
      });
    }
  }

  const summary = importTextManifest(db, { entries });
  summary.discovered = list.length;
  summary.failed += fetchErrors.length;
  summary.errors.push(...fetchErrors);
  return summary;
}

export async function fetchHtml(url: string, attempt = 0): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });

  // Wikisource rate-limits bulk fetches (429) and occasionally returns 503.
  // Back off (honouring Retry-After when present) and retry a few times.
  if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
    await sleep(Math.min(RETRY_MAX_MS, waitMs));
    return fetchHtml(url, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`Réponse ${response.status} pour ${url}`);
  }

  return response.text();
}

async function writeReport(reportPath: string, summary: ImportSummary) {
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), "utf8");
}

function shouldSkipIndexTitle(title: string) {
  return /Table alphabétique|dédicace|épilogue/i.test(title);
}

// Real Wikisource pages frequently repeat the fable title (often upper-cased) as the
// first content line, which leaks into the text and becomes a junk 1-verse learning unit.
// The block-level title match in parseFablePageHtml only catches it when the title is its
// own standalone block, so strip a leading title line here as a parser-agnostic safety net.
function stripLeadingTitle(text: string, title: string): string {
  const normalizedTitle = normalizeComparison(title);
  if (!normalizedTitle) {
    return text;
  }

  const lines = text.split("\n");
  let start = 0;
  while (start < lines.length && (lines[start] ?? "").trim() === "") {
    start += 1;
  }

  // Long titles wrap over several lines on Wikisource, so try matching the title
  // against the first 1..3 leading lines joined together.
  for (let span = 1; span <= 3 && start + span <= lines.length; span += 1) {
    const candidate = lines.slice(start, start + span).join(" ");
    if (normalizeComparison(candidate) === normalizedTitle) {
      lines.splice(0, start + span);
      while (lines.length > 0 && (lines[0] ?? "").trim() === "") {
        lines.shift();
      }
      return lines.join("\n");
    }
  }

  return text;
}

function getContentRoot($: ReturnType<typeof load>) {
  const contentRoot =
    $("#mw-content-text .mw-parser-output").first().length > 0
      ? $("#mw-content-text .mw-parser-output").first()
      : $(".mw-parser-output").first();

  return contentRoot.find(".prp-pages-output").first().length > 0
    ? contentRoot.find(".prp-pages-output").first()
    : contentRoot;
}

function shouldSkipContentBlock(block: string) {
  return (
    /^Pour les autres éditions de ce texte/i.test(block) ||
    /^Récupérée de/i.test(block) ||
    /^Catégories?/i.test(block) ||
    /^collection/i.test(block) ||
    /^Jean de La Fontaine/i.test(block) ||
    /^Bernardin-Béchet/i.test(block) ||
    /^Livre [IVXLCDM]+$/i.test(block) ||
    /^La Fontaine - Fables, Bernardin-Bechet, 1874\.djvu/i.test(block) ||
    /^◄/.test(block) ||
    /^►/.test(block) ||
    /^\d+\.\s/.test(block)
  );
}

function shouldSkipLine(line: string) {
  return (
    /^LIVRE\s+/i.test(line) ||
    /^[IVXLCDM]+$/.test(line) ||
    /^Pour les autres éditions de ce texte/i.test(line) ||
    /^Jean de La Fontaine/i.test(line) ||
    /^Bernardin-Béchet/i.test(line) ||
    /^◄/.test(line) ||
    /^►/.test(line) ||
    /^collection/i.test(line) ||
    /^La Fontaine - Fables, Bernardin-Bechet, 1874\.djvu/i.test(line) ||
    /^p\.\s*\d+/i.test(line) ||
    // Signature de date en fin de poème (ex. « 7 octobre 1870. ») — pas un vers à réciter.
    /^\d{1,2}\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/i.test(line)
  );
}
