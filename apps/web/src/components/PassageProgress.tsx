import type { FableDetail, LearningUnit, UnitProgressSnapshot } from "@la-fontaine/shared";
import { exerciseTypes } from "@la-fontaine/shared";
import { Link } from "react-router-dom";

const STAGE_MAX = 4;
const firstExercise = exerciseTypes[0];

function passageLabel(unit: LearningUnit): string {
  const base = unit.unitType === "strophe" ? "Strophe" : "Passage";
  return `${base} ${unit.unitIndex + 1}`;
}

function verseRange(unit: LearningUnit): string {
  return unit.startVerse === unit.endVerse
    ? `vers ${unit.startVerse}`
    : `vers ${unit.startVerse}–${unit.endVerse}`;
}

function statusOf(progress: UnitProgressSnapshot | undefined): { label: string; cls: string } {
  if (!progress || progress.attemptsCount === 0) {
    return { label: "à découvrir", cls: "jamais_vue" };
  }
  if (progress.memoryStage >= STAGE_MAX) {
    return { label: "acquis", cls: "maîtrisée" };
  }
  return { label: "en cours", cls: "en_cours" };
}

export function PassageProgress({ fable, slug }: { fable: FableDetail; slug: string }) {
  // A single-unit fable has nothing to break down passage by passage.
  if (fable.units.length <= 1) {
    return null;
  }

  const progressByIndex = new Map(fable.unitProgress.map((entry) => [entry.unitIndex, entry]));

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Tes passages</h2>
        <span>{fable.units.length} passages · maîtrise strophe par strophe</span>
      </div>
      <p>Travaille un passage à la fois. La barre montre ce qui est déjà ancré.</p>
      <div className="passage-list">
        {fable.units.map((unit) => {
          const progress = progressByIndex.get(unit.unitIndex);
          const mastery = progress?.masteryScore ?? 0;
          const stage = progress?.memoryStage ?? 0;
          const status = statusOf(progress);
          const cue = unit.verses[0] ?? "";

          return (
            <article className="passage-card" key={unit.unitIndex}>
              <div className="passage-card__head">
                <div>
                  <strong>{passageLabel(unit)}</strong>
                  <span className="passage-card__range">{verseRange(unit)}</span>
                </div>
                <span className={`badge badge--${status.cls}`}>{status.label}</span>
              </div>
              <p className="passage-card__cue">« {cue}… »</p>
              <div className="passage-card__bar">
                <div className="progress-bar" role="progressbar" aria-valuenow={mastery} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-bar__fill" style={{ width: `${mastery}%` }} />
                </div>
                <div className="passage-card__meta">
                  <span>{mastery}% ancré</span>
                  <span>
                    Palier {stage}/{STAGE_MAX}
                  </span>
                </div>
              </div>
              <Link
                className="button button--ghost"
                to={`/fables/${slug}/practice/${firstExercise}?unit=${unit.unitIndex}`}
              >
                Travailler ce passage
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
