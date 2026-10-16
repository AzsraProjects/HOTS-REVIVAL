// Traduction FR / EN. Le français est la langue source : t("Texte français") renvoie la
// traduction anglaise de src/lib/en.ts quand l'anglais est actif (le texte français sinon).
// Changer de langue remonte l'arbre React (clé), ce qui suffit à tout retraduire.
import { createContext, useContext, useState, type ReactNode } from "react";
import { EN } from "./en";

export type Lang = "fr" | "en";
const STORAGE_KEY = "hots-revival-lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    /* stockage indisponible */
  }
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";
}

let current: Lang = initialLang();
export const lang = () => current;
export const locale = () => (current === "fr" ? "fr-FR" : "en-US");

/** t("{n} parties", { n: 3 }) */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let text = current === "en" ? EN[fr] ?? fr : fr;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });
export const useLang = () => useContext(LangContext);

export function LangProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Lang>(current);
  document.documentElement.lang = value;
  const setLang = (l: Lang) => {
    current = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* stockage indisponible */
    }
    setValue(l);
  };
  return (
    <LangContext.Provider value={{ lang: value, setLang }}>
      <div key={value} className="contents">{children}</div>
    </LangContext.Provider>
  );
}

function Flag({ lang: l }: { lang: Lang }) {
  return l === "fr" ? (
    <svg viewBox="0 0 3 2" className="h-3.5 w-5 rounded-[2px]" aria-hidden>
      <rect width="1" height="2" fill="#0055A4" /><rect x="1" width="1" height="2" fill="#fff" /><rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  ) : (
    <svg viewBox="0 0 60 30" className="h-3.5 w-5 rounded-[2px]" aria-hidden>
      <clipPath id="uk"><path d="M0 0v30h60V0z" /></clipPath>
      <g clipPath="url(#uk)">
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  );
}

/** Sélecteur de langue à drapeaux (en haut à droite). */
export function LangSwitch() {
  const { lang: l, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-void-900/80 p-0.5" role="group" aria-label="Langue / Language">
      {(["fr", "en"] as Lang[]).map((x) => (
        <button key={x} onClick={() => setLang(x)} aria-pressed={l === x} title={x === "fr" ? "Français" : "English"}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
            l === x ? "bg-white/10 text-white" : "text-slate-400 opacity-60 hover:opacity-100"}`}>
          <Flag lang={x} /> {x.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
