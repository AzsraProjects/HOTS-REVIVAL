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
    version: "1.1.0",
    date: "2026-10-28",
    fr: [
      "Nouveau dans le rapport : « Avantages convertis ou perdus ». Chaque combat gagné ou perdu, ce que l'équipe en a tiré (tour, fort, camp, objectif) avant le retour des adversaires, avec les morts et réapparitions lues dans le replay. Un avantage non converti est présenté comme une opportunité à revoir, jamais comme une faute.",
      "« Sur quoi tu te bases ? » : chaque point fort, point faible et conseil du plan affiche la règle et les chiffres qui l'ont produit.",
      "Mon objectif : choisissez un seul chantier après un débrief (morts isolées, morts avant un objectif, conversion des avantages…). Il est rappelé au chargement de chaque partie, mesuré à chaque rapport et suivi sur le tableau de bord, en signalant quand l'échantillon est trop faible pour conclure.",
      "Marque-pages : Ctrl+Maj+B pendant une partie marque un moment à revoir. Après la partie, retrouvez son heure dans le rapport, ajoutez une note et comparez-la à ce que le replay montre autour.",
      "Guide vocal plus sobre : Ctrl+Maj+M coupe immédiatement la voix (et la rétablit), un conseil par minute au plus, plus de répétitions, et une annonce trop en retard n'est plus dite. Si la lecture de l'écran est perdue, l'overlay le signale et les alertes de niveau se taisent au lieu de se fier à des niveaux périmés.",
      "Les replays sont mieux lus (équipe des bâtiments détruits, vraies heures de réapparition) : votre historique est réanalysé une fois au premier lancement, vos analyses IA sont conservées.",
    ],
    en: [
      "New in the report: “Advantages converted or lost”. Every fight won or lost, and what the team got out of it (tower, fort, camp, objective) before the enemies came back, with deaths and respawns read from the replay. An unconverted advantage is shown as an opportunity to review, never as a mistake.",
      "“What is this based on?”: every strength, weakness and improvement tip shows the rule and the numbers behind it.",
      "My goal: pick a single focus after a debrief (isolated deaths, deaths before an objective, converting advantages…). It is shown on every loading screen, measured in every report and tracked on the dashboard, with a warning when the sample is too small to conclude.",
      "Bookmarks: press Ctrl+Shift+B during a game to mark a moment to review. After the game, find its time in the report, add a note and compare it with what the replay shows around it.",
      "Calmer voice guide: Ctrl+Shift+M mutes the voice instantly (and turns it back on), at most one tip per minute, no more repeats, and a call that comes too late is dropped. If screen reading is lost, the overlay says so and level alerts go quiet instead of trusting outdated levels.",
      "Replays are read more accurately (team of destroyed structures, real respawn times): your history is re-analyzed once on first launch, and your AI analyses are kept.",
    ],
  },
  {
    version: "1.0.10",
    date: "2026-10-18",
    fr: ["Le bouton « ♥ Soutenir le projet » passe en haut du menu, sous le logo : le serveur de la plateforme communautaire est payé par la communauté, un café aide à le garder en ligne."],
    en: ["The “♥ Support the project” button moves to the top of the menu, under the logo: the community platform server is paid for by the community, a coffee helps keep it online."],
  },
  {
    version: "1.0.9",
    date: "2026-10-16",
    fr: [
      "Nouveau lien « ♥ Soutenir le projet » en bas du menu : le serveur de la plateforme communautaire est payé par la communauté, un café aide à le garder en ligne.",
      "Statistiques communautaires : votre historique est partagé petit à petit (200 parties par jour au plus, les plus récentes d'abord) et les statistiques du site sont recalculées une fois par jour.",
    ],
    en: [
      "New “♥ Support the project” link at the bottom of the menu: the community platform server is paid for by the community, a coffee helps keep it online.",
      "Community stats: your history is shared gradually (at most 200 games a day, most recent first) and the website stats are recomputed once a day.",
    ],
  },
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
