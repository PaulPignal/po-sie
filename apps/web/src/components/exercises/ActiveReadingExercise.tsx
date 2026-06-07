import { useState } from "react";
import type { ActiveReadingPayload } from "@la-fontaine/shared";
import { isCorrect } from "../../exercises/grade";

export function ActiveReadingExercise({
  payload,
  disabled,
  submitted,
  onSubmit
}: {
  payload: ActiveReadingPayload;
  disabled: boolean;
  submitted: boolean;
  onSubmit: (values: { answer: string }) => void;
}) {
  const [answer, setAnswer] = useState("");
  const submit = () => onSubmit({ answer });
  const ok = submitted && isCorrect(answer, payload.expectedAnswer);
  const stateClass = submitted ? (ok ? " field--correct" : " field--wrong") : "";

  return (
    <section className="exercise-form">
      <div className="exercise-reading">
        {payload.revealedVerses.map((verse, index) => (
          <p key={`${verse}-${index}`}>{verse}</p>
        ))}
      </div>
      <div className="panel panel--soft">
        <p className="kicker">Indices</p>
        <p>{payload.previousCue ? `Vers d’avant : ${payload.previousCue}` : "Pas d’indice sur le vers d’avant."}</p>
        <p>{payload.answerCue ? `Début du vers : ${payload.answerCue}` : "Pas de début donné."}</p>
      </div>
      <label className={`field${stateClass}`}>
        <span>Écris le vers de mémoire</span>
        <textarea
          rows={3}
          value={answer}
          autoFocus
          disabled={disabled || submitted}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Tape le vers ici. (Entrée pour valider)"
        />
      </label>
      {submitted && !ok ? (
        <p className="answer-reveal">
          Vers attendu : <strong>{payload.expectedAnswer}</strong>
        </p>
      ) : null}
      {submitted ? null : (
        <button className="button" disabled={disabled} onClick={submit} type="button">
          Vérifier
        </button>
      )}
    </section>
  );
}
