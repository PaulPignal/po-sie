import { useMemo, useState } from "react";
import type { ClozePayload } from "@la-fontaine/shared";
import { isCorrect } from "../../exercises/grade";

// The server marks each gap in a line as `______(blank-<line>-<token>)`.
// We parse those markers so the inputs can be rendered IN PLACE, inside the verse.
const BLANK_MARKER = /______\((blank-[^)]+)\)/g;

type Segment = { kind: "text"; value: string } | { kind: "blank"; id: string };

function parseLine(line: string): Segment[] {
  const segments: Segment[] = [];
  const regex = new RegExp(BLANK_MARKER.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: line.slice(lastIndex, match.index) });
    }
    segments.push({ kind: "blank", id: match[1]! });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    segments.push({ kind: "text", value: line.slice(lastIndex) });
  }
  return segments;
}

// Size the input to the hint so the gap reads like the missing word, not a giant box.
function slotWidth(prompt: string, answer: string): number {
  const hint = prompt.replace(/\s+/g, "").length;
  const target = Math.max(hint, Math.min(answer.length, 16));
  return Math.min(18, Math.max(4, target + 1));
}

export function ClozeExercise({
  payload,
  disabled,
  submitted,
  onSubmit
}: {
  payload: ClozePayload;
  disabled: boolean;
  submitted: boolean;
  onSubmit: (values: { answers: Record<string, string> }) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const submit = () => onSubmit({ answers });

  const blanksById = useMemo(
    () => new Map(payload.blanks.map((blank) => [blank.id, blank])),
    [payload.blanks]
  );
  const blankOrder = useMemo(
    () => new Map(payload.blanks.map((blank, index) => [blank.id, index])),
    [payload.blanks]
  );

  return (
    <section className="exercise-form">
      <p className="kicker">Complète le texte — écris directement dans les blancs.</p>
      <div className="panel panel--soft cloze-text">
        {payload.linesWithGaps.map((line, lineIndex) => (
          <p className="cloze-line" key={`${lineIndex}-${line}`}>
            {parseLine(line).map((segment, segIndex) => {
              if (segment.kind === "text") {
                return <span key={segIndex}>{segment.value}</span>;
              }

              const blank = blanksById.get(segment.id);
              if (!blank) {
                return null;
              }

              const value = answers[segment.id] ?? "";
              const order = blankOrder.get(segment.id) ?? 0;
              const ok = submitted && isCorrect(value, blank.answer);
              const stateClass = submitted
                ? ok
                  ? " cloze-blank--correct"
                  : " cloze-blank--wrong"
                : "";

              return (
                <span className="cloze-slot" key={segIndex}>
                  <input
                    className={`cloze-blank${stateClass}`}
                    style={{ width: `${slotWidth(blank.prompt, blank.answer)}ch` }}
                    value={value}
                    autoFocus={order === 0}
                    disabled={disabled || submitted}
                    aria-label={`Mot manquant ${order + 1}`}
                    placeholder={blank.prompt}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [segment.id]: event.target.value
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submit();
                      }
                    }}
                  />
                  {submitted && !ok ? <mark className="cloze-answer">{blank.answer}</mark> : null}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      {submitted ? null : (
        <button className="button" disabled={disabled} onClick={submit} type="button">
          Vérifier
        </button>
      )}
    </section>
  );
}
