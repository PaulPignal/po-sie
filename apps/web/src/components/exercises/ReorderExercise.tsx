import { useState } from "react";
import type { ReorderPayload } from "@la-fontaine/shared";

export function ReorderExercise({
  payload,
  disabled,
  submitted,
  onSubmit
}: {
  payload: ReorderPayload;
  disabled: boolean;
  submitted: boolean;
  onSubmit: (values: { orderedIds: string[] }) => void;
}) {
  const [ordered, setOrdered] = useState(payload.items);
  const pinnedIds = new Set([payload.pinnedItemId].filter(Boolean));
  const positionCorrect = (index: number) => ordered[index]?.id === payload.correctOrder[index];

  return (
    <section className="exercise-form">
      <p>
        {submitted
          ? "Les vers en vert sont bien placés, ceux en rouge non."
          : "Remets les vers dans le bon ordre à l’aide des flèches."}
      </p>
      <div className="reorder-list">
        {ordered.map((item, index) => {
          const stateClass = submitted
            ? positionCorrect(index)
              ? " reorder-item--correct"
              : " reorder-item--wrong"
            : "";
          return (
            <article className={`panel panel--soft reorder-item${stateClass}`} key={item.id}>
              <div>
                {item.anchorLabel ? <p className="kicker">Finit par : {item.anchorLabel}</p> : null}
                <pre>{item.text}</pre>
              </div>
              <div className="reorder-actions">
                <button
                  className="button button--ghost"
                  disabled={disabled || submitted || index === 0 || pinnedIds.has(item.id)}
                  onClick={() => moveItem(index, index - 1, ordered, setOrdered)}
                  type="button"
                >
                  Monter
                </button>
                <button
                  className="button button--ghost"
                  disabled={disabled || submitted || index === ordered.length - 1 || pinnedIds.has(item.id)}
                  onClick={() => moveItem(index, index + 1, ordered, setOrdered)}
                  type="button"
                >
                  Descendre
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {submitted ? null : (
        <button
          className="button"
          disabled={disabled}
          onClick={() => onSubmit({ orderedIds: ordered.map((item) => item.id) })}
          type="button"
        >
          Vérifier
        </button>
      )}
    </section>
  );
}

function moveItem(
  fromIndex: number,
  toIndex: number,
  items: ReorderPayload["items"],
  setItems: (value: ReorderPayload["items"]) => void
) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return;
  }
  next.splice(toIndex, 0, moved);
  setItems(next);
}
