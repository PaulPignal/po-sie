import crypto from "node:crypto";
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

// Constant-time string compare that never throws on length mismatch.
function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
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

  // Optional HTTP Basic auth — only active when both env vars are set, so local dev
  // and LAN use stay open. The health endpoint stays public for uptime checks.
  const authUser = appConfig.basicAuthUser;
  const authPass = appConfig.basicAuthPass;
  if (authUser && authPass) {
    const expected = `Basic ${Buffer.from(`${authUser}:${authPass}`).toString("base64")}`;
    app.addHook("onRequest", async (request, reply) => {
      if (request.url === "/api/health") {
        return;
      }
      if (!safeEqual(request.headers.authorization ?? "", expected)) {
        reply
          .header("WWW-Authenticate", 'Basic realm="La Fontaine", charset="UTF-8"')
          .code(401)
          .send({ message: "Authentification requise." });
      }
    });
  }

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
