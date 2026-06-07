import fs from "node:fs";
import { loadConfig } from "../config";
import { createDatabase } from "../db/database";
import { importWikisourceList } from "../services/importer";

// Usage: pnpm import:wikisource <liste.json>
// liste.json = [{ url, title, kind?, author?, collection? }, …] (URLs de pages Wikisource).
async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: pnpm import:wikisource <liste.json>");
    process.exit(1);
  }

  let list: unknown;
  try {
    list = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`Liste illisible (${file}) : ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  if (!Array.isArray(list)) {
    console.error("La liste doit être un tableau d'entrées { url, title, … }.");
    process.exit(1);
  }

  const config = loadConfig();
  const db = createDatabase(config.databasePath);
  try {
    const summary = await importWikisourceList(db, list as never);
    console.log(`Import Wikisource terminé depuis ${file}`);
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
