import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { FocusProvider } from "./focus/FocusContext";
import "./styles/app.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Élément racine introuvable.");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <FocusProvider>
        <App />
      </FocusProvider>
    </BrowserRouter>
  </StrictMode>
);

