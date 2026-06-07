import type { ContentKind } from "@la-fontaine/shared";

// Étiquettes FR par genre — pour neutraliser la copie « fable » sur un catalogue mixte.
export const kindLabel: Record<ContentKind, string> = {
  fable: "fable",
  psaume: "psaume",
  poeme: "poème",
  texte: "texte"
};

export const kindLabelPlural: Record<ContentKind, string> = {
  fable: "fables",
  psaume: "psaumes",
  poeme: "poèmes",
  texte: "textes"
};

// Possessif accordé au genre grammatical (la fable / le psaume).
export const kindPossessive: Record<ContentKind, string> = {
  fable: "Ma",
  psaume: "Mon",
  poeme: "Mon",
  texte: "Mon"
};

export const kindFilterOptions: Array<{ value: ContentKind | "tous"; label: string }> = [
  { value: "tous", label: "Tous les genres" },
  { value: "fable", label: "Fables" },
  { value: "psaume", label: "Psaumes" },
  { value: "poeme", label: "Poèmes" },
  { value: "texte", label: "Autres textes" }
];
