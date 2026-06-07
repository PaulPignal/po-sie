import type {
  ActiveReadingPayload,
  ActiveReadingSubmission,
  ClozePayload,
  ClozeSubmission,
  ExercisePayload,
  ExerciseResult,
  ExerciseSubmission,
  ExerciseType,
  QuizPayload,
  QuizSubmission,
  RecitationPayload,
  RecitationSubmission,
  ReorderPayload,
  ReorderSubmission,
  SupportLevel
} from "@la-fontaine/shared";
import type { DatabaseSync } from "node:sqlite";
import { hashSeed, createRng, pickOne, shuffle } from "../utils/random";
import {
  extractLastWord,
  firstWords,
  isContentWord,
  lastWords,
  lineInitials,
  normalizeComparison,
  recommendedSupportFromStage,
  scoreTextAnswer,
  tokenInitials
} from "../utils/text";
import {
  computeCriterionPassed,
  computeNextUnitProgress,
  computeNormalizedScore,
  describeRecommendation
} from "./progress";
import { ExerciseContext, persistExerciseResult } from "./store";

export function resolveSupportLevel(requested: string | undefined, memoryStage: number): SupportLevel {
  if (requested === "high" || requested === "medium" || requested === "low") {
    return requested;
  }

  return recommendedSupportFromStage(memoryStage);
}

export function resolveSeed(
  requestedSeed: number | undefined,
  slug: string,
  exerciseType: ExerciseType,
  unitIndex: number
) {
  return (
    requestedSeed ??
    hashSeed(`${slug}:${exerciseType}:${unitIndex}:${new Date().toISOString().slice(0, 10)}`)
  );
}

export function buildExercisePayload(
  context: ExerciseContext,
  exerciseType: ExerciseType,
  supportLevel: SupportLevel,
  seed: number
): ExercisePayload {
  switch (exerciseType) {
    case "lecture-active":
      return buildActiveReadingPayload(context, supportLevel, seed);
    case "texte-a-trous":
      return buildClozePayload(context, supportLevel, seed);
    case "remise-en-ordre":
      return buildReorderPayload(context, supportLevel, seed);
    case "quiz":
      return buildQuizPayload(context, supportLevel, seed);
    case "recitation":
      return buildRecitationPayload(context, supportLevel, seed);
  }
}

export function scoreExerciseSubmission(
  db: DatabaseSync,
  context: ExerciseContext,
  submission: ExerciseSubmission
): ExerciseResult {
  const accuracyScore = scoreAccuracy(submission);
  const targetSupportLevel = recommendedSupportFromStage(context.unitProgress.memoryStage);
  const criterionPassed = computeCriterionPassed(
    accuracyScore,
    submission.supportLevel,
    targetSupportLevel,
    submission.hintsUsed
  );
  const normalizedScore = computeNormalizedScore(
    accuracyScore,
    submission.supportLevel,
    submission.hintsUsed
  );
  const preview = computeNextUnitProgress({
    current: context.unitProgress,
    now: new Date(),
    normalizedScore,
    criterionPassed,
    supportLevel: submission.supportLevel
  });

  const persisted = persistExerciseResult(db, context, submission, accuracyScore, {
    normalizedScore,
    criterionPassed,
    recommendation: describeRecommendation(normalizedScore),
    nextReviewAt: preview.nextReviewAt,
    recommendedSupportLevel: preview.recommendedSupportLevel,
    corrections: buildCorrections(submission)
  });

  return {
    exerciseType: submission.type,
    ...persisted
  };
}

function buildActiveReadingPayload(
  context: ExerciseContext,
  supportLevel: SupportLevel,
  seed: number
): ActiveReadingPayload {
  const verses = context.unit.verses;
  const rng = createRng(seed);
  const promptLineIndex = verses.length > 1 ? Math.max(1, Math.floor(rng() * verses.length)) : 0;
  const expectedAnswer = verses[promptLineIndex] ?? verses[0] ?? "";
  const previousVerse = promptLineIndex > 0 ? verses[promptLineIndex - 1] : null;

  return {
    type: "lecture-active",
    seed,
    supportLevel,
    unit: context.unit,
    promptLineIndex,
    revealedVerses: verses.slice(0, promptLineIndex),
    previousCue:
      supportLevel === "high"
        ? previousVerse ?? null
        : supportLevel === "medium"
          ? previousVerse
            ? lastWords(previousVerse, 3)
            : null
          : previousVerse
            ? extractLastWord(previousVerse)
            : null,
    answerCue:
      supportLevel === "high"
        ? firstWords(expectedAnswer, 3)
        : supportLevel === "low"
          ? tokenInitials(expectedAnswer)
          : null,
    expectedAnswer,
    pretest: context.unitProgress.attemptsCount === 0,
    readAloudSuggested: true
  };
}

