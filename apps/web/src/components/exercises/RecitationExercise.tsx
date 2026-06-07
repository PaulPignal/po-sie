import { useState } from "react";
import type { RecitationPayload } from "@la-fontaine/shared";

export function RecitationExercise({
  payload,
  disabled,
  onSubmit
}: {
  payload: RecitationPayload;
  disabled: boolean;
  onSubmit: (values: { verificationAnswer: string }) => void;
}) {
  const [verificationAnswer, setVerificationAnswer] = useState("");

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
      <label className="field">
        <span>{payload.verificationPrompt}</span>
        <textarea
          rows={3}
          value={verificationAnswer}
          onChange={(event) => setVerificationAnswer(event.target.value)}
          placeholder="Écris ce vers de mémoire"
        />
      </label>
      <button
        className="button"
        disabled={disabled}
        onClick={() => onSubmit({ verificationAnswer })}
        type="button"
      >
        Vérifier
      </button>
    </section>
  );
}
