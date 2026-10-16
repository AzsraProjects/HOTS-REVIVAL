"""Textes communs (réglages, conformité, messages de l'API). Clés = textes français exacts."""
EN: dict[str, str] = {
    "Présence du processus HeroesOfTheStorm dans la liste des programmes (jeu lancé / fermé), comme le fait Discord. Le processus n'est jamais ouvert ni lu.":
        'Whether the HeroesOfTheStorm process is in the list of running programs (game started / closed), as Discord does. The process is never opened or read.',
    'Fichiers .StormReplay terminés, écrits par le jeu dans Documents (analyse post-partie).':
        'Finished .StormReplay files written by the game in Documents (post-game analysis).',
    "Fichier replay.server.battlelobby écrit par le jeu au chargement : uniquement les informations affichées sur l'écran de chargement (joueurs, carte).":
        'replay.server.battlelobby file written by the game while loading: only the information shown on the loading screen (players, map).',
    "Saisies volontaires du joueur dans l'overlay (carte, synchronisation d'horloge, niveaux d'équipe affichés en haut de l'écran, camps observés).":
        'Information the player chooses to enter in the overlay (map, clock sync, team levels shown at the top of the screen, observed camps).',
    'Option désactivée par défaut : lecture locale (OCR) de trois zones publiques du HUD (horloge, niveau de chaque équipe), jamais la mini-carte ; aucune image conservée.':
        "Off by default: local reading (OCR) of three public HUD areas (clock, each team's level), never the minimap; no image is kept.",
    'Données publiques : timings de carte, profils de héros, catalogue des talents.':
        'Public data: map timings, hero profiles, talent catalog.',
    "Pages publiques d'Icy Veins (tier lists, guides : builds, synergies, contres), téléchargées hors partie et citées avec un lien vers la source.":
        'Public Icy Veins pages (tier lists, guides: builds, synergies, counters), downloaded outside of games and credited with a link to the source.',
    'Historique de replays du joueur et statistiques agrégées dérivées.':
        "The player's replay history and the aggregated statistics derived from it.",
    'Lecture ou écriture de la mémoire du processus HeroesOfTheStorm':
        'Reading or writing the HeroesOfTheStorm process memory',
    'Injection de DLL / hook DirectX / interception réseau': 'DLL injection / DirectX hooks / network interception',
    "Envoi d'entrées clavier/souris au jeu (macros, scripts, automatisation)":
        'Sending keyboard/mouse input to the game (macros, scripts, automation)',
    'Révélation du brouillard de guerre ou de positions ennemies invisibles':
        'Revealing the fog of war or hidden enemy positions',
    'Suivi des cooldowns ennemis non visibles': 'Tracking enemy cooldowns that are not visible',
    "Décodage des évènements de replay d'une partie en cours": 'Decoding the replay events of a game in progress',
    'Overlay passif : aucune lecture mémoire, aucune injection, aucune action automatique. Seules les informations publiques ou personnelles sont utilisées.':
        'Passive overlay: no memory reading, no injection, no automated actions. Only public or personal information is used.',
    'Conversation introuvable': 'Conversation not found',
    "Le coach IA n'est pas encore configuré : choisissez une IA et sa clé dans les paramètres. En attendant, consultez le rapport de partie et votre HEROS SCORE.":
        'The AI coach is not set up yet: choose an AI and its key in Settings. In the meantime, check the game report and your HEROS SCORE.',
    "La plateforme communautaire n'est pas encore en ligne.": 'The community platform is not online yet.',
    'Le profil public nécessite le partage des parties.': 'A public profile requires match sharing.',
    'Votre profil sera publié dès que vos premières parties auront été envoyées.':
        'Your profile will be published as soon as your first games have been uploaded.',
    'Partie introuvable': 'Game not found',
    "Aucun rapport : le joueur local n'a pas été identifié dans cette partie.":
        'No report: the local player was not identified in this game.',
    'Héros inconnu': 'Unknown hero',
    'Ligue inconnue': 'Unknown league',
    'Chemin introuvable : {path}': 'Path not found: {path}',
    'dossier de replays': 'replay folder',
    "Ce dossier n'existe pas.": 'This folder does not exist.',
    "Fournisseur d'IA inconnu.": 'Unknown AI provider.',
    'liste inconnue': 'unknown list',
    'tier list illisible ({n} héros reconnus)': 'unreadable tier list ({n} heroes recognized)',
    'héros inconnu': 'unknown hero',
    'guide illisible': 'unreadable guide',
    'type inconnu': 'unknown type',
    'Plateforme injoignable ({error})': 'Platform unreachable ({error})',
    'Erreur inattendue (voir le journal)': 'Unexpected error (see the log)',
    # meta/icyveins.py (titres des tier lists)
    'Générale (Bronze → Platine)': 'General (Bronze → Platinum)',
    'Master (Diamant → Grand Maître)': 'Master (Diamond → Grandmaster)',
    'Partie rapide': 'Quick Match',
}
