"""Données de jeu traduites (app/data/maps.json : objectifs et conseils de carte).

Les noms de cartes, de héros et de talents ne sont jamais traduits (données du jeu).
Clé = texte français exact du JSON.
"""
EN: dict[str, str] = {
    # Alterac Pass
    'Prisonniers / Cavalerie': 'Prisoners / Cavalry',
    "Les campements de prisonniers s'ouvrent au même moment : préparez la vision et la composition du groupe 20 s avant.":
        'The prison camps open at the same time: set up vision and your group composition 20 s before.',
    'Tuer un ennemi interrompt la capture : ne capturez pas en infériorité numérique.':
        "Killing an enemy interrupts the capture: don't capture while outnumbered.",
    # Battlefield of Eternity
    'Immortels': 'Immortals',
    "La course aux dégâts sur l'Immortel favorise les compositions à dégâts soutenus.":
        'The damage race on the Immortal favors sustained-damage compositions.',
    "Défendre l'Immortel adverse rapporte souvent plus que de forcer le combat.":
        'Defending against the enemy Immortal often pays off more than forcing a fight.',
    # Blackheart's Bay
    'Doublons': 'Doubloons',
    'Ne mourez pas avec des doublons : livrez-les avant de jouer un combat incertain.':
        "Don't die holding doubloons: turn them in before taking an uncertain fight.",
    'Le coffre et les camps doublons sont des priorités de rotation.':
        'The chest and the doubloon camps are rotation priorities.',
    # Braxis Holdout
    'Balises / Zergs': 'Beacons / Zerg',
    "Une capture à 100 % sur une seule balise vaut mieux qu'un combat perdu au centre.":
        'A 100% capture on a single beacon is better than a lost fight in the middle.',
    'Préparez la défense de la vague zerg avec le clear de vagues.':
        'Prepare to defend against the Zerg wave with waveclear.',
    # Cursed Hollow
    'Tributs': 'Tributes',
    "Les tributs apparaissent par paire de positions possibles : positionnez-vous avant l'annonce.":
        'Tributes spawn in one of a pair of possible locations: get in position before the announcement.',
    'Au 2e tribut adverse, la priorité devient le contrôle de la carte.':
        'Once the enemy has 2 tributes, map control becomes the priority.',
    # Dragon Shire
    'Sanctuaires / Chevalier-dragon': 'Shrines / Dragon Knight',
    'Tenir les deux sanctuaires demande deux joueurs solides en duel.':
        'Holding both shrines takes two players who can win their duels.',
    'Le chevalier-dragon se contre en groupe : ne le laissez pas pousser seul.':
        "Fight the Dragon Knight as a group: don't let it push alone.",
    # Garden of Terror
    'Graines / Horreur': 'Seeds / Garden Terror',
    'La nuit, les camps de jardin donnent les graines : groupez-vous.':
        'At night, the garden camps drop seeds: group up.',
    "L'horreur doit cibler les forts déjà endommagés.":
        'The Garden Terror should target forts that are already damaged.',
    # Hanamura Temple
    'Convois': 'Payloads',
    "Pousser votre convoi ou bloquer l'adverse : choisissez un seul plan.":
        "Push your payload or block the enemy's: commit to a single plan.",
    'Les camps de soutien sont précieux pour la pression sur les structures.':
        'Support camps are valuable for pressuring structures.',
    # Infernal Shrines
    'Sanctuaires / Punisseur': 'Shrines / Punisher',
    'Le clear des gardiens est décisif : les compositions à zone gagnent la course.':
        'Clearing the guardians is decisive: area-damage compositions win the race.',
    'Utilisez un camp siège juste avant le sanctuaire pour mettre la pression.':
        'Use a siege camp right before the shrine to apply pressure.',
    # Sky Temple
    'Temples': 'Temples',
    "Contrôler le temple central rapporte le plus lorsque l'équipe est complète.":
        'Controlling the middle temple pays off most when your whole team is there.',
    'Les gardiens de temple frappent fort : ne tankez pas sans soutien.':
        "Temple guardians hit hard: don't tank them without support.",
    # Tomb of the Spider Queen
    'Gemmes / Tisseuses': 'Gems / Webweavers',
    'Ne mourez pas avec des gemmes : rendez-les avant les combats.':
        "Don't die holding gems: turn them in before fights.",
    'Les tisseuses font plus de dégâts quand une vague de sbires les accompagne.':
        'Webweavers deal more damage when a minion wave is with them.',
    # Towers of Doom
    'Autels': 'Altars',
    "Les autels ne se capturent qu'avec de la présence : rotation complète d'équipe.":
        'Altars can only be captured with presence: rotate as a full team.',
    'Le boss et le camp siège pèsent lourd sur cette carte : ne négligez pas les camps.':
        "The Boss and the siege camp carry a lot of weight on this map: don't neglect the camps.",
    # Volskaya Foundry
    'Protecteur Triglav': 'Triglav Protector',
    'La capture se gagne au contrôle de zone : privilégiez CC et sustain.':
        'The capture is won through zone control: favor CC and sustain.',
    'Le second pilote (canon) est souvent le plus impactant.':
        'The second pilot (cannon) is often the most impactful.',
    # Warhead Junction
    'Ogives nucléaires': 'Nukes',
    'Les ogives se gagnent aux rotations : pensez vision et mobilité.':
        'Nukes are won through rotations: think vision and mobility.',
    'Une ogive se lance sur une cible immobile ou contrôlée.':
        'Launch a nuke on a stationary or crowd-controlled target.',
    # Haunted Mines
    'Mines / Golems': 'Mines / Golems',
    "Les mines s'ouvrent pour les deux équipes : y entrer à 5 évite de donner les crânes gratuitement.":
        'The mines open for both teams: entering as 5 avoids giving away skulls for free.',
    'Le golem pousse longtemps : défendez-le ou contrez-le en groupe.':
        'The golem pushes for a long time: defend it or counter it as a group.',
}
