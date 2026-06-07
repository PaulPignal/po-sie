import type {
  DailyTestResult,
  DailyTestStatus,
  DashboardSnapshot,
  ExercisePayload,
  ExerciseResult,
  ExerciseSubmission,
  FableDetail,
  FableFilters,
  FableListItem,
  ReviewQueueItem
} from "@la-fontaine/shared";

async function fetchJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Erreur HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getDashboard() {
  return fetchJson<DashboardSnapshot>("/api/dashboard");
}

export function getReviewQueue(limit = 8) {
  return fetchJson<ReviewQueueItem[]>(`/api/review-queue?limit=${limit}`);
}

export function getFables(filters: FableFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.status) params.set("status", filters.status);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.length) params.set("length", filters.length);
  if (filters.sort) params.set("sort", filters.sort);
  return fetchJson<FableListItem[]>(`/api/fables?${params.toString()}`);
}

export function getFable(slug: string) {
  return fetchJson<FableDetail>(`/api/fables/${slug}`);
}

export function getExercise(
  slug: string,
  exerciseType: string,
  options: {
    unitIndex?: number;
    support?: string;
    seed?: number;
  } = {}
) {
  const params = new URLSearchParams();
  if (options.unitIndex !== undefined) params.set("unitIndex", String(options.unitIndex));
  if (options.support) params.set("support", options.support);
  if (options.seed !== undefined) params.set("seed", String(options.seed));
  return fetchJson<ExercisePayload>(`/api/fables/${slug}/exercises/${exerciseType}?${params.toString()}`);
}

export function submitExercise(slug: string, exerciseType: string, payload: ExerciseSubmission) {
  return fetchJson<ExerciseResult>(`/api/fables/${slug}/exercises/${exerciseType}/submit`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getDailyTest(slug: string) {
  return fetchJson<DailyTestStatus>(`/api/fables/${slug}/daily-test`);
}

export function submitDailyTest(slug: string, recited: string) {
  return fetchJson<DailyTestResult>(`/api/fables/${slug}/daily-test`, {
    method: "POST",
    body: JSON.stringify({ recited })
  });
}

