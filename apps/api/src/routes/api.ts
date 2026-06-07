import type { FastifyInstance } from "fastify";
import { exerciseTypes } from "@la-fontaine/shared";
import {
  buildExercisePayload,
  injectExpectedData,
  resolveSeed,
  resolveSupportLevel,
  scoreExerciseSubmission
} from "../services/exercises";
import { getDashboard, getExerciseContext, getFableDetail, getReviewQueue, listFables } from "../services/store";
import { getDailyTestStatus, submitDailyTest } from "../services/dailyTest";

export async function registerApiRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({
    status: "ok",
    time: new Date().toISOString()
  }));

  app.get("/api/dashboard", async (_, reply) => {
    reply.send(getDashboard(app.db));
  });

  app.get("/api/review-queue", async (request, reply) => {
    const limit = Number((request.query as { limit?: string }).limit ?? "8");
    reply.send(getReviewQueue(app.db, Math.max(1, Math.min(20, limit))));
  });

  app.get("/api/fables", async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const filters = {
      ...(query.query ? { query: query.query } : {}),
      status: (query.status as never) ?? "tous",
      difficulty: (query.difficulty as never) ?? "toutes",
      length: (query.length as never) ?? "toutes",
      sort: (query.sort as never) ?? "titre"
    };

    reply.send(listFables(app.db, filters));
  });

  app.get("/api/fables/:slug", async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const detail = getFableDetail(app.db, slug);
    if (!detail) {
      reply.code(404).send({ message: "Fable introuvable." });
      return;
    }

    reply.send(detail);
  });

  app.get("/api/fables/:slug/daily-test", async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const status = getDailyTestStatus(app.db, slug);
    if (!status) {
      reply.code(404).send({ message: "Fable introuvable." });
      return;
    }

    reply.send(status);
  });

  app.post("/api/fables/:slug/daily-test", async (request, reply) => {
    const slug = (request.params as { slug: string }).slug;
    const body = (request.body ?? {}) as { recited?: unknown };
    const recited = typeof body.recited === "string" ? body.recited : "";
    const result = submitDailyTest(app.db, slug, recited);
    if (!result) {
      reply.code(404).send({ message: "Fable introuvable." });
      return;
    }

    reply.send(result);
  });

  app.get("/api/fables/:slug/exercises/:type", async (request, reply) => {
    const params = request.params as { slug: string; type: string };
    if (!exerciseTypes.includes(params.type as never)) {
      reply.code(400).send({ message: "Type d’exercice inconnu." });
      return;
    }

    const query = request.query as Record<string, string | undefined>;
    const unitIndex = query.unitIndex ? Number(query.unitIndex) : undefined;
    const context = getExerciseContext(app.db, params.slug, unitIndex);
    if (!context) {
      reply.code(404).send({ message: "Contexte d’exercice introuvable." });
      return;
    }

    const supportLevel = resolveSupportLevel(query.support, context.unitProgress.memoryStage);
    const seed = resolveSeed(
      query.seed ? Number(query.seed) : undefined,
      params.slug,
      params.type as never,
      context.unit.unitIndex
    );

    reply.send(buildExercisePayload(context, params.type as never, supportLevel, seed));
  });

  app.post("/api/fables/:slug/exercises/:type/submit", async (request, reply) => {
    const params = request.params as { slug: string; type: string };
    if (!exerciseTypes.includes(params.type as never)) {
      reply.code(400).send({ message: "Type d’exercice inconnu." });
      return;
    }

    const incoming = request.body as Record<string, unknown>;
    const unitIndex =
      typeof incoming.unitIndex === "number" ? incoming.unitIndex : Number(incoming.unitIndex ?? 0);
    const context = getExerciseContext(app.db, params.slug, unitIndex);
    if (!context) {
      reply.code(404).send({ message: "Contexte d’exercice introuvable." });
      return;
    }

    const supportLevel = resolveSupportLevel(
      String(incoming.supportLevel ?? "auto"),
      context.unitProgress.memoryStage
    );
    const seed = resolveSeed(
      typeof incoming.seed === "number" ? incoming.seed : Number(incoming.seed ?? 0),
      params.slug,
      params.type as never,
      context.unit.unitIndex
    );
    const payload = buildExercisePayload(context, params.type as never, supportLevel, seed);
    const submission = injectExpectedData(payload, {
      ...(incoming as object),
      type: params.type,
      unitIndex: context.unit.unitIndex,
      supportLevel,
      seed,
      hintsUsed: Number(incoming.hintsUsed ?? 0),
      latencyMs: Number(incoming.latencyMs ?? 0)
    } as never);

    reply.send(scoreExerciseSubmission(app.db, context, submission));
  });
}
