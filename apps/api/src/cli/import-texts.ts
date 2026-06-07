import fs from "node:fs";
import { loadConfig } from "../config";
import { createDatabase } from "../db/database";
import { importTextManifest } from "../services/textImporter";

// Usage: pnpm import:texts <chemin-du-manifest.json>
// Manifest = un tableau d'entrées, ou { collection?, author?, kind?, entries: [...] }.
function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: pnpm import:texts <manifest.json>");
    process.exit(1);
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Manifest illisible (${file}) : ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  const config = loadConfig();
  const db = createDatabase(config.databasePath);
  try {
    const summary = importTextManifest(db, manifest as never);
    console.log(`Import local terminé depuis ${file}`);
    console.log(`Découverts : ${summary.discovered}`);
    console.log(`Nouveaux : ${summary.imported}`);
    console.log(`Mis à jour : ${summary.updated}`);
    console.log(`Inchangés : ${summary.unchanged}`);
    console.log(`Échecs : ${summary.failed}`);
    for (const error of summary.errors) {
      console.log(`- ${error.title} : ${error.message}`);
    }
  } finally {
    db.close();
  }
}

main();
