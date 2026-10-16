# 13. Plateforme communautaire

Objectif : mutualiser les parties des joueurs HOTS REVIVAL pour publier des statistiques communautaires
(héros, cartes, duos, contres, talents) et des profils publics, sur une infrastructure **gratuite** et
**indépendante** de tout site tiers.

## 13.1 Architecture

```
Application (opt-in)                Cloudflare Worker (server/)           Site web (à venir)
────────────────────                ───────────────────────────           ──────────────────
replay parsé en local
  └─ résumé ~3 Ko ──POST /v1/matches──► validation + pseudonymisation
                                        dédoublonnage (empreinte)
                                        D1 : matches / match_players
                                        cron horaire : agrégats ─────────► GET /v1/stats/…
                                        profils publics ─────────────────► GET /v1/players/…
```

- **Pas de replay envoyé** : l'application parse déjà chaque partie et n'envoie qu'un résumé
  (`backend/app/community/summary.py`). C'est ce qui permet de tenir dans les quotas gratuits.
- **Code** : `server/` (TypeScript, Worker + D1), `backend/app/community/` (résumé, client, envoi en
  arrière-plan), `backend/app/api/community.py`, `apps/desktop/src/components/CommunitySettings.tsx`.
- **Agrégation incrémentale en SQL** (`server/src/aggregate.ts`) : seules les nouvelles parties sont lues,
  le calcul tourne dans D1 (le Worker gratuit n'a que quelques millisecondes de CPU).

## 13.2 Vie privée (RGPD) par conception

| Donnée | Stockage | Visibilité |
|---|---|---|
| Pseudos des joueurs | **Jamais envoyés** | — |
| Comptes des 10 joueurs | `pid` = HMAC(secret serveur, toon_handle), non réversible | Jamais affichés |
| Statistiques globales | Agrégats | Publiques |
| Profil d'un utilisateur | BattleTag + parties de ses comptes | Public **uniquement sur opt-in** |
| Chat, évènements, replays | Non envoyés | — |

- Partage et profil public **désactivés par défaut** ; désactiver le partage retire le profil public.
- **Suppression** depuis l'application (`DELETE /v1/me`) : profil, liens compte ↔ personne et installation
  sont effacés ; les parties restent dans les agrégats sous forme pseudonymisée.
- Sur un profil public, les coéquipiers et adversaires n'apparaissent que par leur héros.
- À prévoir avant l'ouverture : page de confidentialité, contact pour les demandes d'effacement des
  non-utilisateurs, relecture juridique.

## 13.3 Fiabilité des données

Le serveur ne voit pas le replay ; il compense par :
- **validation stricte** (`server/src/validate.ts`) : 10 joueurs, 5 contre 5, victoire cohérente, bornes
  des statistiques, modes comptés uniquement ;
- **consensus** : une même partie envoyée par plusieurs joueurs est comparée (`confirmations` /
  `conflicts`) ;
- **quotas** : 3 000 parties / installation / jour, 5 installations / IP / jour.

**Limite connue** : la revendication d'un compte (profil public) repose sur les parties envoyées en tant que
« moi » (au moins 3). Un joueur qui possède des replays d'un autre pourrait tenter de revendiquer son compte ;
le premier profil l'emporte. À renforcer (signalement, modération) avant une ouverture large.

## 13.4 Quotas gratuits (à vérifier, les offres évoluent)

| Ressource | Usage | Ordre de grandeur |
|---|---|---|
| D1 écritures | ~12 lignes par partie | ~8 000 nouvelles parties / jour |
| D1 stockage | ~3 Ko par partie | ~1,5 M de parties pour 5 Go |
| Worker requêtes | 25 parties par requête | largement suffisant |

Au-delà, l'API répond `503` + `Retry-After` et l'application réessaie plus tard (rien n'est perdu).

## 13.5 Déploiement (à faire hors stream : identifiants personnels)

```bash
cd server
npm install
npx wrangler login                          # compte Cloudflare gratuit
npx wrangler d1 create hots-community       # copier database_id dans wrangler.toml
npm run db:remote                           # crée les tables
npx wrangler secret put PID_SECRET          # longue valeur aléatoire, à ne jamais publier ni changer
npm run deploy                              # affiche l'URL https://hots-revival-community.<compte>.workers.dev
```

Instance officielle : `https://hots-revival-community.hots-revival.workers.dev`, renseignée dans `COMMUNITY_URL`
(`backend/app/config.py`). Le secret `PID_SECRET` est sauvegardé hors du repo sur le PC du mainteneur.

⚠ `PID_SECRET` doit être sauvegardé hors du repo : le perdre rend les nouvelles parties impossibles à relier
aux anciennes.

Développement local : `npm run db:local`, créer `server/.dev.vars` avec `PID_SECRET=dev`, puis `npm run dev`
(`--test-scheduled` puis `GET /__scheduled` pour lancer l'agrégation).

## 13.6 Résilience

- Le serveur se redéploie en quelques commandes sur n'importe quel compte Cloudflare.
- À venir : export public régulier des agrégats (et des parties pseudonymisées) pour que les données
  survivent à l'hébergeur.
- L'application reste entièrement fonctionnelle sans la plateforme.

## 13.7 Site web (`site/`)

React + Vite + Tailwind (mêmes couleurs que l'application), hébergé gratuitement sur Cloudflare Pages.

| Page | Contenu |
|---|---|
| `/` | Chiffres de la communauté, héros du moment, plus joués, derniers profils |
| `/heros` | Tier list : filtres mode / carte / rôle, tri tier ou popularité (filtres dans l'URL) |
| `/heros/:id` | Onglets Talents (build de la communauté), Cartes, Synergies |
| `/joueurs`, `/joueurs/:slug` | Recherche, derniers profils publics, profil (héros favoris, dernières parties) |
| `/a-propos` | Fonctionnement, confidentialité, crédits |

- **Tiers relatifs** sur le winrate lissé (moyenne bayésienne, 20 parties fictives à 50 %) : S 10 %, A 20 %,
  B 40 %, C 20 %, D 10 % des héros joués au moins 10 fois (`site/src/lib/stats.ts`).
- **Données du jeu** : `npm run data` régénère `src/data/` et `public/data/talents/` depuis
  `backend/app/data` ; portraits et icônes via heroes-talents (MIT, version figée) sur jsDelivr.
- **Développement** : `cd site && npm install && npm run dev` (http://localhost:5180, API en ligne par défaut,
  `VITE_API_BASE` pour une autre instance).
- **En ligne** : https://hots-revival.pages.dev (lien depuis l'application : barre latérale et Paramètres).
- **Déploiement** : `npm run deploy` (Cloudflare Pages, projet `hots-revival`, branche de production `main`).

## 13.8 Prochaines étapes

1. Statistiques communautaires dans le Draft Assistant et l'onglet Méta de l'application.
2. Exports publics réguliers, signalement des profils.
