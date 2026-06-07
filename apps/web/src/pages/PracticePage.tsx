import { exerciseTypes } from "@la-fontaine/shared";
import type { ExercisePayload, ExerciseResult, ExerciseSubmission } from "@la-fontaine/shared";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getExercise, submitExercise } from "../api/client";
import { ErrorPanel } from "../components/ErrorPanel";
import { Loader } from "../components/Loader";
import { ResultPanel } from "../components/ResultPanel";
import { ActiveReadingExercise } from "../components/exercises/ActiveReadingExercise";
import { ClozeExercise } from "../components/exercises/ClozeExercise";
import { QuizExercise } from "../components/exercises/QuizExercise";
import { RecitationExercise } from "../components/exercises/RecitationExercise";
import { ReorderExercise } from "../components/exercises/ReorderExercise";
import { exerciseMeta, supportText } from "../exercises/meta";
import { useAsyncData } from "../hooks/useAsyncData";

export function PracticePage() {
  const { slug, exerciseType } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [referenceVisible, setReferenceVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExerciseResult | null>(null);
  const [seed, setSeed] = useState<number | undefined>(() => {
    const value = searchParams.get("seed");
    return value ? Number(value) : undefined;
  });
  const requestedUnit = searchParams.get("unit");
  const requestedSupport = searchParams.get("support") ?? "auto";
  const startedAt = useMemo(() => Date.now(), [slug, exerciseType, seed, requestedUnit, requestedSupport]);

  const { data, error, loading, reload } = useAsyncData(
    () =>
      getExercise(slug ?? "", exerciseType ?? "", {
        ...(requestedUnit ? { unitIndex: Number(requestedUnit) } : {}),
        ...(requestedSupport ? { support: requestedSupport } : {}),
        ...(seed !== undefined ? { seed } : {})
      }),
    [slug, exerciseType, requestedUnit, requestedSupport, seed]
  );

  if (!slug || !exerciseType) {
    return <ErrorPanel message="Exercice introuvable." />;
  }

  if (loading) {
    return <Loader label="Préparation de l’exercice..." />;
  }

  if (error || !data) {
    return <ErrorPanel message={error ?? "Impossible de préparer l’exercice."} onRetry={reload} />;
  }

  const newDraw = () => {
    const nextSeed = Date.now();
    setSeed(nextSeed);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("seed", String(nextSeed));
      return next;
    });
    setReferenceVisible(false);
    setHintCount(0);
    setResult(null);
  };

  const submit = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const response = await submitExercise(slug, exerciseType, {
        ...((values as unknown) as ExerciseSubmission),
        type: data.type,
        unitIndex: data.unit.unitIndex,
        seed: data.seed,
        supportLevel: data.supportLevel,
        hintsUsed: hintCount,
        latencyMs: Date.now() - startedAt
      } as ExerciseSubmission);
      setResult(response);
    } finally {
      setSubmitting(false);
    }
  };

  const order = exerciseTypes;
  const stepIndex = order.indexOf(data.type);
  const nextType = stepIndex >= 0 && stepIndex < order.length - 1 ? order[stepIndex + 1] : null;

  return (
    <div className="page-stack">
      <section className="panel hero">
        <div>
          <p className="kicker">
            Entraînement · étape {stepIndex + 1} sur {order.length}
          </p>
          <h2>{exerciseMeta[data.type].label}</h2>
          <p>
            Vers {data.unit.startVerse} à {data.unit.endVerse} · {supportText[data.supportLevel]}
          </p>
        </div>
        <div className="hero__actions">
          <Link className="button button--ghost" to="/">
            Retour à ma fable
          </Link>
          {result ? null : (
            <button className="button button--ghost" onClick={newDraw} type="button">
              Un autre exercice
            </button>
          )}
        </div>
      </section>

      {result ? null : (
        <section className="panel">
          <p>
            Essaie d’abord de te rappeler le passage, puis vérifie. Plus tu réussis, moins l’app t’aide — pour
            t’amener petit à petit à réciter tout seul.
          </p>
          <div className="actions-inline">
            <button
              className="button button--ghost"
              onClick={() => {
                // Only count a hint when the reference is revealed, not when it is hidden again.
                if (!referenceVisible) {
                  setHintCount((value) => value + 1);
                }
                setReferenceVisible((value) => !value);
              }}
              type="button"
            >
              {referenceVisible ? "Cacher le texte" : "Voir le texte"}
            </button>
            <span>{hintCount === 0 ? "Aucun coup d’œil au texte" : `${hintCount} coup d’œil au texte`}</span>
          </div>
          {referenceVisible ? <pre className="reference-box">{data.unit.text}</pre> : null}
        </section>
      )}

      <section className="panel">{renderExercise(data, submitting, result !== null, submit)}</section>

      {result ? (
        <>
          <ResultPanel result={result} />
          <section className="panel result-actions">
            {nextType ? (
              <Link className="button" to={`/fables/${slug}/practice/${nextType}`}>
                Continuer → {exerciseMeta[nextType].label}
              </Link>
            ) : (
              <Link className="button" to={`/fables/${slug}/test`}>
                Passer au test du jour →
              </Link>
            )}
            <button className="button button--ghost" onClick={newDraw} type="button">
              Recommencer
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}

function renderExercise(
  payload: ExercisePayload,
  submitting: boolean,
  submitted: boolean,
  onSubmit: (values: Record<string, unknown>) => void
) {
  switch (payload.type) {
    case "lecture-active":
      return <ActiveReadingExercise disabled={submitting} submitted={submitted} onSubmit={onSubmit} payload={payload} />;
    case "texte-a-trous":
      return <ClozeExercise disabled={submitting} submitted={submitted} onSubmit={onSubmit} payload={payload} />;
    case "remise-en-ordre":
      return <ReorderExercise disabled={submitting} submitted={submitted} onSubmit={onSubmit} payload={payload} />;
    case "quiz":
      return <QuizExercise disabled={submitting} submitted={submitted} onSubmit={onSubmit} payload={payload} />;
    case "recitation":
      return <RecitationExercise disabled={submitting} submitted={submitted} onSubmit={onSubmit} payload={payload} />;
  }
}
