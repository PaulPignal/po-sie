import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config";
import { buildApp } from "../src/app";

let app: ReturnType<typeof buildApp>;
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lf-auth-"));
});

afterEach(async () => {
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function make(overrides: Partial<AppConfig>) {
  app = buildApp({
    databasePath: path.join(dir, "t.sqlite"),
    dataDir: dir,
    webDistPath: path.join(dir, "missing-dist"),
    ...overrides
  });
  await app.ready();
  return app;
}

describe("basic-auth optionnelle", () => {
  it("laisse tout passer quand les identifiants ne sont pas configurés", async () => {
    await make({});
    const res = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(res.statusCode).toBe(200);
  });

  it("renvoie 401 sans identifiants quand l'auth est active", async () => {
    await make({ basicAuthUser: "u", basicAuthPass: "p" });
    const res = await app.inject({ method: "GET", url: "/api/dashboard" });
    expect(res.statusCode).toBe(401);
    expect(String(res.headers["www-authenticate"])).toContain("Basic");
  });

  it("accepte les bons identifiants", async () => {
    await make({ basicAuthUser: "u", basicAuthPass: "p" });
    const authorization = `Basic ${Buffer.from("u:p").toString("base64")}`;
    const res = await app.inject({ method: "GET", url: "/api/dashboard", headers: { authorization } });
    expect(res.statusCode).toBe(200);
  });

  it("garde /api/health public même avec l'auth active", async () => {
    await make({ basicAuthUser: "u", basicAuthPass: "p" });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
  });
});
