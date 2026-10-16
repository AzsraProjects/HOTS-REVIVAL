import { lang, locale, t } from "./i18n";

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? "–" : `${(v * 100).toFixed(digits)}${lang() === "fr" ? " %" : "%"}`;

export const clock = (s: number | null | undefined) => {
  if (s === null || s === undefined) return "–:––";
  const sign = s < 0 ? "-" : "";
  const abs = Math.abs(Math.round(s));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
};

export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }) : "–";

export const scoreColor = (score: number) =>
  score >= 75 ? "text-gold-400" : score >= 55 ? "text-storm-300" : score >= 40 ? "text-nexus-300" : "text-rose-400";

// Libellés traduits à la lecture (getters) : ROLE_FR[x], Object.values(…) suivent la langue active.
export const ROLE_FR: Record<string, string> = {
  get Tank() { return t("Tank"); },
  get Bruiser() { return t("Combattant"); },
  get "Ranged Assassin"() { return t("Assassin à distance"); },
  get "Melee Assassin"() { return t("Assassin de mêlée"); },
  get Healer() { return t("Soigneur"); },
  get Support() { return t("Soutien"); },
};

export const CATEGORY_FR: Record<string, string> = {
  get placement() { return t("Placement"); },
  get macro() { return t("Macro"); },
  get teamfight() { return t("Teamfight"); },
  get objectives() { return t("Objectifs"); },
  get survival() { return t("Survie"); },
  get draft() { return t("Draft"); },
};
