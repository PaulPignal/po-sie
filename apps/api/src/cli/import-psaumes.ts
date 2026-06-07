import fs from "node:fs";
import { loadConfig } from "../config";
import { createDatabase } from "../db/database";
import { importPsalter, type PsalterImportConfig } from "../services/importer";

// Usage: pnpm import:psaumes <config.json>
// config.json = { url, author?, collection?, psalms?: number[] }  (psalms vide => tous).
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: pnpm import:psaumes <config.json>");
    process.exit(1);
  }

  let config: PsalterImportConfig;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8")) as PsalterImportConfig;
  } catch (error) {
    console.error(`Config illisible (${file}) : ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  if (!config || typeof config.url !== "string") {
    console.error("La config doit contenir au moins une « url » (page du Psautier).");
    process.exit(1);
  }

  const appConfig = loadConfig();
  const db = createDatabase(appConfig.databasePath);
  try {
    const summary = await importPsalter(db, config);
    console.log(`Import des psaumes terminé depuis ${config.url}`);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
