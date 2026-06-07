// Client-side correctness check for instant per-item feedback (green/red).
// Mirrors the API's normalizeComparison so the highlight matches server grading.
export function normalize(input: string): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrect(answer: string, expected: string): boolean {
  const normalizedExpected = normalize(expected);
  return normalizedExpected.length > 0 && normalize(answer) === normalizedExpected;
}
