import { getInitialTheme, initializeTheme } from "./design/theme-bootstrap";
import { applyTheme } from "./design/theme-definitions";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";
import "./components/glass-card.css";

async function mount() {
  await initializeTheme();
  applyTheme(getInitialTheme());
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
void mount();
