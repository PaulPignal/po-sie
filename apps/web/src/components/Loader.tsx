export function Loader({ label = "Chargement..." }: { label?: string }) {
  return (
    <div className="state-card">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

