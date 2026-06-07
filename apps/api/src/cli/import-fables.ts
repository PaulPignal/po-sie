import { loadConfig } from "../config";
import { createDatabase } from "../db/database";
import { importFables } from "../services/importer";

async function main() {
  const config = loadConfig();
  const force = process.argv.includes("--force");
  const db = createDatabase(config.databasePath);

  try {
    const summary = await importFables(db, config, { force });
    if (summary.skipped) {
      console.log(`Import ignoré: ${summary.discovered} fables déjà présentes.`);
      console.log(`Utilisez --force pour rafraîchir depuis ${summary.sourceIndexUrl}.`);
      return;
    }

    console.log(`Import terminé depuis ${summary.sourceIndexUrl}`);
    console.log(`Découvertes: ${summary.discovered}`);
    console.log(`Nouvelles: ${summary.imported}`);
    console.log(`Mises à jour: ${summary.updated}`);
    console.log(`Inchangées: ${summary.unchanged}`);
    console.log(`Échecs: ${summary.failed}`);
    if (summary.errors.length > 0) {
      console.log("Erreurs:");
      for (const error of summary.errors) {
        console.log(`- ${error.url}: ${error.message}`);
      }
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

