import type { DailyTestResult } from "@la-fontaine/shared";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDailyTest, getFable, submitDailyTest } from "../api/client";
import { ErrorPanel } from "../components/ErrorPanel";
import { Loader } from "../components/Loader";
import { DailyChart } from "../components/DailyChart";
import { useAsyncData } from "../hooks/useAsyncData";

export function DailyTestPage() {
  const { slug } = useParams();
  const [recited, setRecited] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DailyTestResult | null>(null);

  const { data, error, loading, reload } = useAsyncData(async () => {
    const [fable, status] = await Promise.all([getFable(slug ?? ""), getDailyTest(slug ?? "")]);
    return { fable, status };
  }, [slug]);

  if (!slug) {
    return <ErrorPanel message="Fable introuvable." />;
  }
  if (loading) {
    return <Loader label="Préparation du test…" />;
  }
  if (error || !data) {
    return <ErrorPanel message={error ?? "Impossible de préparer le test."} onRetry={reload} />;
  }

  const { fable, status } = data;
  const liveStatus = result?.status ?? status;

  const submit = async () => {
    setSubmitting(true);
    try {
      setResult(await submitDailyTest(slug, recited));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setResult(null);
    setRecited("");
  };

  return (
    <div className="page-stack">
      <section className="panel hero">
        <div>
          <p className="kicker">Test du jour</p>
          <h2>{fable.title}</h2>
          <p>Récite la fable de mémoire, sans regarder le texte. On mesure ce que tu retrouves.</p>
        </div>
        <Link className="button button--ghost" to="/">
          Retour à ma fable
        </Link>
      </section>

      {result ? (
        <section className="panel result-panel">
          <div className="result-panel__head">
            <div>
              <p className="kicker">Résultat</p>
              <h2>{result.score}% retrouvés</h2>
            </div>
          </div>
          {result.mastered ? (
            <p className="memo-card__badge">🎉 Tu connais cette fable par cœur. Continue à l’entretenir un jour sur deux.</p>
          ) : result.isBestToday ? (
            <p>C’est ton meilleur score aujourd’hui. Reviens demain pour voir si ça tient.</p>
          ) : (
            <p>On garde ton meilleur score du jour ({liveStatus.todayScore}%). Tu peux réessayer quand tu veux.</p>
          )}

          {result.missedLines.length > 0 ? (
            <div className="result-panel__corrections">
              <p className="kicker">À revoir en priorité</p>
              <ul>
                {result.missedLines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
              <Link className="button button--ghost" to={`/fables/${slug}/practice/texte-a-trous`}>
                M’entraîner sur ces passages
              </Link>
            </div>
          ) : (
            <p>Tu n’as oublié aucun vers important. Beau travail.</p>
          )}

          <DailyCurve status={liveStatus} />

          <div className="actions-inline">
            <button className="button button--ghost" onClick={restart} type="button">
              Refaire le test
            </button>
            <Link className="button" to="/">
              Terminer
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel">
          {status.todayDone ? (
            <p className="today-card__done">
              Tu as déjà fait le test aujourd’hui : <strong>{status.todayScore}%</strong>. Tu peux le refaire — on garde
              ton meilleur score.
            </p>
          ) : null}
          <label className="field">
            <span>Écris la fable de mémoire</span>
            <textarea
              rows={12}
              value={recited}
              onChange={(event) => setRecited(event.target.value)}
              placeholder="Tape ce dont tu te souviens, vers après vers. Peu importe la ponctuation."
            />
          </label>
          <button className="button" disabled={submitting || recited.trim().length === 0} onClick={submit} type="button">
            {submitting ? "Correction…" : "Valider mon test"}
          </button>
          {liveStatus.daysPracticed > 0 ? <DailyCurve status={liveStatus} /> : null}
        </section>
      )}
    </div>
  );
}

function DailyCurve({ status }: { status: DailyTestResult["status"] }) {
  if (status.daysPracticed === 0) {
    return null;
  }
  return (
    <div className="daily-curve">
      <p className="kicker">Ta progression</p>
      <DailyChart status={status} />
      <div className="memo-card__meta">
        <span>Meilleur : {status.best}%</span>
        <span>
          {status.daysPracticed} jour{status.daysPracticed > 1 ? "s" : ""} de test
        </span>
        {status.masteredAt ? <span className="memo-card__badge">Par cœur 🎉</span> : null}
      </div>
    </div>
  );
}
