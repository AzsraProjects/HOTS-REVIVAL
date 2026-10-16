/**
 * Catalogue des phrases du guide vocal : clé stable (voice_key envoyée par le moteur) → texte à lire
 * lors de l'enregistrement d'un profil de voix. Un clip s'enregistre sous <profil>/<clé>.webm.
 * Les clés ne changent jamais (clips enregistrés) ; seul le texte affiché suit la langue (getters).
 */
import { t } from "./i18n";

export type PhraseCategory = "Niveaux" | "Adversaires" | "Objectifs & camps" | "Conseils";

export interface VoicePhrase { key: string; readonly text: string; category: PhraseCategory }

/** Libellé affiché d'une catégorie (la valeur reste en français). */
export function categoryLabel(cat: PhraseCategory): string {
  switch (cat) {
    case "Niveaux": return t("Niveaux");
    case "Adversaires": return t("Adversaires");
    case "Objectifs & camps": return t("Objectifs & camps");
    case "Conseils": return t("Conseils");
  }
}

const ALLY_LEVELS = [4, 7, 10, 13, 16, 20];
const ENEMY_LEVELS = [10, 16, 20];
const CAMPS: [string, () => string][] = [
  ["siege", () => t("Le camp de siège est bientôt disponible.")],
  ["bruiser", () => t("Le camp de mercenaires est bientôt disponible.")],
  ["boss", () => t("Le boss est bientôt disponible.")],
  ["support", () => t("Le camp de soutien est bientôt disponible.")],
  ["other", () => t("Un camp est bientôt disponible.")],
];

const phrase = (key: string, category: PhraseCategory, text: () => string): VoicePhrase =>
  ({ key, category, get text() { return text(); } });

export const VOICE_PHRASES: VoicePhrase[] = [
  ...ALLY_LEVELS.map((l) => phrase(`ally-level-${l}`, "Niveaux", () => t("Niveau {l} atteint !", { l }))),
  ...ENEMY_LEVELS.map((l) => phrase(`enemy-level-${l}`, "Adversaires", () => t("L'équipe adverse atteint le niveau {l} !", { l }))),
  phrase("talent-disadvantage", "Adversaires", () => t("Désavantage de talent : évitez les combats !")),
  phrase("objective-soon", "Objectifs & camps", () => t("L'objectif arrive, regroupez-vous !")),
  ...CAMPS.map(([type, text]) => phrase(`camp-${type}`, "Objectifs & camps", text)),
  phrase("tip-talent-advantage", "Conseils", () => t("Avantage de talent : forcez l'objectif ou un combat !")),
  phrase("tip-stay-grouped", "Conseils", () => t("Restez groupés !")),
];

export const PHRASE_KEYS = new Set(VOICE_PHRASES.map((p) => p.key));
