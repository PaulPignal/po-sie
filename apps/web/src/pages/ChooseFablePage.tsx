import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFables } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { Loader } from "../components/Loader";
import { StatusBadge } from "../components/StatusBadge";
import { kindFilterOptions, kindLabel } from "../content";
import { useFocus } from "../focus/FocusContext";
import { useAsyncData } from "../hooks/useAsyncData";

export function ChooseFablePage() {
  const { slug: current, choose } = useFocus();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("tous");
  const [length, setLength] = useState("toutes");
  const [sort, setSort] = useState("plus_courte");
  const deferredQuery = useDeferredValue(query);

  const { data, error, loading, reload } = useAsyncData(
    () =>
      getFables({
        query: deferredQuery,
        kind: kind as never,
        length: length as never,
        sort: sort as never
      }),
    [deferredQuery, kind, length, sort]
  );

  const pick = (slug: string) => {
    choose(slug);
    navigate("/");
  };

  return (
    <div className="page-stack">
      <section className="panel filters">
        <div className="panel__header">
          <h2>Choisir un texte</h2>
        </div>
        <p>Choisis-en un seul pour commencer. Les plus courts sont les plus faciles à apprendre en premier.</p>
        <div className="filters__grid">
          <label className="field">
            <span>Rechercher</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex. Le Corbeau et le Renard"
            />
          </label>
          <label className="field">
            <span>Genre</span>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              {kindFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Longueur</span>
            <select value={length} onChange={(event) => setLength(event.target.value)}>
              <option value="toutes">Toutes</option>
              <option value="courte">Courtes (≤ 16 vers)</option>
              <option value="moyenne">Moyennes</option>
              <option value="longue">Longues (&gt; 32 vers)</option>
            </select>
          </label>
          <label className="field">
            <span>Trier</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="plus_courte">Plus courtes d’abord</option>
              <option value="titre">Ordre alphabétique</option>
              <option value="plus_longue">Plus longues d’abord</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? <Loader label="Chargement des textes…" /> : null}
      {error ? <ErrorPanel message={error} onRetry={reload} /> : null}
      {!loading && !error && data?.length === 0 ? (
        <EmptyState title="Aucun texte trouvé" description="Essaie un autre mot ou enlève les filtres." />
      ) : null}
      {!loading && !error ? (
        <section className="cards-grid">
          {data?.map((fable) => {
            const isCurrent = fable.slug === current;
            return (
              <button
                className={`panel fable-card fable-card--pick${isCurrent ? " fable-card--current" : ""}`}
                key={fable.slug}
                onClick={() => pick(fable.slug)}
                type="button"
              >
                <div className="fable-card__head">
                  <div>
                    <p className="kicker">
                      {fable.bookLabel} · {fable.author ?? kindLabel[fable.kind]}
                    </p>
                    <h3>{fable.title}</h3>
                  </div>
                  {isCurrent ? <span className="badge badge--maîtrisée">En cours</span> : null}
                </div>
                <div className="fable-card__meta">
                  <span>{fable.verseCount} vers</span>
                  <span>{fable.estimatedReadingMinutes} min</span>
                  <StatusBadge status={fable.difficulty} variant="difficulty" />
                </div>
                <span className="fable-card__cta">{isCurrent ? "Continuer cette fable" : "Apprendre celle-ci"}</span>
              </button>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
