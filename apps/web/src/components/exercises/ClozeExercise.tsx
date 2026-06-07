import { useState } from "react";
import type { ClozePayload } from "@la-fontaine/shared";
import { isCorrect } from "../../exercises/grade";

export function ClozeExercise({
  payload,
  disabled,
  submitted,
  onSubmit
}: {
  payload: ClozePayload;
  disabled: boolean;
  submitted: boolean;
  onSubmit: (values: { answers: Record<string, string> }) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const submit = () => onSubmit({ answers });

  return (
    <section className="exercise-form">
      <div className="panel panel--soft">
        <p className="kicker">Texte à compléter</p>
        {payload.linesWithGaps.map((line, index) => (
          <p key={`${line}-${index}`}>{line.replace(/\(blank-[^)]+\)/g, "")}</p>
        ))}
      </div>
      {payload.blanks.map((blank, index) => {
        const value = answers[blank.id] ?? "";
        const ok = submitted && isCorrect(value, blank.answer);
        const stateClass = submitted ? (ok ? " field--correct" : " field--wrong") : "";
        return (
          <label className={`field${stateClass}`} key={blank.id}>
            <span>{`Mot manquant ${index + 1} · indice : ${blank.prompt}`}</span>
            <input
              value={value}
              autoFocus={index === 0}
              disabled={disabled || submitted}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [blank.id]: event.target.value
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Le mot qui manque"
            />
            {submitted && !ok ? (
              <small className="answer-reveal">
                Réponse : <strong>{blank.answer}</strong>
              </small>
            ) : null}
          </label>
        );
      })}
      {submitted ? null : (
        <button className="button" disabled={disabled} onClick={submit} type="button">
          Vérifier
        </button>
      )}
    </section>
  );
}
