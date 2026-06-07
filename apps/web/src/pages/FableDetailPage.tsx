import { Link, useParams } from "react-router-dom";
import { getFable } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { Loader } from "../components/Loader";
import { StatusBadge } from "../components/StatusBadge";
import { useAsyncData } from "../hooks/useAsyncData";

export function FableDetailPage() {
  const { slug } = useParams();
  const { data, error, loading, reload } = useAsyncData(() => getFable(slug ?? ""), [slug]);

  if (!slug) {
    return <EmptyState title="Texte absent" description="Reviens à l’accueil pour choisir un texte." actionLabel="Accueil" actionTo="/" />;
  }
  if (loading) {
    return <Loader label="Chargement du texte…" />;
  }
  if (error || !data) {
    return <ErrorPanel message={error ?? "Impossible de charger le texte."} onRetry={reload} />;
  }

  return (
    <div className="page-stack">
      <section className="panel hero">
        <div>
          <p className="kicker">
            {data.bookLabel}
            {data.author ? ` · ${data.author}` : ""}
          </p>
          <h2>{data.title}</h2>
          <div className="meta-inline">
            <span>{data.verseCount} vers</span>
            <span>{data.wordCount} mots</span>
            <span>{data.estimatedReadingMinutes} min de lecture</span>
            <StatusBadge status={data.difficulty} variant="difficulty" />
          </div>
        </div>
        <div className="hero__actions">
          <Link className="button button--ghost" to="/">
            Retour à l’accueil
          </Link>
          <Link className="button" to={`/fables/${data.slug}/practice/lecture-active`}>
            M’entraîner
          </Link>
        </div>
      </section>

      <section className="panel reading-panel">
        <div className="panel__header">
          <h2>Le texte</h2>
        </div>
        <pre>{data.text}</pre>
        {data.sourceUrl.startsWith("http") ? (
          <a className="button button--ghost" href={data.sourceUrl} rel="noreferrer" target="_blank">
            Voir la source
          </a>
        ) : null}
      </section>
    </div>
  );
}
