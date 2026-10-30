import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LangProvider, t } from "./lib/i18n";
import { Notice } from "./components/ui";
// Polices servies par le site lui-même (aucune requête vers Google Fonts).
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cinzel/latin-800.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./index.css";
import { About } from "./pages/About";
import { HeroPage } from "./pages/HeroPage";
import { Heroes } from "./pages/Heroes";
import { Home } from "./pages/Home";
import { PlayerPage } from "./pages/PlayerPage";
import { Players } from "./pages/Players";
import { usePageMeta } from "./lib/seo";

function NotFound() {
  usePageMeta(t("Page introuvable"), { noindex: true });
  return (
    <Notice title={t("Page introuvable")}>
      {t("Cette page s'est perdue dans le Nexus.")} <Link to="/" className="text-storm-300 hover:text-white">{t("Retour à l'accueil")}</Link>
    </Notice>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/heros", element: <Heroes /> },
      { path: "/heros/:id", element: <HeroPage /> },
      { path: "/joueurs", element: <Players /> },
      { path: "/joueurs/:slug", element: <PlayerPage /> },
      { path: "/a-propos", element: <About /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <RouterProvider router={router} />
    </LangProvider>
  </StrictMode>,
);
