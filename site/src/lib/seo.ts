// Référencement : titre d'onglet, URL canonique et noindex par page. Google exécute le
// JavaScript du site et reprend ces valeurs dans ses résultats.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const SITE_URL = "https://hots-revival.pages.dev";
const BASE_TITLE = "HOTS REVIVAL";

function head(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

/** usePageMeta("Héros") -> « Héros — HOTS REVIVAL ». Sans titre : titre de l'accueil. */
export function usePageMeta(title?: string, { noindex = false }: { noindex?: boolean } = {}) {
  const { pathname } = useLocation();
  useEffect(() => {
    const previous = document.title;
    if (title) document.title = `${title} — ${BASE_TITLE}`;

    const canonical = head('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }));
    canonical.setAttribute("href", SITE_URL + (pathname === "/" ? "/" : pathname.replace(/\/$/, "")));

    const robots = noindex
      ? head('meta[name="robots"]', () => Object.assign(document.createElement("meta"), { name: "robots" }))
      : null;
    robots?.setAttribute("content", "noindex");
    return () => {
      document.title = previous;
      robots?.remove();
    };
  }, [title, noindex, pathname]);
}
