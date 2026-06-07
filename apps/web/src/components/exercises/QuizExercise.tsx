import { useState } from "react";
import type { QuizPayload } from "@la-fontaine/shared";
import { isCorrect } from "../../exercises/grade";

export function QuizExercise({
  payload,
  disabled,
  submitted,
  onSubmit
}: {
  payload: QuizPayload;
  disabled: boolean;
  submitted: boolean;
  onSubmit: (values: { answers: Record<string, string> }) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const submit = () => onSubmit({ answers });

  return (
    <section className="exercise-form">
      {payload.questions.map((question, index) => {
        const value = answers[question.id] ?? "";
        const ok = submitted && isCorrect(value, question.expectedAnswer);
        const stateClass = submitted ? (ok ? " field--correct" : " field--wrong") : "";
        return (
          <label className={`field${stateClass}`} key={question.id}>
            <span>
              {index + 1}/{payload.questions.length} · {question.prompt}
            </span>
            <input
              value={value}
              autoFocus={index === 0}
              disabled={disabled || submitted}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [question.id]: event.target.value
                }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            {submitted && !ok ? (
              <small className="answer-reveal">
                Réponse : <strong>{question.expectedAnswer}</strong>
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
