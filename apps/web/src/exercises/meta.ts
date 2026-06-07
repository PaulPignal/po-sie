import type { ExerciseType, SupportLevel } from "@la-fontaine/shared";

export const exerciseMeta: Record<ExerciseType, { label: string; tagline: string }> = {
  "lecture-active": { label: "Lecture active", tagline: "Retrouve le vers qui suit" },
  "texte-a-trous": { label: "Texte à trous", tagline: "Complète les mots manquants" },
  "remise-en-ordre": { label: "Remettre en ordre", tagline: "Remets les vers dans le bon ordre" },
  quiz: { label: "Quiz", tagline: "Réponds de mémoire, vers par vers" },
  recitation: { label: "Récitation", tagline: "Récite ; l’aide diminue à mesure que tu progresses" }
};

export const supportText: Record<SupportLevel, string> = {
  high: "avec aide",
  medium: "un peu d’aide",
  low: "sans aide"
};
