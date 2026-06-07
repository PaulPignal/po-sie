import { useState } from "react";
import type { RecitationPayload } from "@la-fontaine/shared";
import { isCorrect } from "../../exercises/grade";

export function RecitationExercise({
  payload,
  disabled,
  submitted,
  onSubmit
}: {
  payload: RecitationPayload;
  disabled: boolean;
  submitted: boolean;
  onSubmit: (values: { verificationAnswer: string }) => void;
}) {
  const [verificationAnswer, setVerificationAnswer] = useState("");
  const submit = () => onSubmit({ verificationAnswer });
  const ok = submitted && isCorrect(verificationAnswer, payload.expectedVerificationAnswer);
  const stateClass = submitted ? (ok ? " field--correct" : " field--wrong") : "";

  return (
    <section className="exercise-form">
      <div className="panel panel--soft">
        <p className="kicker">Aide</p>
        <pre>{payload.visibleText}</pre>
      </div>
      <div className="panel panel--soft">
        <p>{payload.productionSuggestion}</p>
        {payload.gestureSuggestion ? <p>{payload.gestureSuggestion}</p> : null}
      </div>
      <label className={`field${stateClass}`}>
        <span>{payload.verificationPrompt}</span>
        <textarea
          rows={3}
          value={verificationAnswer}
          autoFocus
          disabled={disabled || submitted}
          onChange={(event) => setVerificationAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Écris ce vers de mémoire. (Entrée pour valider)"
        />
      </label>
      {submitted && !ok ? (
        <p className="answer-reveal">
          Vers attendu : <strong>{payload.expectedVerificationAnswer}</strong>
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
