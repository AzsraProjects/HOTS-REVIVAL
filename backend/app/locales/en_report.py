"""Post Game Report (app/analytics/report.py)."""
EN: dict[str, str] = {
    # catégories du HEROS SCORE
    "placement": "positioning",
    "macro": "macro",
    "teamfight": "teamfight",
    "objectifs": "objectives",
    "survie": "survival",
    "draft": "draft",
    # moments clés
    "Votre équipe perd {n} héros en un combat.": "Your team loses {n} heroes in a single fight.",
    "L'équipe adverse perd {n} héros en un combat.": "The enemy team loses {n} heroes in a single fight.",
    "Votre équipe atteint le niveau {lvl}.": "Your team reaches level {lvl}.",
    "L'équipe adverse atteint le niveau {lvl}.": "The enemy team reaches level {lvl}.",
    # points forts
    "Participation élevée aux éliminations.": "High takedown participation.",
    "Bons dégâts sur les héros adverses.": "Good damage on enemy heroes.",
    "Vous assurez {pct} % des soins de l'équipe.": "You provide {pct}% of your team's healing.",
    "Vous encaissez {pct} % des dégâts de l'équipe : bon rôle de ligne de front.":
        "You soak {pct}% of your team's damage taken: solid frontline work.",
    "Excellente survie.": "Excellent survival.",
    "Très bonne contribution à l'expérience de l'équipe.": "Very good contribution to your team's experience.",
    "Catégorie {cat} solide ({v}/100).": "Solid {cat} category ({v}/100).",
    # points faibles
    "{n} morts.": "{n} deaths.",
    "Temps passé mort : {s} secondes.": "Time spent dead: {s} seconds.",
    "Seulement {pct} % des soins de l'équipe : restez à portée de vos alliés.":
        "Only {pct}% of your team's healing: stay within range of your allies.",
    "Faible contribution macro (XP, siège, camps).": "Low macro contribution (XP, siege, camps).",
    # plan d'amélioration
    "Réduire vos morts à {n} maximum.": "Keep your deaths to {n} at most.",
    "Prendre au moins 2 camps par tranche de 10 minutes et soaker les vagues inactives.":
        "Take at least 2 mercenary camps every 10 minutes and soak idle minion waves.",
    "Rester à portée de votre équipe avant chaque objectif pour viser 70 % de participation.":
        "Stay within range of your team before each objective to reach 70% participation.",
    "Éviter les morts en infériorité numérique : ne pas avancer sans vision ni alliés.":
        "Avoid dying while outnumbered: don't push forward without vision or allies.",
    "Être présent 20 s avant chaque objectif plutôt que d'arriver pendant le combat.":
        "Be in position 20 s before each objective instead of arriving mid-fight.",
    # titre du rapport
    "Partie gagnée à {clock} sur {map}.": "Game won at {clock} on {map}.",
    "Partie perdue à {clock} sur {map}.": "Game lost at {clock} on {map}.",
    "Vous avez participé à {pct} % des éliminations.": "You took part in {pct}% of takedowns.",
    "Votre principal axe de progression : {cat}.": "Your main area for improvement: {cat}.",
}
