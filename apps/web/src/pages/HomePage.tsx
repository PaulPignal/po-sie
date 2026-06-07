import { exerciseTypes } from "@la-fontaine/shared";
import { Link } from "react-router-dom";
import { getDailyTest, getFable } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { Loader } from "../components/Loader";
import { Sparkline } from "../components/Sparkline";
import { exerciseMeta } from "../exercises/meta";
import { useFocus } from "../focus/FocusContext";
import { useAsyncData } from "../hooks/useAsyncData";

export function HomePage() {
  const { slug } = useFocus();
  const { data, error, loading, reload } = useAsyncData(async () => {
    if (!slug) {
      return null;
    }
    const [fable, daily] = await Promise.all([getFable(slug), getDailyTest(slug)]);
    return { fable, daily };
  }, [slug]);

  if (!slug) {
    return (
      <EmptyState
        title="Choisis la fable que tu veux apprendre"
        description="Tu en travailles une seule à la fois, un peu chaque jour, jusqu’à la connaître par cœur."
        actionLabel="Choisir une fable"
        actionTo="/choisir"
      />
    );
  }

  if (loading) {
    return <Loader label="Chargement de ta fable…" />;
  }

  if (error || !data) {
    return <ErrorPanel message={error ?? "Impossible de charger ta fable."} onRetry={reload} />;
  }

  const { fable, daily } = data;
  const knownPct = daily.latest ?? 0;

  return (
    <div className="page-stack">
      <section className="panel hero">
        <div>
          <p className="kicker">Ma fable du moment</p>
          <h2>{fable.title}</h2>
          <p>
            {fable.bookLabel} · fable {fable.itemNumber} · {fable.verseCount} vers
          </p>
        </div>
        <Link className="button button--ghost" to="/choisir">
          Changer de fable
        </Link>
      </section>

      <section className="grid dashboard-grid">
        <article className="panel memo-card">
          <p className="kicker">Ce que tu retiens</p>
          {daily.daysPracticed === 0 ? (
            <>
              <p className="memo-card__lead">Tu n’as pas encore fait de test sur cette fable.</p>
              <p>Le test du jour mesure ce que tu sais réciter sans aide. Fais-en un pour démarrer ta courbe.</p>
            </>
          ) : (
            <>
              <div className="memo-card__score">
                <strong>{knownPct}%</strong>
                <span>retrouvés de mémoire au dernier test</span>
              </div>
              <Sparkline points={daily.history} />
              <div className="memo-card__meta">
                <span>Meilleur : {daily.best}%</span>
                <span>
                  {daily.daysPracticed} jour{daily.daysPracticed > 1 ? "s" : ""} de test
                </span>
                {daily.masteredAt ? <span className="memo-card__badge">Par cœur 🎉</span> : null}
              </div>
            </>
          )}
        </article>

        <article className="panel today-card">
          <p className="kicker">Aujourd’hui</p>
          {daily.todayDone ? (
            <>
              <p className="today-card__done">
                Test du jour fait : <strong>{daily.todayScore}%</strong>
              </p>
              <p>Reviens demain pour mesurer ce qui reste. En attendant, entraîne-toi autant que tu veux.</p>
              <Link className="button button--ghost" to={`/fables/${slug}/test`}>
                Refaire le test
              </Link>
            </>
          ) : (
            <>
              <p>Récite la fable de mémoire pour voir où tu en es. Une fois par jour suffit.</p>
              <Link className="button" to={`/fables/${slug}/test`}>
                Faire le test du jour
              </Link>
            </>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>M’entraîner</h2>
          <div className="hero__actions">
            <Link className="button button--ghost" to={`/fables/${slug}`}>
              Lire le texte
            </Link>
            <Link className="button" to={`/fables/${slug}/practice/${exerciseTypes[0]}`}>
              Commencer l’entraînement
            </Link>
          </div>
        </div>
        <p>Du plus simple au plus exigeant. Suis l’ordre, ou choisis librement — autant de fois que tu veux.</p>
        <div className="cards-grid cards-grid--compact">
          {exerciseTypes.map((type, index) => (
            <Link className="mini-card mini-card--step" key={type} to={`/fables/${slug}/practice/${type}`}>
              <span className="step-badge">{index + 1}</span>
              <strong>{exerciseMeta[type].label}</strong>
              <span>{exerciseMeta[type].tagline}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
