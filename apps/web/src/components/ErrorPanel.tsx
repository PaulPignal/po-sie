export function ErrorPanel({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-card state-card--error">
      <h2>Une erreur est survenue</h2>
      <p>{message}</p>
      {onRetry ? (
        <button className="button button--ghost" onClick={onRetry} type="button">
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

