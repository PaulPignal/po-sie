import fs from "node:fs";
import fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import type { DatabaseSync } from "node:sqlite";
import type { AppConfig } from "./config";
import { loadConfig } from "./config";
import { createDatabase } from "./db/database";
import { registerApiRoutes } from "./routes/api";

declare module "fastify" {
  interface FastifyInstance {
    db: DatabaseSync;
    appConfig: AppConfig;
  }
}

export function buildApp(overrides: Partial<AppConfig> = {}) {
  const appConfig = loadConfig(overrides);
  const db = createDatabase(appConfig.databasePath);
  const app = fastify({
    logger: true
  });

  app.decorate("db", db);
  app.decorate("appConfig", appConfig);

  app.register(cors, {
    origin: true
  });

  app.register(registerApiRoutes);

  if (fs.existsSync(appConfig.webDistPath)) {
    app.register(fastifyStatic, {
      root: appConfig.webDistPath,
      prefix: "/"
    });

    app.setNotFoundHandler(async (request, reply) => {
      const pathname = request.url.replace(/^\/+/, "");
      if (pathname.startsWith("api/")) {
        reply.code(404).send({ message: "Route API introuvable." });
        return;
      }

      return reply.sendFile("index.html");
    });
  } else {
    app.get("/", async () => ({
      application: "Fables de La Fontaine",
      message:
        "Frontend non compilé. Lancez `pnpm dev` pour le développement ou `pnpm build` puis `pnpm start`."
    }));
  }

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}
