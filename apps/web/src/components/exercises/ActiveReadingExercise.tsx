import { useState } from "react";
import type { ActiveReadingPayload } from "@la-fontaine/shared";

export function ActiveReadingExercise({
  payload,
  disabled,
  onSubmit
}: {
  payload: ActiveReadingPayload;
  disabled: boolean;
  onSubmit: (values: { answer: string }) => void;
}) {
  const [answer, setAnswer] = useState("");

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
      <label className="field">
        <span>Écris le vers de mémoire</span>
        <textarea
          rows={3}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Tape le vers ici."
        />
      </label>
      <button className="button" disabled={disabled} onClick={() => onSubmit({ answer })} type="button">
        Vérifier
      </button>
    </section>
  );
}
