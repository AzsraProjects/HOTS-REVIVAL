// Référentiel du jeu (généré par scripts/build-data.mjs) et libellés français.
import heroesData from "../data/heroes.json";
import mapsData from "../data/maps.json";

// Version figée de heroes-talents (MIT) pour les portraits et icônes de talents.
const HT = "https://cdn.jsdelivr.net/gh/heroespatchnotes/heroes-talents@2dcbbf65f81bc3ce85926a5f90b6d8b44d1e4027";

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
}

export const HEROES = heroesData as Hero[];
export const MAPS = mapsData as GameMap[];
const heroById = new Map(HEROES.map((h) => [h.id, h]));
const mapById = new Map(MAPS.map((m) => [m.id, m]));

export const hero = (id: string): Hero =>
  heroById.get(id) ?? { id, name: id, role: "Ranged Assassin", portrait: null };
export const mapName = (id: string) => mapById.get(id)?.name ?? id;
export const portraitUrl = (h: Hero) => (h.portrait ? `${HT}/images/heroes/${h.portrait}` : null);
export const talentIconUrl = (t: Talent) => (t.icon ? `${HT}/images/talents/${t.icon}` : null);

export const ROLES: { id: Role; label: string; color: string }[] = [
  { id: "Tank", label: "Tank", color: "#4f8cff" },
  { id: "Bruiser", label: "Combattant", color: "#f59e0b" },
  { id: "Ranged Assassin", label: "Assassin à distance", color: "#f43f5e" },
  { id: "Melee Assassin", label: "Assassin de mêlée", color: "#e879f9" },
  { id: "Healer", label: "Soigneur", color: "#34d399" },
  { id: "Support", label: "Soutien", color: "#22d3ee" },
];
export const role = (id: Role) => ROLES.find((r) => r.id === id) ?? ROLES[2];

export const MODES: { id: string | null; label: string }[] = [
  { id: null, label: "Tous les modes" },
  { id: "Storm League", label: "Ligue Tempête" },
  { id: "Quick Match", label: "Partie rapide" },
  { id: "Unranked Draft", label: "Draft non classée" },
  { id: "ARAM", label: "ARAM" },
];
export const modeLabel = (id: string) =>
  MODES.find((m) => m.id === id)?.label ?? ({ "Hero League": "Ligue des héros", "Team League": "Ligue par équipe" } as Record<string, string>)[id] ?? id;

export const REGIONS: Record<number, string> = { 1: "Amériques", 2: "Europe", 3: "Asie", 5: "Chine" };
