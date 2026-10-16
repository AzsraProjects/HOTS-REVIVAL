// Traduction FR / EN de l'interface. Le français est la langue source : t("Texte français")
// renvoie la traduction anglaise de src/lib/en/ quand l'anglais est actif.
// Langue partagée avec Electron et le backend (settings.json) : changer de langue remonte
// l'arbre React (clé), ce qui suffit à tout retraduire, dans toutes les fenêtres (overlay compris).
//
// Ne jamais traduire les noms venant du jeu (héros, talents, capacités, cartes) : ils restent
// tels que fournis par les données du jeu.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { bridge } from "./bridge";
import { EN } from "./en";

export type Lang = "fr" | "en";
let current: Lang = navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en";

export const lang = () => current;
export const locale = () => (current === "fr" ? "fr-FR" : "en-US");

/** t("{n} parties", { n: 3 }) */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let text = current === "en" ? EN[fr] ?? fr : fr;
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** Langue enregistrée (Electron), à attendre avant le premier rendu. */
export async function loadLanguage(): Promise<Lang> {
  try {
    const saved = await bridge()?.language();
    if (saved === "fr" || saved === "en") current = saved;
  } catch {
    /* navigateur sans Electron : langue du navigateur */
  }
  return current;
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => Promise<void> }>({ lang: current, setLang: async () => {} });
export const useLang = () => useContext(LangContext);

export function LangProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<Lang>(current);
  const apply = (l: Lang) => {
    current = l;
    document.documentElement.lang = l;
    setValue(l);
  };
  useEffect(() => bridge()?.onLanguage(apply), []); // changement fait depuis une autre fenêtre
  const setLang = async (l: Lang) => {
    apply(l);
    await bridge()?.setLanguage(l); // persiste + prévient les autres fenêtres
    const { api } = await import("./api");
    await api.saveSettings({ language: l }).catch(() => undefined); // textes générés par le backend
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

/** Sélecteur de langue à drapeaux. */
export function LangSwitch() {
  const { lang: l, setLang } = useLang();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-void-600 bg-void-800 p-0.5" role="group" aria-label="Langue / Language">
      {(["fr", "en"] as Lang[]).map((x) => (
        <button key={x} type="button" onClick={() => void setLang(x)} aria-pressed={l === x} title={x === "fr" ? "Français" : "English"}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition ${
            l === x ? "bg-white/10 text-white" : "text-slate-400 opacity-60 hover:opacity-100"}`}>
          <Flag lang={x} /> {x === "fr" ? "Français" : "English"}
        </button>
      ))}
    </div>
  );
}
