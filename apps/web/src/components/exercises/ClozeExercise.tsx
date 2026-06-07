import { useState } from "react";
import type { ClozePayload } from "@la-fontaine/shared";

export function ClozeExercise({
  payload,
  disabled,
  onSubmit
}: {
  payload: ClozePayload;
  disabled: boolean;
  onSubmit: (values: { answers: Record<string, string> }) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <section className="exercise-form">
      <div className="panel panel--soft">
        <p className="kicker">Texte à compléter</p>
        {payload.linesWithGaps.map((line, index) => (
          <p key={`${line}-${index}`}>{line.replace(/\(blank-[^)]+\)/g, "")}</p>
        ))}
      </div>
      {payload.blanks.map((blank, index) => (
        <label className="field" key={blank.id}>
          <span>{`Mot manquant ${index + 1} · indice : ${blank.prompt}`}</span>
          <input
            value={answers[blank.id] ?? ""}
            onChange={(event) =>
              setAnswers((current) => ({
                ...current,
                [blank.id]: event.target.value
              }))
            }
            placeholder="Le mot qui manque"
          />
        </label>
      ))}
      <button className="button" disabled={disabled} onClick={() => onSubmit({ answers })} type="button">
        Vérifier
      </button>
    </section>
  );
}

