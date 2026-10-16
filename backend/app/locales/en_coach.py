"""Coach IA (app/coach/ : rôles, résumé sans IA, messages d'erreur). Clés = textes français exacts."""
EN: dict[str, str] = {
    'Soigneur': 'Healer',
    "part des soins de l'équipe": 'share of team healing',
    'morts et temps mort': 'deaths and time dead',
    'participation aux éliminations': 'takedown participation',
    'protection / purges': 'protection / cleanses',
    "Une faible part de dégâts (2 à 8 %) est normale : le soigneur se juge sur ses soins (viser 40 à 75 % des soins de l'équipe) et sur sa survie.":
        "A low damage share (2 to 8%) is normal: a healer is judged on healing (aim for 40 to 75% of the team's healing) and on survival.",
    'Se placer derrière la ligne de front, à portée de soin mais hors de portée des engagements adverses.':
        'Stand behind the frontline, within healing range but out of range of enemy engages.',
    "Garder le soin principal / l'immunité pour les engagements adverses plutôt que de le dépenser sur du harcèlement.":
        'Save your main heal / immunity for enemy engages rather than spending it on poke.',
    "Surveiller les cooldowns d'engagement adverses visibles (ultimes lancés) avant d'avancer.":
        'Track the visible enemy engage cooldowns (Heroic abilities used) before stepping forward.',
    'Ne jamais vérifier un buisson seul : laisser le tank ou le combattant ouvrir le passage.':
        'Never facecheck a bush alone: let the tank or bruiser lead the way.',
    "Gérer son mana entre les combats : rentrer à la fontaine plutôt que d'arriver vide à l'objectif.":
        'Manage your mana between fights: go back to base rather than arriving empty at the objective.',
    'Tank': 'Tank',
    'dégâts encaissés': 'damage taken',
    'temps de contrôle sur les héros adverses': 'crowd control time on enemy heroes',
    'participation': 'participation',
    'morts': 'deaths',
    "Les dégâts aux héros sont secondaires ; on attend 15 à 35 % des dégâts encaissés de l'équipe et beaucoup de contrôles.":
        "Hero damage is secondary; expect 15 to 35% of the team's damage taken and a lot of crowd control.",
    "Engager quand l'équipe est à portée et que l'adversaire a utilisé ses outils de fuite.":
        'Engage when your team is in range and the enemy has used their escape tools.',
    'Se placer devant les objectifs 15 à 20 s avant leur apparition pour prendre la zone.':
        'Get in front of objectives 15 to 20 s before they spawn to claim the area.',
    "Protéger les héros fragiles quand l'adversaire plonge plutôt que de poursuivre.":
        'Peel for your squishy heroes when the enemy dives instead of chasing.',
    "Utiliser la vision (tours de guet, buissons) pour l'équipe.": 'Provide vision for the team (watchtowers, bushes).',
    'Combattant': 'Bruiser',
    'XP et dégâts de siège': 'XP and siege damage',
    'camps de mercenaires': 'mercenary camps',
    'survie en ligne solo': 'survival in the solo lane',
    'présence aux objectifs': 'presence at objectives',
    "Un combattant porte la macro : forte part d'XP et de siège, plusieurs camps par tranche de 10 minutes.":
        'A bruiser carries the macro game: a high share of XP and siege damage, several camps every 10 minutes.',
    "Tenir la ligne solo sans mourir : reculer dès que l'adversaire disparaît de la mini-carte.":
        'Hold the solo lane without dying: back off as soon as your opponent disappears from the minimap.',
    "Prendre les camps de siège quand la ligne est poussée et que l'objectif est loin.":
        'Take siege camps when the lane is pushed and the objective is far away.',
    "Rejoindre l'équipe avant l'objectif plutôt que d'arriver pendant le combat.":
        'Join your team before the objective instead of arriving mid-fight.',
    'Assassin à distance': 'Ranged Assassin',
    'part des dégâts aux héros': 'share of hero damage',
    'dégâts de siège': 'siege damage',
    "On attend 15 à 30 % des dégâts aux héros de l'équipe avec peu de morts : chaque mort coupe la source de dégâts.":
        "Expect 15 to 30% of the team's hero damage with few deaths: every death cuts off a damage source.",
    'Rester à portée maximale et viser la cible la plus proche atteignable, pas la plus fragile hors de portée.':
        'Stay at max range and hit the closest reachable target, not the squishiest one out of reach.',
    'Garder un outil de fuite pour les plongées adverses.': 'Keep an escape tool for enemy dives.',
    'Ne pas avancer sans vision sur les flancs.': "Don't push forward without vision on the flanks.",
    'Assassin de mêlée': 'Melee Assassin',
    'éliminations des cibles fragiles': 'takedowns on squishy targets',
    'timing des plongées': 'dive timing',
    "Les morts sont plus fréquentes qu'en distance, mais chaque plongée doit rapporter une élimination.":
        'Deaths are more common than for ranged heroes, but every dive must earn a takedown.',
    "Plonger après l'engagement du tank ou quand le soigneur adverse a utilisé ses cooldowns.":
        'Dive after the tank engages or when the enemy healer has used their cooldowns.',
    'Cibler les héros isolés pendant les rotations plutôt que la ligne de front.':
        'Target isolated heroes during rotations rather than the frontline.',
    'Sortir du combat dès que la cible a utilisé son immunité.':
        'Leave the fight as soon as your target has used their immunity.',
    'Soutien': 'Support',
    'présence globale / macro': 'global presence / macro',
    'protection apportée': 'protection provided',
    'XP': 'XP',
    'survie': 'survival',
    "Le soutien se juge sur l'utilité (boucliers, macro) plus que sur les dégâts.":
        'A support is judged on utility (shields, macro) more than on damage.',
    "Synchroniser ses capacités globales avec les engagements de l'équipe.":
        "Sync your global abilities with your team's engages.",
    'Maintenir la pression sur les lignes inactives entre les objectifs.':
        'Keep pressure on idle lanes between objectives.',
    "ANTHROPIC_API_KEY n'est pas configurée.": 'ANTHROPIC_API_KEY is not configured.',
    'Limite de requêtes atteinte, réessayez dans un instant.': 'Rate limit reached, please try again in a moment.',
    "Erreur de l'API Claude ({code}).": 'Claude API error ({code}).',
    "Impossible de joindre l'API Claude.": 'Unable to reach the Claude API.',
    "Le coach n'a pas pu répondre à cette demande. Reformulez votre question.":
        'The coach could not answer this request. Please rephrase your question.',
    'réponse tronquée': 'truncated answer',
    'Mort à {clock}': 'Death at {clock}',
    'Données du joueur (JSON) :': 'Player data (JSON):',
    'Claude (Anthropic)': 'Claude (Anthropic)',
    'Gemini (Google)': 'Gemini (Google)',
    'ChatGPT (OpenAI)': 'ChatGPT (OpenAI)',
    'Mistral': 'Mistral',
    'OpenRouter (tous les modèles)': 'OpenRouter (all models)',
    'Ollama (local, gratuit)': 'Ollama (local, free)',
    'Autre (compatible OpenAI)': 'Other (OpenAI-compatible)',
    "Adresse de l'API manquante : renseignez-la dans Paramètres.": 'Missing API URL: enter it in Settings.',
    'Clé refusée par {provider} : vérifiez-la dans Paramètres.': 'Key rejected by {provider}: check it in Settings.',
    'Modèle « {model} » introuvable chez {provider}.': 'Model "{model}" not found at {provider}.',
    "Erreur de l'API {provider} ({code}).": '{provider} API error ({code}).',
    'Impossible de joindre {provider}.': 'Unable to reach {provider}.',
    '{pct} % de vos parties sont en {role} : développer un second rôle (idéalement un rôle de dégâts si vous jouez surtout soutien/soigneur) rend vos drafts plus flexibles et vos statistiques plus équilibrées.':
        '{pct}% of your games are played as {role}: developing a second role (ideally a damage role if you mostly play support/healer) makes your drafts more flexible and your statistics more balanced.',
}
