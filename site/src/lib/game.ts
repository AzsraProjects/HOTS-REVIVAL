// Référentiel du jeu (généré par scripts/build-data.mjs) et libellés français.
import heroesData from "../data/heroes.json";
import mapsData from "../data/maps.json";
import { lang, t } from "./i18n";


export type Role = "Tank" | "Bruiser" | "Healer" | "Support" | "Ranged Assassin" | "Melee Assassin";

export interface Hero {
  id: string;
  name: string;
  role: Role;
  portrait: string | null;
}

export interface GameMap {
  id: string;
  name: string;
  en: string;
  aram: boolean;
}

export interface Talent {
  name: string;
  level: number;
  sort: number;
  description: string;
  icon: string | null;
  retired?: boolean; // retiré du jeu : affiché seulement s'il apparaît dans les statistiques
}

export const HEROES = heroesData as Hero[];
export const MAPS = mapsData as GameMap[];
const heroById = new Map(HEROES.map((h) => [h.id, h]));
const mapById = new Map(MAPS.map((m) => [m.id, m]));

export const hero = (id: string): Hero =>
  heroById.get(id) ?? { id, name: id, role: "Ranged Assassin", portrait: null };
export const mapName = (id: string) => {
  const m = mapById.get(id);
  return m ? (lang() === "en" ? m.en : m.name) : id;
};
// Adresses complètes des images, choisies par scripts/build-data.mjs (heroes-talents ou copie locale).
export const portraitUrl = (h: Hero) => h.portrait;
export const talentIconUrl = (t: Talent) => t.icon;

// Libellés traduits à la lecture (getter) : ils suivent la langue active.
const labelled = <T extends object>(items: (T & { fr: string })[]) =>
  items.map((i) => Object.defineProperty({ ...i }, "label", { get: () => t(i.fr), enumerable: true }) as T & { fr: string; label: string });

export const ROLES = labelled<{ id: Role; color: string }>([
  { id: "Tank", fr: "Tank", color: "#4f8cff" },
  { id: "Bruiser", fr: "Combattant", color: "#f59e0b" },
  { id: "Ranged Assassin", fr: "Assassin à distance", color: "#f43f5e" },
  { id: "Melee Assassin", fr: "Assassin de mêlée", color: "#e879f9" },
  { id: "Healer", fr: "Soigneur", color: "#34d399" },
  { id: "Support", fr: "Soutien", color: "#22d3ee" },
]);
export const role = (id: Role) => ROLES.find((r) => r.id === id) ?? ROLES[2];

export const MODES = labelled<{ id: string | null }>([
  { id: null, fr: "Tous les modes" },
  { id: "Storm League", fr: "Ligue Tempête" },
  { id: "Quick Match", fr: "Partie rapide" },
  { id: "Unranked Draft", fr: "Draft non classée" },
  { id: "ARAM", fr: "ARAM" },
]);
const OLD_MODES: Record<string, string> = { "Hero League": "Ligue des héros", "Team League": "Ligue par équipe" };
export const modeLabel = (id: string) => MODES.find((m) => m.id === id)?.label ?? (OLD_MODES[id] ? t(OLD_MODES[id]) : id);

const REGION_NAMES: Record<number, string> = { 1: "Amériques", 2: "Europe", 3: "Asie", 5: "Chine" };
export const regionName = (r: number) => (REGION_NAMES[r] ? t(REGION_NAMES[r]) : t("Région {n}", { n: r }));