function buildClozePayload(
  context: ExerciseContext,
  supportLevel: SupportLevel,
  seed: number
): ClozePayload {
  const rng = createRng(seed);
  const blanks: ClozePayload["blanks"] = [];
  const linesWithGaps = context.unit.verses.map((line, lineIndex) => {
    const tokens = line.split(/\s+/);
    const candidateIndexes = tokens
      .map((token, tokenIndex) => ({
        token,
        tokenIndex,
        normalized: normalizeComparison(token, false)
      }))
      .filter((item) => isContentWord(item.normalized));

    if (candidateIndexes.length === 0) {
      return line;
    }

    const replacements: Array<{ tokenIndex: number; answer: string; prompt: string }> = [];
    if (supportLevel === "high") {
      const candidate = pickOne(candidateIndexes, rng);
      replacements.push({
        tokenIndex: candidate.tokenIndex,
        answer: candidate.token,
        prompt: `${candidate.normalized.at(0)?.toUpperCase() ?? ""}${"_".repeat(
          Math.max(2, candidate.normalized.length - 1)
        )}`
      });
    } else if (supportLevel === "medium") {
      const count = Math.min(2, candidateIndexes.length);
      const picked = shuffle(candidateIndexes, rng).slice(0, count);
      for (const candidate of picked) {
        replacements.push({
          tokenIndex: candidate.tokenIndex,
          answer: candidate.token,
          prompt: "_".repeat(Math.max(4, candidate.normalized.length))
        });
      }
    } else {
      const target = shuffle(candidateIndexes, rng)
        .slice(0, Math.min(2, candidateIndexes.length))
        .sort((a, b) => a.tokenIndex - b.tokenIndex);
      const start = target.at(0)?.tokenIndex ?? 0;
      const end = target.at(-1)?.tokenIndex ?? start;
      replacements.push({
        tokenIndex: start,
        answer: tokens.slice(start, end + 1).join(" "),
        prompt: "____ ____"
      });
      for (let index = start + 1; index <= end; index += 1) {
        tokens[index] = "";
      }
    }

    for (const replacement of replacements) {
      const blankId = `blank-${lineIndex}-${replacement.tokenIndex}`;
      blanks.push({
        id: blankId,
        lineIndex,
        prompt: replacement.prompt,
        answer: replacement.answer
      });
      tokens[replacement.tokenIndex] = `[[${blankId}]]`;
    }

    return tokens
      .filter((token) => token !== "")
      .join(" ")
      .replace(/\[\[(.*?)]]/g, (_, blankId) => `______(${blankId})`);
  });

  return {
    type: "texte-a-trous",
    seed,
    supportLevel,
    unit: context.unit,
    linesWithGaps,
    blanks,
    strictAccents: false
  };
}

function buildReorderPayload(
  context: ExerciseContext,
  supportLevel: SupportLevel,
  seed: number
): ReorderPayload {
  const rng = createRng(seed);
  const verses = context.unit.verses;
  const chunkSize = supportLevel === "high" ? 2 : 1;
  const items = [];

  for (let index = 0; index < verses.length; index += chunkSize) {
    const chunk = verses.slice(index, index + chunkSize);
    items.push({
      id: `piece-${index}`,
      text: chunk.join("\n"),
      ...(supportLevel === "high"
        ? {
            anchorLabel: extractLastWord(chunk.at(-1) ?? chunk[0] ?? "")
          }
        : {})
    });
  }

  const correctOrder = items.map((item) => item.id);
  const shuffled = shuffle(items, rng);
  const pinnedItemId = supportLevel === "high" && shuffled.length > 2 ? correctOrder[0] : undefined;

  return {
    type: "remise-en-ordre",
    seed,
    supportLevel,
    unit: context.unit,
    items: shuffled,
    correctOrder,
    ...(pinnedItemId ? { pinnedItemId } : {})
  };
}

