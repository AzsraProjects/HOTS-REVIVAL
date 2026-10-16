import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initAnalytics } from "./lib/analytics";
import { LangProvider, loadLanguage } from "./lib/i18n";
import "./index.css";

initAnalytics();

void loadLanguage().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <LangProvider>
        <App />
      </LangProvider>
    </StrictMode>,
  ),
);
