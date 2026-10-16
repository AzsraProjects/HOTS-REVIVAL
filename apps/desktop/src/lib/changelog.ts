// Notes de mise à jour affichées au premier lancement après une mise à jour (WhatsNew.tsx).
// Ajouter une entrée en tête à chaque version publiée (tag vX.Y.Z), rédigée pour les joueurs.

export interface ChangelogEntry {
  version: string;
  date: string; // AAAA-MM-JJ
  fr: string[];
  en: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.8",
    date: "2026-10-16",
    fr: ["Guide vocal : si votre PC n'arrive pas à lire une voix HOTS REVIVAL (Mega Chad, Insupp…), la voix Windows prend le relais au lieu du silence, et « Tester la voix » affiche la cause du problème."],
    en: ["Voice guide: if your PC cannot play a HOTS REVIVAL voice (Mega Chad, Insupp…), the Windows voice takes over instead of silence, and “Test the voice” shows what went wrong."],
  },
  {
    version: "1.0.7",
    date: "2026-10-16",
    fr: ["Guide vocal plus calme en infériorité de talent : une seule annonce « Désavantage de talent : évitez les combats ! » au lieu de trois phrases à la suite."],
    en: ["Calmer voice guide when behind in talents: a single “Talent disadvantage: avoid fights!” call instead of three lines in a row."],
  },
  {
    version: "1.0.6",
    date: "2026-10-16",
    fr: [
      "Paramètres réorganisés en onglets : Compte & replays, Guide vocal, Mode partie & overlay, Coach IA, Communauté, Application.",
      "Un seul menu « Voix » pour le guide vocal : voix HOTS REVIVAL (Mega Chad, Insupp), vos voix enregistrées et voix Windows, au même endroit.",
    ],
    en: [
      "Settings reorganized into tabs: Account & replays, Voice guide, Game mode & overlay, AI coach, Community, App.",
      "A single “Voice” menu for the voice guide: HOTS REVIVAL voices (Mega Chad, Insupp), your recorded voices and Windows voices, all in one place.",
    ],
  },
  {
    version: "1.0.5",
    date: "2026-10-16",
    fr: ["Nouvelle voix officielle pour le guide vocal : « Insupp ». À écouter et choisir dans les réglages des profils de voix."],
    en: ["New official voice for the voice guide: “Insupp”. Listen to it and pick it in the voice profile settings."],
  },
  {
    version: "1.0.4",
    date: "2026-10-16",
    fr: ["Nouvelle voix officielle pour le guide vocal : « Mega Chad ». Écoutez-la dans les réglages des profils de voix, puis choisissez-la comme voix du guide. D'autres voix arrivent."],
    en: ["New official voice for the voice guide: “Mega Chad”. Listen to it in the voice profile settings, then pick it as the guide voice. More voices are coming."],
  },
  {
    version: "1.0.3",
    date: "2026-10-16",
    fr: ["Nouveau : ces notes de mise à jour s'affichent après chaque mise à jour, et restent consultables depuis le bas du menu."],
    en: ["New: these patch notes show up after each update, and stay available from the bottom of the menu."],
  },
  {
    version: "1.0.2",
    date: "2026-10-16",
    fr: [
      "Les mises à jour ne vident plus votre historique : quand l'analyse s'améliore, vos parties sont mises à jour une à une en arrière-plan, sans tout réimporter. Vos liens et conversations avec le coach sont conservés.",
      "Démarrage plus rapide : les replays déjà importés ne sont plus relus à chaque lancement.",
      "Timers d'objectif de la communauté : sur une carte où vous avez peu de parties, l'overlay s'appuie sur les horaires mesurés par l'ensemble des joueurs.",
      "Statistiques communautaires : le partage de vos parties est désormais activé par défaut. Un bandeau vous prévient avant tout envoi, et un clic suffit pour le désactiver (Paramètres → Communauté). Jamais de replay, de chat ni de pseudo ; le profil public reste désactivé tant que vous ne l'activez pas.",
    ],
    en: [
      "Updates no longer wipe your history: when the analysis improves, your matches are updated one by one in the background, without a full re-import. Your links and coach conversations are kept.",
      "Faster startup: replays already imported are no longer re-read at every launch.",
      "Community objective timers: on a map where you have few games, the overlay relies on timings measured across all players.",
      "Community stats: sharing your matches is now on by default. A banner tells you before anything is sent, and one click turns it off (Settings → Community). Never the replay, the chat or player names; your public profile stays off until you turn it on.",
    ],
  },
];

/** Compare deux versions "1.2.3" : négatif si a < b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
