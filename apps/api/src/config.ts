import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AppConfig {
  port: number;
  host: string;
  databasePath: string;
  dataDir: string;
  sourceIndexUrl: string;
  importReportPath: string;
  webDistPath: string;
  basicAuthUser?: string;
  basicAuthPass?: string;
}

function modulePath(relativePath: string) {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  if (process.loadEnvFile && fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }

  const dataDir = overrides.dataDir ?? process.env.DATA_DIR ?? modulePath("../../../data");
  const databasePath =
    overrides.databasePath ??
    process.env.DATABASE_PATH ??
    path.join(dataDir, "la-fontaine.sqlite");
  const importReportPath = overrides.importReportPath ?? path.join(dataDir, "import-report.json");
  const webDistPath = overrides.webDistPath ?? modulePath("../../web/dist");
  const basicAuthUser = overrides.basicAuthUser ?? process.env.BASIC_AUTH_USER;
  const basicAuthPass = overrides.basicAuthPass ?? process.env.BASIC_AUTH_PASS;

  fs.mkdirSync(dataDir, { recursive: true });

  return {
    port: overrides.port ?? Number(process.env.PORT ?? "3001"),
    host: overrides.host ?? process.env.HOST ?? "127.0.0.1",
    databasePath,
    dataDir,
    sourceIndexUrl:
      overrides.sourceIndexUrl ??
      process.env.SOURCE_INDEX_URL ??
      "https://fr.wikisource.org/wiki/Fables_de_La_Fontaine_(%C3%A9d._1874)",
    importReportPath,
    webDistPath,
    ...(basicAuthUser ? { basicAuthUser } : {}),
    ...(basicAuthPass ? { basicAuthPass } : {})
  };
}
