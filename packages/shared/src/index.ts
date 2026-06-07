export const exerciseTypes = [
  "lecture-active",
  "texte-a-trous",
  "remise-en-ordre",
  "quiz",
  "recitation"
] as const;

export const supportLevels = ["high", "medium", "low"] as const;

export const learningStatuses = ["jamais_vue", "en_cours", "maîtrisée"] as const;

export const difficulties = ["facile", "intermédiaire", "avancée"] as const;

export type ExerciseType = (typeof exerciseTypes)[number];
export type SupportLevel = (typeof supportLevels)[number];
export type LearningStatus = (typeof learningStatuses)[number];
export type Difficulty = (typeof difficulties)[number];

export type LengthFilter = "courte" | "moyenne" | "longue" | "toutes";
export type FableSort =
  | "titre"
  | "plus_courte"
  | "plus_longue"
  | "mieux_maîtrisée"
  | "révisée_récemment"
  | "à_réviser";

export interface LearningUnit {
  id: number;
  unitIndex: number;
  unitType: "strophe" | "bloc";
  startVerse: number;
  endVerse: number;
  verseCount: number;
  text: string;
  verses: string[];
}

export interface UnitProgressSnapshot {
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

export interface ProgressSnapshot {
  status: LearningStatus;
  masteryScore: number;
  attemptsCount: number;
  lastReviewedAt: string | null;
  dueUnits: number;
  stageCounts: Record<string, number>;
}

export interface ExerciseStat {
  exerciseType: ExerciseType;
  attemptsCount: number;
  avgScore: number;
  bestScore: number;
  successRate: number;
  lastPracticedAt: string | null;
}

export interface FableListItem {
  slug: string;
  title: string;
  bookNumber: number;
  bookLabel: string;
  itemNumber: number;
  verseCount: number;
  estimatedReadingMinutes: number;
  difficulty: Difficulty;
  status: LearningStatus;
  masteryScore: number;
  lastReviewedAt: string | null;
  dueUnits: number;
}

export interface FableDetail {
  slug: string;
  title: string;
  bookNumber: number;
  bookLabel: string;
  itemNumber: number;
  verseCount: number;
  wordCount: number;
  estimatedReadingMinutes: number;
  difficulty: Difficulty;
  sourceUrl: string;
  text: string;
  progress: ProgressSnapshot;
  units: LearningUnit[];
  unitProgress: UnitProgressSnapshot[];
  exerciseStats: ExerciseStat[];
}

export interface ReviewQueueItem {
  slug: string;
  title: string;
  unitIndex: number;
  exerciseType: ExerciseType;
  supportLevel: SupportLevel;
  nextReviewAt: string | null;
  memoryStage: number;
  verseRangeLabel: string;
}

export interface DashboardSnapshot {
  totalFables: number;
  startedFables: number;
  masteredFables: number;
  dueUnits: number;
  totalSessions: number;
  minutesPracticed: number;
  dueNow: ReviewQueueItem[];
  recentFables: Array<Pick<FableListItem, "slug" | "title" | "masteryScore" | "lastReviewedAt" | "status">>;
  progressByStatus: Array<{ status: LearningStatus; count: number }>;
  activity14Days: Array<{ date: string; sessions: number }>;
  recentSessions: Array<{
    slug: string;
    title: string;
    exerciseType: ExerciseType;
    normalizedScore: number;
    createdAt: string;
  }>;
}

export interface FableFilters {
  query?: string;
  status?: LearningStatus | "tous";
  difficulty?: Difficulty | "toutes";
  length?: LengthFilter;
  sort?: FableSort;
}

export interface ExerciseBasePayload {
  type: ExerciseType;
  seed: number;
  supportLevel: SupportLevel;
  unit: LearningUnit;
}

export interface ActiveReadingPayload extends ExerciseBasePayload {
  type: "lecture-active";
  promptLineIndex: number;
  revealedVerses: string[];
  previousCue: string | null;
  answerCue: string | null;
  expectedAnswer: string;
  pretest: boolean;
  readAloudSuggested: boolean;
}

export interface ClozeBlank {
  id: string;
  lineIndex: number;
  prompt: string;
  answer: string;
}

export interface ClozePayload extends ExerciseBasePayload {
  type: "texte-a-trous";
  linesWithGaps: string[];
  blanks: ClozeBlank[];
  strictAccents: boolean;
}

export interface ReorderItem {
  id: string;
  text: string;
  anchorLabel?: string;
}

export interface ReorderPayload extends ExerciseBasePayload {
  type: "remise-en-ordre";
  items: ReorderItem[];
  correctOrder: string[];
  pinnedItemId?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  expectedAnswer: string;
  kind: "next-line" | "complete-line" | "end-word" | "timed-burst";
}

export interface QuizPayload extends ExerciseBasePayload {
  type: "quiz";
  questions: QuizQuestion[];
}

export interface RecitationPayload extends ExerciseBasePayload {
  type: "recitation";
  cueMode: "full-text" | "first-line" | "initials-words" | "initials-lines" | "none";
  visibleText: string;
  verificationPrompt: string;
  expectedVerificationAnswer: string;
  productionSuggestion: string;
  gestureSuggestion: string | null;
}

export type ExercisePayload =
  | ActiveReadingPayload
  | ClozePayload
  | ReorderPayload
  | QuizPayload
  | RecitationPayload;

export interface ExerciseSubmissionBase {
  unitIndex: number;
  seed: number;
  supportLevel: SupportLevel;
  hintsUsed: number;
  latencyMs: number;
}

export interface ActiveReadingSubmission extends ExerciseSubmissionBase {
  type: "lecture-active";
  answer: string;
  expectedAnswer: string;
}

export interface ClozeSubmission extends ExerciseSubmissionBase {
  type: "texte-a-trous";
  answers: Record<string, string>;
  strictAccents: boolean;
}

export interface ReorderSubmission extends ExerciseSubmissionBase {
  type: "remise-en-ordre";
  orderedIds: string[];
}

export interface QuizSubmission extends ExerciseSubmissionBase {
  type: "quiz";
  answers: Record<string, string>;
}

export interface RecitationSubmission extends ExerciseSubmissionBase {
  type: "recitation";
  verificationAnswer: string;
}

export type ExerciseSubmission =
  | ActiveReadingSubmission
  | ClozeSubmission
  | ReorderSubmission
  | QuizSubmission
  | RecitationSubmission;

export interface ExerciseResult {
  exerciseType: ExerciseType;
  normalizedScore: number;
  accuracyScore: number;
  criterionPassed: boolean;
  recommendation: string;
  nextReviewAt: string | null;
  recommendedSupportLevel: SupportLevel;
  corrections: string[];
  unitProgress: UnitProgressSnapshot;
  fableProgress: ProgressSnapshot;
}

// --- Test du jour (évaluation quotidienne de la mémorisation) ---

export interface DailyTestPoint {
  date: string; // YYYY-MM-DD
  score: number; // 0-100, part du poème retrouvée de mémoire
}

export interface DailyTestStatus {
  todayDone: boolean;
  todayScore: number | null;
  best: number;
  latest: number | null;
  daysPracticed: number;
  masteredAt: string | null; // 1ʳᵉ date où score >= seuil "par cœur"
  history: DailyTestPoint[];
}

export interface DailyTestResult {
  score: number;
  date: string;
  isBestToday: boolean;
  mastered: boolean;
  missedLines: string[]; // vers manqués ou approximatifs, pour réviser
  status: DailyTestStatus;
}

export const BY_HEART_THRESHOLD = 95;

