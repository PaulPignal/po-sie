import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ReorderItem, ReorderPayload } from "@la-fontaine/shared";

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
  const [ordered, setOrdered] = useState<ReorderItem[]>(payload.items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const pinnedIds = new Set([payload.pinnedItemId].filter(Boolean));
  const interactive = !disabled && !submitted;
  const positionCorrect = (index: number) => ordered[index]?.id === payload.correctOrder[index];

  const moveTo = (fromId: string, toIndex: number) => {
    setOrdered((current) => {
      const fromIndex = current.findIndex((item) => item.id === fromId);
      if (fromIndex === -1 || fromIndex === toIndex || toIndex < 0 || toIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return current;
      }
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  // Pointer-based drag works for both mouse and touch (no dependency). The dragged
  // card is set to pointer-events:none in CSS so elementFromPoint resolves the card
  // *under* the finger, which is the one we reorder against.
  const onHandleDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (!interactive || pinnedIds.has(id)) {
      return;
    }
    setDraggingId(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandleMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingId) {
      return;
    }
    const overEl = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-reorder-index]");
    if (!overEl) {
      return;
    }
    const overIndex = Number(overEl.dataset.reorderIndex);
    if (!Number.isNaN(overIndex)) {
      moveTo(draggingId, overIndex);
    }
  };

  const onHandleUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingId) {
      return;
    }
    setDraggingId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <section className="exercise-form">
      <p>
        {submitted
          ? "Les vers en vert sont bien placés, ceux en rouge non."
          : "Fais glisser les vers avec la poignée (ou les flèches) pour les remettre dans l’ordre."}
      </p>
      <div className="reorder-list">
        {ordered.map((item, index) => {
          const pinned = pinnedIds.has(item.id);
          const stateClass = submitted
            ? positionCorrect(index)
              ? " reorder-item--correct"
              : " reorder-item--wrong"
            : "";
          const dragClass = draggingId === item.id ? " reorder-item--dragging" : "";
          return (
            <article
              className={`panel panel--soft reorder-item${stateClass}${dragClass}`}
              data-reorder-index={index}
              key={item.id}
            >
              <div className="reorder-item__body">
                {interactive ? (
                  <button
                    className="reorder-handle"
                    aria-label={`Déplacer le vers : ${item.text.split("\n")[0] ?? ""}`}
                    disabled={pinned}
                    onPointerDown={(event) => onHandleDown(event, item.id)}
                    onPointerMove={onHandleMove}
                    onPointerUp={onHandleUp}
                    onPointerCancel={onHandleUp}
                    type="button"
                  >
                    ⠿
                  </button>
                ) : null}
                <div className="reorder-item__text">
                  {pinned ? <p className="kicker reorder-pin">📌 vers de départ</p> : null}
                  {item.anchorLabel ? <p className="kicker">Finit par : {item.anchorLabel}</p> : null}
                  <pre>{item.text}</pre>
                </div>
              </div>
              <div className="reorder-actions">
                <button
                  className="button button--ghost"
                  disabled={!interactive || index === 0 || pinned}
                  onClick={() => moveTo(item.id, index - 1)}
                  type="button"
                >
                  Monter
                </button>
                <button
                  className="button button--ghost"
                  disabled={!interactive || index === ordered.length - 1 || pinned}
                  onClick={() => moveTo(item.id, index + 1)}
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
