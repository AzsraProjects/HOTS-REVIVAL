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
    version: "1.2.3",
    date: "2026-10-30",
    fr: [
      "Les mises à jour automatiques fonctionnent à nouveau : depuis la 1.1.0, l'application ne trouvait plus les nouvelles versions et il fallait les télécharger sur GitHub. Les prochaines s'installeront depuis le bandeau « Nouvelle version disponible ».",
      "Si la recherche de mise à jour échoue, le menu l'indique au lieu de ne rien afficher.",
    ],
    en: [
      "Automatic updates work again: since 1.1.0, the app could no longer find new versions and they had to be downloaded from GitHub. The next ones will install from the “New version available” banner.",
      "If checking for updates fails, the menu says so instead of showing nothing.",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-10-30",
    fr: [
      "Talents à jour au patch 2.57 : ceux de Xal'atath et des héros retouchés depuis 2023 (Sylvanas, Tyrande, Arthas, Abathur…) ont enfin leur vrai nom. Les talents retirés du jeu gardent leur nom dans vos anciennes parties.",
      "Les replays d'un jeu en français sont mieux lus : Aile de mort, Balafré, Bourbie, Chacal, Kramer, EDN-OS et d'autres étaient parfois enregistrés comme un héros inconnu. Votre historique est réanalysé une fois au premier lancement pour corriger ces parties, vos analyses IA sont conservées.",
      "L'écran de chargement reconnaît les noms français officiels des 31 héros dont le nom diffère de l'anglais.",
    ],
    en: [
      "Talents updated to patch 2.57: Xal'atath's talents and those of heroes reworked since 2023 (Sylvanas, Tyrande, Arthas, Abathur…) finally show their real names. Talents removed from the game keep their name in your older games.",
      "Replays from a French game client are read better: Deathwing, Stitches, Murky, Junkrat, Blaze, Probius and others were sometimes saved as an unknown hero. Your history is re-analyzed once on first launch to fix these games, and your AI analyses are kept.",
      "The loading screen recognizes the official French names of the 31 heroes whose name differs from English.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-30",
    fr: [
      "« Héros à éviter » devient « Héros à retravailler ». Il ne liste plus seulement vos plus faibles HEROS SCORE : un héros sur lequel votre note est bonne mais qui perd souvent y apparaît aussi, avec un bouton « Pourquoi ? ».",
      "« Pourquoi ? » compare vos défaites sur ce héros à vos victoires : ce qui change dans votre jeu (morts, participation, combats d'équipe, camps, conversion des avantages…), si vos défaites sont plutôt courtes ou longues, les cartes où il vous réussit moins et les compositions qui reviennent dans vos défaites (sans soigneur, sans tank, plongée ou frontline adverse). Jamais « ne le jouez plus » : de quoi travailler.",
      "Objectifs par héros : chaque écart du diagnostic peut devenir votre objectif sur ce héros (« Avec Cho : … »). Il n'est mesuré que sur les parties jouées avec lui ; une partie sur un autre héros n'est pas comptée comme ratée.",
      "Sans objectif en cours, le tableau de bord en propose d'après vos 10 dernières parties : les erreurs qui reviennent souvent et le héros à retravailler en priorité.",
      "La tendance du tableau de bord affiche vos victoires sur les 10 dernières parties et les 10 d'avant.",
      "Le coach IA explique pourquoi vous perdez sur un héros au lieu de conseiller de ne plus le jouer.",
      "Compositions lues sur l'écran de chargement plus fiables : chaque pseudo est associé au bon héros, une lecture ratée est corrigée par les suivantes, jamais deux fois le même héros dans une équipe, et un joueur dont le héros n'est pas encore lu reste affiché.",
    ],
    en: [
      "“Heroes to avoid” becomes “Heroes to work on”. It no longer lists only your weakest HEROS SCORE: a hero you score well on but often lose with shows up too, with a “Why?” button.",
      "“Why?” compares your losses on that hero with your wins: what changes in your play (deaths, participation, teamfights, camps, converting advantages…), whether your losses tend to be short or long, the maps where it works less well for you and the compositions that keep coming back in your losses (no healer, no tank, enemy dive or frontline). Never “stop playing it”: things to work on.",
      "Hero goals: every gap in the diagnosis can become your goal on that hero (“With Cho: …”). It is only measured on games played with that hero; a game on another hero does not count as missed.",
      "With no active goal, the dashboard suggests some based on your last 10 games: the mistakes that keep coming back and the hero to work on first.",
      "The dashboard trend shows your wins over the last 10 games and the 10 before.",
      "The AI coach explains why you lose on a hero instead of advising you to stop playing it.",
      "More reliable compositions from the loading screen: each name is matched to the right hero, a bad read is corrected by the next ones, never the same hero twice in a team, and a player whose hero has not been read yet stays listed.",
    ],
  },
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