function buildQuizPayload(
  context: ExerciseContext,
  supportLevel: SupportLevel,
  seed: number
): QuizPayload {
  const rng = createRng(seed);
  const verses = context.allVerses.length >= 6 ? context.allVerses : context.unit.verses;
  const prompts: QuizPayload["questions"] = [];
  const maxIndex = Math.max(0, verses.length - 2);
  const candidateIndexes = shuffle(
    Array.from({ length: maxIndex + 1 }, (_, index) => index),
    rng
  );

  for (const index of candidateIndexes) {
    if (prompts.length >= 6) {
      break;
    }

    const line = verses[index] ?? "";
    const nextLine = verses[index + 1] ?? "";
    if (!nextLine) {
      continue;
    }

    prompts.push({
      id: `next-${index}`,
      prompt: `Tape le vers qui suit : « ${line} »`,
      expectedAnswer: nextLine,
      kind: "next-line"
    });

    if (prompts.length >= 6) {
      break;
    }

    prompts.push({
      id: `complete-${index}`,
      prompt: `Complète le vers : « ${firstWords(nextLine, supportLevel === "high" ? 3 : 2)}… »`,
      expectedAnswer: nextLine,
      kind: "complete-line"
    });

    if (prompts.length >= 6) {
      break;
    }

    prompts.push({
      id: `end-${index}`,
      prompt: `Quel mot clôt ce vers ? « ${line} »`,
      expectedAnswer: extractLastWord(line),
      kind: "end-word"
    });
  }

  return {
    type: "quiz",
    seed,
    supportLevel,
    unit: context.unit,
    questions: prompts.slice(0, 6)
  };
}

function buildRecitationPayload(
  context: ExerciseContext,
  supportLevel: SupportLevel,
  seed: number
): RecitationPayload {
  const rng = createRng(seed);
  const cueMode =
    supportLevel === "high"
      ? "full-text"
      : supportLevel === "medium"
        ? "first-line"
        : rng() > 0.5
          ? "initials-lines"
          : "none";
  const verses = context.unit.verses;
  const verificationIndex = Math.min(
    verses.length - 1,
    Math.max(0, Math.floor(rng() * verses.length))
  );
  const expectedVerificationAnswer = verses[verificationIndex] ?? verses[0] ?? "";
  const previousLine = verificationIndex > 0 ? verses[verificationIndex - 1] : null;

  return {
    type: "recitation",
    seed,
    supportLevel,
    unit: context.unit,
    cueMode,
    visibleText:
      cueMode === "full-text"
        ? context.unit.text
        : cueMode === "first-line"
          ? `${verses[0] ?? ""}\n${verses.slice(1).map(() => "…").join("\n")}`
          : cueMode === "initials-lines"
            ? lineInitials(context.unit.text)
            : "Aucun indice visible. Récite puis vérifie ensuite.",
    verificationPrompt: previousLine
      ? `Après « ${previousLine} », écris le vers suivant.`
      : `Écris de mémoire ce vers clé du passage.`,
    expectedVerificationAnswer,
    productionSuggestion: "Récite ce passage à voix haute : ça aide à mieux le retenir.",
    gestureSuggestion: /court|marche|prend|vient|vole|danse|mange|parle|dit/.test(
      context.unit.text.toLowerCase()
    )
      ? "Mime l’action avec un geste en récitant : ça ancre le souvenir."
      : null
  };
}

function scoreAccuracy(submission: ExerciseSubmission) {
  switch (submission.type) {
    case "lecture-active":
      return scoreTextAnswer(submission.answer, submission.expectedAnswer);
    case "texte-a-trous":
      return scoreCloze(submission);
    case "remise-en-ordre":
      return scoreReorder(submission);
    case "quiz":
      return scoreQuiz(submission);
    case "recitation":
      return scoreRecitation(submission);
  }
}

function buildCorrections(submission: ExerciseSubmission) {
  switch (submission.type) {
    case "lecture-active":
      return [`Vers attendu : ${submission.expectedAnswer}`];
    case "texte-a-trous":
      return Object.values(expectedAnswersOf(submission)).map(
        (expected) => `Mot attendu : ${expected}`
      );
    case "remise-en-ordre":
      // Feedback is shown in place (vers colorés vert/rouge) — no separate list needed.
      return [];
    case "quiz":
      return Object.values(expectedAnswersOf(submission)).map(
        (expected) => `Réponse attendue : ${expected}`
      );
    case "recitation":
      return [`Vérification attendue : ${expectedAnswersOf(submission).verification ?? ""}`];
  }
}

