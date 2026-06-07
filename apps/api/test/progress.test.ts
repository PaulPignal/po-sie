import { describe, expect, it } from "vitest";
import {
  computeCriterionPassed,
  computeNextUnitProgress,
  computeNormalizedScore
} from "../src/services/progress";

const baseProgress = {
  unitId: 1,
  unitIndex: 0,
  memoryStage: 0,
  consecutiveCriterionPasses: 0,
  failureStreak: 0,
  lastSupportLevel: "high" as const,
  masteryScore: 0,
  attemptsCount: 0,
  successCount: 0,
  lastReviewedAt: null,
  nextReviewAt: null
};

describe("progress scheduler", () => {
  it("calcule un score normalisé avec pénalité d’indices", () => {
    expect(computeNormalizedScore(90, "high", 2)).toBe(53);
    expect(computeNormalizedScore(90, "low", 0)).toBe(90);
  });

  it("fait progresser d’un stage après deux rappels au critère", () => {
    const now = new Date("2026-03-14T10:00:00.000Z");
    const first = computeNextUnitProgress({
      current: baseProgress,
      now,
      normalizedScore: 95,
      criterionPassed: true,
      supportLevel: "high"
    });
    const second = computeNextUnitProgress({
      current: {
        ...baseProgress,
        ...first
      },
      now,
      normalizedScore: 97,
      criterionPassed: true,
      supportLevel: "high"
    });

    expect(first.memoryStage).toBe(0);
    expect(second.memoryStage).toBe(1);
  });

  it("dégrade la difficulté après deux échecs successifs", () => {
    const now = new Date("2026-03-14T10:00:00.000Z");
    const current = {
      ...baseProgress,
      memoryStage: 2
    };
    const firstFail = computeNextUnitProgress({
      current,
      now,
      normalizedScore: 20,
      criterionPassed: false,
      supportLevel: "medium"
    });
    const secondFail = computeNextUnitProgress({
      current: {
        ...current,
        ...firstFail
      },
      now,
      normalizedScore: 30,
      criterionPassed: false,
      supportLevel: "medium"
    });

    expect(secondFail.memoryStage).toBe(1);
  });

  it("valide le critère seulement si le soutien cible est atteint", () => {
    expect(computeCriterionPassed(98, "high", "medium", 0)).toBe(false);
    expect(computeCriterionPassed(98, "low", "medium", 0)).toBe(true);
  });
});

