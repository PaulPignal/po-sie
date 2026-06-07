import { Link } from "react-router-dom";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionTo
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="state-card">
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && actionTo ? (
        <Link className="button" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

