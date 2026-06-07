import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database";
import { importTextManifest } from "../src/services/textImporter";
import { getFableDetail, listFables } from "../src/services/store";

let db: DatabaseSync;
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-textimport-"));
  db = createDatabase(path.join(dir, "test.sqlite"));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("import générique multi-genres", () => {
  it("ingère un psaume et le rend disponible comme n'importe quel texte", () => {
    const summary = importTextManifest(db, {
      kind: "psaume",
      collection: "Psaumes",
      author: "Segond 1910",
      entries: [
        {
          title: "Psaume 23",
          text: "L'Éternel est mon berger.\nIl me fait reposer.\n\nIl restaure mon âme.\nIl me conduit."
        }
      ]
    });

    expect(summary.imported).toBe(1);
    expect(summary.failed).toBe(0);

    const detail = getFableDetail(db, "psaumes-001-psaume-23");
    expect(detail).not.toBeNull();
    expect(detail!.kind).toBe("psaume");
    expect(detail!.author).toBe("Segond 1910");
    // Deux strophes séparées par une ligne vide -> deux unités d'apprentissage.
    expect(detail!.units.length).toBe(2);

    // Le filtrage par genre isole bien le catalogue.
    expect(listFables(db, { kind: "psaume" }).length).toBe(1);
    expect(listFables(db, { kind: "fable" }).length).toBe(0);
  });

  it("réimporter le même texte ne crée pas de doublon", () => {
    const manifest = {
      kind: "poeme" as const,
      collection: "Poèmes",
      entries: [{ title: "Test", text: "Vers un.\nVers deux." }]
    };
    expect(importTextManifest(db, manifest).imported).toBe(1);
    const again = importTextManifest(db, manifest);
    expect(again.imported).toBe(0);
    expect(again.unchanged).toBe(1);
    expect(listFables(db, {}).length).toBe(1);
  });

  it("isole un échec d'entrée sans bloquer les suivantes", () => {
    const summary = importTextManifest(db, {
      entries: [
        { title: "Vide", text: "" },
        { title: "Ok", text: "Une ligne.\nDeux lignes." }
      ]
    });
    expect(summary.failed).toBe(1);
    expect(summary.imported).toBe(1);
    expect(summary.errors[0]?.title).toBe("Vide");
  });
});
