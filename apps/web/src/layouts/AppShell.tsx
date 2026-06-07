import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <span className="shell__eyebrow">Apprendre par cœur</span>
          <h1>Les Fables de La Fontaine</h1>
          <p>Une fable à la fois, un peu chaque jour, jusqu’à la savoir par cœur.</p>
        </div>
        <nav className="shell__nav">
          <NavLink to="/" end>
            Ma fable
          </NavLink>
          <NavLink to="/choisir">Changer de fable</NavLink>
        </nav>
      </header>
      <main className="shell__content">
        <Outlet />
      </main>
    </div>
  );
}
