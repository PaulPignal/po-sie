import { useState } from "react";
import type { ReorderPayload } from "@la-fontaine/shared";

export function ReorderExercise({
  payload,
  disabled,
  onSubmit
}: {
  payload: ReorderPayload;
  disabled: boolean;
  onSubmit: (values: { orderedIds: string[] }) => void;
}) {
  const [ordered, setOrdered] = useState(payload.items);
  const pinnedIds = new Set([payload.pinnedItemId].filter(Boolean));

  return (
    <section className="exercise-form">
      <p>Remets les vers dans le bon ordre à l’aide des flèches.</p>
      <div className="reorder-list">
        {ordered.map((item, index) => (
          <article className="panel panel--soft reorder-item" key={item.id}>
            <div>
              {item.anchorLabel ? <p className="kicker">Finit par : {item.anchorLabel}</p> : null}
              <pre>{item.text}</pre>
            </div>
            <div className="reorder-actions">
              <button
                className="button button--ghost"
                disabled={disabled || index === 0 || pinnedIds.has(item.id)}
                onClick={() => moveItem(index, index - 1, ordered, setOrdered)}
                type="button"
              >
                Monter
              </button>
              <button
                className="button button--ghost"
                disabled={disabled || index === ordered.length - 1 || pinnedIds.has(item.id)}
                onClick={() => moveItem(index, index + 1, ordered, setOrdered)}
                type="button"
              >
                Descendre
              </button>
            </div>
          </article>
        ))}
      </div>
      <button className="button" disabled={disabled} onClick={() => onSubmit({ orderedIds: ordered.map((item) => item.id) })} type="button">
        Vérifier
      </button>
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
