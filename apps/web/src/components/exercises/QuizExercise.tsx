import { useState } from "react";
import type { QuizPayload } from "@la-fontaine/shared";

export function QuizExercise({
  payload,
  disabled,
  onSubmit
}: {
  payload: QuizPayload;
  disabled: boolean;
  onSubmit: (values: { answers: Record<string, string> }) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <section className="exercise-form">
      {payload.questions.map((question) => (
        <label className="field" key={question.id}>
          <span>{question.prompt}</span>
          <input
            value={answers[question.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({
                ...current,
                [question.id]: event.target.value
              }))
            }
          />
        </label>
      ))}
      <button className="button" disabled={disabled} onClick={() => onSubmit({ answers })} type="button">
        Vérifier
      </button>
    </section>
  );
}

