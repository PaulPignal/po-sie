import type {
  LearningStatus,
  SupportLevel,
  UnitProgressSnapshot
} from "@la-fontaine/shared";
import { recommendedSupportFromStage } from "../utils/text";

const STAGE_INTERVALS = [0, 1, 3, 7, 14];
const SUPPORT_MULTIPLIERS: Record<SupportLevel, number> = {
  high: 0.7,
  medium: 0.85,
  low: 1
};

export interface SessionSummary {
  normalizedScore: number;
  createdAt: string;
}

export interface CurrentUnitProgress {
  unitId: number;
  unitIndex: number;
  memoryStage: number;
  consecutiveCriterionPasses: number;
  failureStreak: number;
  lastSupportLevel: SupportLevel;
  masteryScore: number;
  attemptsCount: number;
  successCount: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface ProgressComputationInput {
  current: CurrentUnitProgress;
  now: Date;
  normalizedScore: number;
  criterionPassed: boolean;
  supportLevel: SupportLevel;
}

export function computeNormalizedScore(
  accuracyScore: number,
  supportLevel: SupportLevel,
  hintsUsed: number
) {
  return Math.max(
    0,
    Math.min(100, Math.round(accuracyScore * SUPPORT_MULTIPLIERS[supportLevel] - hintsUsed * 5))
  );
}

export function computeCriterionPassed(
  accuracyScore: number,
  supportLevel: SupportLevel,
  targetSupportLevel: SupportLevel,
  hintsUsed: number
) {
  const supportRank = {
    high: 1,
    medium: 2,
    low: 3
  };

  return (
    accuracyScore >= 95 &&
    hintsUsed === 0 &&
    supportRank[supportLevel] >= supportRank[targetSupportLevel]
  );
}

export function computeNextUnitProgress(input: ProgressComputationInput) {
  const isSuccess = input.normalizedScore >= 70;
  let memoryStage = input.current.memoryStage;
  let consecutiveCriterionPasses = input.current.consecutiveCriterionPasses;
  let failureStreak = input.current.failureStreak;

  if (input.criterionPassed) {
    consecutiveCriterionPasses += 1;
    failureStreak = 0;
    if (consecutiveCriterionPasses >= 2) {
      memoryStage = Math.min(memoryStage + 1, 4);
      consecutiveCriterionPasses = 0;
    }
  } else if (isSuccess) {
    consecutiveCriterionPasses = 0;
    failureStreak = 0;
  } else {
    consecutiveCriterionPasses = 0;
    failureStreak += 1;
    if (failureStreak >= 2 && memoryStage > 0) {
      memoryStage -= 1;
      failureStreak = 0;
    }
  }

  const nextReviewAt = isSuccess ? addDays(input.now, STAGE_INTERVALS[memoryStage] ?? 0) : input.now.toISOString();

  const recommendedSupportLevel = !isSuccess
    ? strengthenSupport(input.supportLevel)
    : recommendedSupportFromStage(memoryStage);

  return {
    memoryStage,
    consecutiveCriterionPasses,
    failureStreak,
    lastSupportLevel: input.supportLevel,
    attemptsCount: input.current.attemptsCount + 1,
    successCount: input.current.successCount + (isSuccess ? 1 : 0),
    lastReviewedAt: input.now.toISOString(),
    nextReviewAt,
    recommendedSupportLevel,
    isSuccess
  };
}

export function computeMasteryScore(history: SessionSummary[], now = new Date()) {
  const recent = history.slice(0, 8);
  if (recent.length === 0) {
    return 0;
  }

  let weightedTotal = 0;
  let totalWeight = 0;

  recent.forEach((session, index) => {
    const ageDays = differenceInDays(now, new Date(session.createdAt));
    const recencyMultiplier = ageDays <= 14 ? 1.2 : ageDays <= 30 ? 1 : 0.8;
    const positionWeight = Math.max(1, recent.length - index);
    const weight = positionWeight * recencyMultiplier;
    weightedTotal += session.normalizedScore * weight;
    totalWeight += weight;
  });

  return Math.round(weightedTotal / totalWeight);
}

export function deriveFableStatus(unitProgress: Array<Pick<UnitProgressSnapshot, "attemptsCount" | "memoryStage">>) {
  if (unitProgress.length === 0) {
    return "jamais_vue" satisfies LearningStatus;
  }

  if (unitProgress.every((unit) => unit.attemptsCount === 0)) {
    return "jamais_vue" satisfies LearningStatus;
  }

  // « Maîtrisée » : au moins 80 % des unités ont atteint le palier maximal (stage 4).
  // (stage >= 4 implique stage >= 3, donc l'ancien double seuil était redondant.)
  const masteredShare =
    unitProgress.filter((unit) => unit.memoryStage >= 4).length / unitProgress.length;

  if (masteredShare >= 0.8) {
    return "maîtrisée" satisfies LearningStatus;
  }

  return "en_cours" satisfies LearningStatus;
}

export function describeRecommendation(normalizedScore: number) {
  if (normalizedScore < 70) {
    return "Pas encore tout à fait. Regarde la bonne réponse, puis réessaie.";
  }

  if (normalizedScore < 95) {
    return "Bien joué ! Encore un peu et c’est tout bon.";
  }

  return "Parfait, tu le sais. Garde le rythme.";
}

function strengthenSupport(level: SupportLevel): SupportLevel {
  if (level === "low") {
    return "medium";
  }

  return "high";
}

function addDays(date: Date, days: number) {
  if (days === 0) {
    return date.toISOString();
  }

  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone.toISOString();
}

function differenceInDays(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

