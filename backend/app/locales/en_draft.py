"""Draft Assistant (app/draft/engine.py)."""
EN: dict[str, str] = {
    # combos connus (noms de capacités : noms officiels anglais)
    "Mosh Pit d'E.T.C. + zone de Jaina : combo d'élimination de groupe.":
        "E.T.C.'s Mosh Pit + Jaina's area damage: a team-wipe combo.",
    "Mosh Pit d'E.T.C. + Pyroblast/Flamestrike : burst de zone garanti.":
        "E.T.C.'s Mosh Pit + Pyroblast/Flamestrike: guaranteed area burst.",
    "Mosh Pit d'E.T.C. + combo de Li-Ming : dégâts massifs sur cibles immobilisées.":
        "E.T.C.'s Mosh Pit + Li-Ming's combo: massive damage on locked-down targets.",
    "Double ralentissement givre : très difficile à fuir.": "Double frost slow: very hard to escape.",
    "Marque du chasseur + dégâts soutenus : focus des tanks.": "Hunter's Mark + sustained damage: melts tanks.",
    "Symbiote et clone sur Illidan : plongée quasi immortelle.":
        "Symbiote and Ultimate Evolution on Illidan: a near-unkillable dive.",
    "Tracer avec Abathur : pression de plongée renforcée.": "Tracer with Abathur: boosted dive pressure.",
    "Déplacements forcés + chaînes de Kel'Thuzad : prises garanties.":
        "Displacement + Chains of Kel'Thuzad: guaranteed picks.",
    # forces / faiblesses
    "Votre composition gagne les combats courts : engagez sur une cible isolée.":
        "Your composition wins short fights: engage on an isolated target.",
    "Votre composition gagne les combats longs : évitez les échanges explosifs.":
        "Your composition wins long fights: avoid burst trades.",
    "Bon potentiel de harcèlement avant les objectifs.": "Good poke potential before objectives.",
    "Excellent clear de vagues : vous pouvez tenir la carte et faire des rotations.":
        "Excellent waveclear: you can hold the map and rotate.",
    "Présence globale : punissez les joueurs isolés sur les autres lignes.":
        "Global presence: punish isolated players in other lanes.",
    "Pas de tank : difficile d'initier et d'absorber l'engagement adverse.":
        "No tank: hard to initiate and to absorb the enemy engage.",
    "Pas de soigneur : privilégiez les combats courts et les fontaines.":
        "No healer: favor short fights and use the Healing Fountains.",
    "Peu de clear de vagues : risque de perdre la pression sur les lignes.":
        "Little waveclear: you risk losing lane pressure.",
    "Peu de contrôle : difficile de verrouiller une cible.": "Little crowd control: hard to lock down a target.",
    # conditions de victoire / menaces
    "Protégez {hero} : l'adversaire dispose d'outils de plongée.": "Protect {hero}: the enemy has dive tools.",
    "Attention au combo {a} + {b}.": "Watch out for the {a} + {b} combo.",
    "Bonne synergie {a} + {b} (Icy Veins).": "Good {a} + {b} synergy (Icy Veins).",
    "{hero} est contré par {enemy} : jouez prudemment.": "{hero} is countered by {enemy}: play carefully.",
    "L'équipe adverse plonge : restez groupés autour de vos héros fragiles.":
        "The enemy team dives: stay grouped around your squishy heroes.",
    "Fort harcèlement adverse : n'entamez pas l'objectif à mi-vie.":
        "Heavy enemy poke: don't start the objective at half health.",
    "{hero} est efficace contre cette composition adverse.": "{hero} is effective against this enemy composition.",
    "début de partie": "early game",
    "milieu de partie": "mid game",
    "fin de partie": "late game",
    "Votre fenêtre de puissance : {phase}. Jouez les objectifs à ce moment.":
        "Your power spike: {phase}. Play the objectives at that point.",
    "L'adversaire scale mieux : terminez la partie avant le niveau 20.":
        "The enemy scales better: end the game before level 20.",
    "{hero} est le meilleur choix contre cette draft.": "{hero} is the best pick against this draft.",
}
