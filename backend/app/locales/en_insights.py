"""Avantages convertis (analytics/advantages.py), objectif suivi (analytics/goals.py), marque-pages
(bookmarks.py) et justifications du rapport (« Sur quoi tu te bases ? »)."""
EN: dict[str, str] = {
    # gains après un combat
    "Tour": "Tower",
    "Fort": "Fort",
    "Donjon": "Keep",
    "Cœur (fin de partie)": "Core (end of game)",
    "Bâtiment": "Structure",
    "Camp de siège": "Siege camp",
    "Camp de mercenaires": "Bruiser camp",
    "Boss": "Boss",
    "Camp de soutien": "Support camp",
    "Camp": "Camp",
    "Objectif de carte": "Map objective",
    # chronologie des avantages
    "Combat : morts espacées de moins de {gap} s. Avantage : l'adversaire perd au moins {n} héros de plus. Durée : jusqu'à ce que l'écart retombe sous {n} (réapparitions lues dans le replay). Conversion : tour, fort, donjon, cœur, camp ou objectif obtenu pendant cette durée (+{grace} s).":
        "Fight: deaths less than {gap} s apart. Advantage: the other team loses at least {n} more heroes. Duration: until the gap drops below {n} (respawns read from the replay). Conversion: tower, fort, keep, core, camp or objective taken during that time (+{grace} s).",
    "Votre équipe a pris l'avantage numérique {n} fois et l'a converti {k} fois.":
        "Your team got a numbers advantage {n} times and converted it {k} times.",
    "Votre équipe n'a jamais pris l'avantage numérique (au moins {n} adversaires de plus à terre).":
        "Your team never got a numbers advantage (at least {n} more enemies down).",
    "L'adversaire : {n} fois, converti {k} fois.": "The enemy: {n} times, converted {k} times.",
    "Combat gagné ({span}) : {kills} adversaires éliminés, {losses} perte(s) de votre côté.":
        "Fight won ({span}): {kills} enemies killed, {losses} loss(es) on your side.",
    "Combat gagné ({span}) : {kills} adversaires éliminés sans perte de votre côté.":
        "Fight won ({span}): {kills} enemies killed with no losses on your side.",
    "Avantage numérique pendant environ {s} s.": "Numbers advantage for about {s} s.",
    "Obtenu ensuite : {list}.": "Taken afterwards: {list}.",
    "Avantage converti.": "Advantage converted.",
    "Aucun bâtiment, camp ni objectif obtenu avant le retour des adversaires.":
        "No structure, camp or objective taken before the enemies came back.",
    "Avantage non converti : une opportunité à revoir, pas forcément une erreur.":
        "Advantage not converted: an opportunity to review, not necessarily a mistake.",
    "À revoir dans le replay à {clock} : une tour, un camp ou l'objectif étaient-ils accessibles en {s} s, avec la vie et le mana qui restaient ?":
        "Review the replay at {clock}: was a tower, a camp or the objective within reach in {s} s, with the health and mana you had left?",
    "Pendant ce temps, l'adversaire obtient : {list}.": "Meanwhile, the enemy takes: {list}.",
    "Combat perdu ({span}) : {lost} alliés éliminés, {taken} adversaire(s) de leur côté.":
        "Fight lost ({span}): {lost} allies killed, {taken} enemy(ies) on their side.",
    "Combat perdu ({span}) : {lost} alliés éliminés sans perte adverse.":
        "Fight lost ({span}): {lost} allies killed with no enemy losses.",
    "Infériorité numérique pendant environ {s} s.": "Outnumbered for about {s} s.",
    "L'adversaire obtient ensuite : {list}.": "The enemy then takes: {list}.",
    "Avantage adverse converti : c'est souvent là qu'une partie bascule.":
        "Enemy advantage converted: this is often where a game turns.",
    "À revoir dans le replay à {clock} : le combat était-il évitable, ou fallait-il reculer plus tôt pour limiter les pertes ?":
        "Review the replay at {clock}: could the fight have been avoided, or should the team have backed off earlier to limit losses?",
    "L'adversaire n'en a rien tiré : défense ou retraite réussie.":
        "The enemy got nothing out of it: successful defense or retreat.",
    "Pendant ce temps, votre équipe obtient : {list}.": "Meanwhile, your team takes: {list}.",
    "Positions des héros vivants, vie, mana et temps de recharge : absents du replay.":
        "Positions of living heroes, health, mana and cooldowns: not in the replay.",
    "Réapparition de certains héros estimée (absente du replay).": "Some respawns estimated (missing from the replay).",
    "Fenêtre très courte : peu de temps pour agir.": "Very short window: little time to act.",
    # objectif personnel
    "Mourir {n} fois au maximum.": "Die {n} times at most.",
    "Aucune mort isolée dans la partie.": "No isolated deaths in the game.",
    "Une mort isolée au maximum par partie.": "At most one isolated death per game.",
    "Pas plus de {n} morts isolées par partie.": "No more than {n} isolated deaths per game.",
    "Ne jamais mourir dans les 30 s qui précèdent un objectif.": "Never die in the 30 s before an objective.",
    "Au plus {n} mort(s) dans les 30 s qui précèdent un objectif.": "At most {n} death(s) in the 30 s before an objective.",
    "Participer à au moins {n} % des éliminations.": "Take part in at least {n}% of takedowns.",
    "Votre équipe prend au moins {n} camps par tranche de 10 minutes.":
        "Your team takes at least {n} camps every 10 minutes.",
    "Convertir au moins {n} % des avantages numériques de votre équipe.":
        "Convert at least {n}% of your team's numbers advantages.",
    "Jouez la survie : reculez dès que vous êtes ciblé.": "Play for survival: back off as soon as you are focused.",
    "Ne vous éloignez pas seul sans vision.": "Don't wander off alone without vision.",
    "Avant chaque objectif, restez en vie et groupé.": "Before each objective, stay alive and grouped.",
    "Restez à portée de votre équipe dans les combats.": "Stay within range of your team in fights.",
    "Pendant les temps morts, pensez aux camps.": "During downtime, think about camps.",
    "Combat gagné : prenez une tour, un camp ou l'objectif avant leur retour.":
        "Fight won: take a tower, a camp or the objective before they come back.",
    "Mort à {clock}.": "Death at {clock}.",
    "Mort isolée à {clock} : aucun autre héros mort à moins de 10 s.":
        "Isolated death at {clock}: no other hero died within 10 s.",
    "Heures des objectifs inconnues sur cette carte.": "Objective times unknown on this map.",
    "Mort à {clock}, {s} s avant l'objectif de {objective}.": "Death at {clock}, {s} s before the {objective} objective.",
    "Aucune élimination de votre équipe.": "No takedowns by your team.",
    "Élimination sans vous à {clock}.": "Takedown without you at {clock}.",
    "Partie trop courte.": "Game too short.",
    "Camp pris à {clock}.": "Camp taken at {clock}.",
    "Aucun avantage numérique dans cette partie.": "No numbers advantage in this game.",
    "Avantage non converti à {clock}.": "Advantage not converted at {clock}.",
    "{n} morts isolées dans cette partie.": "{n} isolated deaths in this game.",
    "{n} mort(s) juste avant un objectif.": "{n} death(s) right before an objective.",
    "{n} morts dans cette partie.": "{n} deaths in this game.",
    "{pct} % des avantages numériques convertis.": "{pct}% of numbers advantages converted.",
    "Participation aux éliminations : {pct} %.": "Takedown participation: {pct}%.",
    "Catégorie macro la plus faible du HEROS SCORE.": "Macro is your weakest HEROS SCORE category.",
    "Échantillon trop faible pour conclure : {n} partie(s) mesurée(s), il en faut au moins {min}.":
        "Sample too small to conclude: {n} game(s) measured, at least {min} needed.",
    "Tendance observée sur vos parties, pas une preuve de progression : le héros, la carte et les adversaires changent d'une partie à l'autre.":
        "Trend observed over your games, not proof of progress: hero, map and opponents change from one game to the next.",
    "Marque-page introuvable": "Bookmark not found",
    # justifications du rapport
    "Règle : participation aux éliminations d'au moins 70 % (vous : {pct} %).":
        "Rule: takedown participation of at least 70% (you: {pct}%).",
    "Règle : assassin avec au moins 28 % des dégâts de l'équipe (vous : {pct} %).":
        "Rule: assassin with at least 28% of the team's hero damage (you: {pct}%).",
    "Règle : soigneur avec au moins 60 % des soins de l'équipe.": "Rule: healer with at least 60% of the team's healing.",
    "Règle : tank ou combattant qui encaisse au moins 30 % des dégâts de l'équipe.":
        "Rule: tank or bruiser soaking at least 30% of the team's damage taken.",
    "Règle : 2 morts ou moins (vous : {n}).": "Rule: 2 deaths or fewer (you: {n}).",
    "Règle : au moins 25 % de l'expérience de l'équipe (vous : {pct} %).":
        "Rule: at least 25% of the team's experience (you: {pct}%).",
    "Règle : 5 morts ou plus. Heures des morts : {list}.": "Rule: 5 deaths or more. Death times: {list}.",
    "Règle : au moins 90 s passées mort (écran des scores du replay).":
        "Rule: at least 90 s spent dead (replay score screen).",
    "Règle : soigneur avec moins de 40 % des soins de l'équipe.": "Rule: healer with less than 40% of the team's healing.",
    "Règle : catégorie macro du HEROS SCORE sous 45/100 (vous : {v}/100).":
        "Rule: HEROS SCORE macro category below 45/100 (you: {v}/100).",
    "Règle : une des deux meilleures catégories du HEROS SCORE, à 75/100 ou plus.":
        "Rule: one of your two best HEROS SCORE categories, at 75/100 or more.",
    "Votre catégorie la plus faible du HEROS SCORE : {cat} ({v}/100).": "Your weakest HEROS SCORE category: {cat} ({v}/100).",
    # marque-pages
    "allié": "allied",
    "adversaire": "enemy",
    "Mort de {hero} ({side}).": "{hero} dies ({side}).",
    "Bâtiment détruit par l'équipe {side}.": "Structure destroyed by the {side} team.",
    "Camp pris par l'équipe {side}.": "Camp taken by the {side} team.",
    "Objectif de carte : équipe {side}.": "Map objective: {side} team.",
    # en jeu
    "Votre objectif : {label}": "Your goal: {label}",
    "Moment marqué. Horloge non synchronisée : l'heure sera déduite du replay.":
        "Moment bookmarked. Clock not synced: the time will be worked out from the replay.",
    "Moment marqué à {clock}.": "Moment bookmarked at {clock}.",
    "Lecture de l'écran perdue : alertes de niveau suspendues.": "Screen reading lost: level alerts paused.",
}
