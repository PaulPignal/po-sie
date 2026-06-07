import type { Difficulty, LearningStatus } from "@la-fontaine/shared";

export function StatusBadge({
  status,
  variant = "status"
}: {
  status: LearningStatus | Difficulty;
  variant?: "status" | "difficulty";
}) {
  return <span className={`badge badge--${variant} badge--${status}`}>{formatLabel(status)}</span>;
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