function scoreCloze(submission: ClozeSubmission) {
  // Score over every expected blank, not only the ones the learner filled in.
  // An unanswered blank must count as 0, otherwise the score is inflated.
  const expected = expectedAnswersOf(submission);
  const blankIds = Object.keys(expected);
  if (blankIds.length === 0) {
    return 0;
  }

  let total = 0;
  for (const blankId of blankIds) {
    const answer = submission.answers[blankId] ?? "";
    total += scoreTextAnswer(answer, expected[blankId] ?? "", submission.strictAccents);
  }
  return Math.round(total / blankIds.length);
}

function scoreReorder(submission: ReorderSubmission) {
  const expected = submissionPayloadOrder(submission);
  if (expected.length === 0) {
    return 0;
  }

  let positions = 0;
  let adjacency = 0;
  for (let index = 0; index < expected.length; index += 1) {
    if (submission.orderedIds[index] === expected[index]) {
      positions += 1;
    }

    if (
      index < expected.length - 1 &&
      submission.orderedIds[index] === expected[index] &&
      submission.orderedIds[index + 1] === expected[index + 1]
    ) {
      adjacency += 1;
    }
  }

  const positionScore = positions / expected.length;
  const adjacencyScore = expected.length > 1 ? adjacency / (expected.length - 1) : 1;
  return Math.round((positionScore * 0.7 + adjacencyScore * 0.3) * 100);
}

function scoreQuiz(submission: QuizSubmission) {
  // Score over every expected question, so skipped questions count as 0.
  const expected = expectedAnswersOf(submission);
  const questionIds = Object.keys(expected);
  if (questionIds.length === 0) {
    return 0;
  }

  let total = 0;
  for (const questionId of questionIds) {
    total += scoreTextAnswer(submission.answers[questionId] ?? "", expected[questionId] ?? "");
  }
  return Math.round(total / questionIds.length);
}

function scoreRecitation(submission: RecitationSubmission) {
  // Purely objective: compare the verification verse the learner wrote against the expected one.
  // (No self-assessment — a self-rating can't inflate what you actually retained.)
  return scoreTextAnswer(submission.verificationAnswer, submissionPayloadAnswer("verification", submission));
}

function expectedAnswersOf(submission: ExerciseSubmission): Record<string, string> {
  return (
    (submission as ExerciseSubmission & { __expectedAnswers?: Record<string, string> })
      .__expectedAnswers ?? {}
  );
}

function submissionPayloadAnswer(blankId: string, submission: ExerciseSubmission) {
  return expectedAnswersOf(submission)[blankId] ?? "";
}

function submissionPayloadOrder(submission: ReorderSubmission) {
  const payload = (submission as ReorderSubmission & { __correctOrder?: string[] }).__correctOrder;
  return payload ?? [];
}

export function injectExpectedData(
  payload: ExercisePayload,
  submission: ExerciseSubmission
): ExerciseSubmission {
  if (payload.type === "lecture-active" && submission.type === "lecture-active") {
    // The web client never sends expectedAnswer; derive it from the server-rebuilt
    // payload so grading stays authoritative server-side (and never reads undefined).
    return {
      ...submission,
      expectedAnswer: payload.expectedAnswer
    } as ExerciseSubmission;
  }

  if (payload.type === "texte-a-trous" && submission.type === "texte-a-trous") {
    return {
      ...submission,
      __expectedAnswers: Object.fromEntries(payload.blanks.map((blank) => [blank.id, blank.answer]))
    } as ExerciseSubmission;
  }

  if (payload.type === "quiz" && submission.type === "quiz") {
    return {
      ...submission,
      __expectedAnswers: Object.fromEntries(
        payload.questions.map((question) => [question.id, question.expectedAnswer])
      )
    } as ExerciseSubmission;
  }

  if (payload.type === "remise-en-ordre" && submission.type === "remise-en-ordre") {
    return {
      ...submission,
      __correctOrder: payload.correctOrder
    } as ExerciseSubmission;
  }

  if (payload.type === "recitation" && submission.type === "recitation") {
    return {
      ...submission,
      __expectedAnswers: {
        verification: payload.expectedVerificationAnswer
      }
    } as ExerciseSubmission;
  }

  return submission;
}
