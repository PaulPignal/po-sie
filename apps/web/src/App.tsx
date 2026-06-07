import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { HomePage } from "./pages/HomePage";
import { ChooseFablePage } from "./pages/ChooseFablePage";
import { FableDetailPage } from "./pages/FableDetailPage";
import { PracticePage } from "./pages/PracticePage";
import { DailyTestPage } from "./pages/DailyTestPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/choisir" element={<ChooseFablePage />} />
        <Route path="/fables/:slug" element={<FableDetailPage />} />
        <Route path="/fables/:slug/test" element={<DailyTestPage />} />
        <Route path="/fables/:slug/practice/:exerciseType" element={<PracticePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
