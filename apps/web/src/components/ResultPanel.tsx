import type { ExerciseResult } from "@la-fontaine/shared";

export function ResultPanel({ result }: { result: ExerciseResult }) {
  return (
    <section className="panel result-panel">
      <div className="result-panel__head">
        <div>
          <p className="kicker">Résultat</p>
          <h2>{result.accuracyScore}% retrouvés</h2>
        </div>
      </div>
      <p>{result.recommendation}</p>
      {result.corrections.length > 0 ? (
        <div className="result-panel__corrections">
          <p className="kicker">La bonne réponse</p>
          <ul>
            {result.corrections.map((correction, index) => (
              <li key={index}>{correction}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
