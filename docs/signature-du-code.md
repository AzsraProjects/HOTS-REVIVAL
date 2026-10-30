# Signature du code (SignPath Foundation)

> **Demande refusée (octobre 2026)** : SignPath Foundation juge le projet pas encore assez visible. Les versions publiées ne sont pas signées ; les étapes de signature du workflow restent inactives (pas de secret `SIGNPATH_API_TOKEN`).

Sans signature, certains antivirus (Avast notamment) bloquent l'installeur sans permettre d'exception.
SignPath Foundation signe gratuitement les projets open source ; le certificat est émis au nom de « SignPath Foundation ».

## Ce que fait le workflow

Le workflow [windows-installer.yml](../.github/workflows/windows-installer.yml) signe **uniquement les versions publiques** (tags `v*`), et seulement si le secret `SIGNPATH_API_TOKEN` existe. Sans ce secret, le build reste identique à avant (non signé).

1. `electron-builder --dir` construit l'application décompressée.
2. SignPath signe `HOTS REVIVAL.exe` et `resources/backend/hots-backend.exe` (configuration `executables`).
3. `electron-builder --prepackaged` emballe ces exécutables signés dans l'installeur NSIS.
4. SignPath signe l'installeur (configuration `installer`).
5. [refresh-update-metadata.mjs](../apps/desktop/scripts/refresh-update-metadata.mjs) recalcule `latest.yml` et le `.blockmap` (la signature change l'empreinte de l'installeur ; sans ça, la mise à jour automatique échouerait).
6. Le workflow vérifie les trois signatures avant de publier.

Chaque signature doit être **approuvée à la main** sur signpath.io (règle de SignPath Foundation) : le job attend jusqu'à une heure.

## Mise en place (une seule fois)

1. Postuler sur https://signpath.org/apply avec le dépôt `AzsraProjects/HOTS-REVIVAL`.
2. Une fois accepté, dans l'interface SignPath :
   - installer l'application GitHub SignPath sur le dépôt (connecteur « Trusted Build System ») ;
   - créer le projet avec le slug `hots-revival` ;
   - créer deux configurations d'artefact, slugs `executables` et `installer`, avec le contenu de [.github/signpath/](../.github/signpath/) ;
   - vérifier que la politique de signature s'appelle `release-signing` ;
   - créer un utilisateur CI et copier son jeton d'API.
3. Dans GitHub → Settings → Secrets and variables → Actions :
   - secret `SIGNPATH_API_TOKEN` = le jeton d'API ;
   - variable `SIGNPATH_ORGANIZATION_ID` = l'identifiant d'organisation SignPath.
4. Pousser un tag `v*`, puis approuver les deux demandes de signature sur signpath.io.

## À savoir

- Une signature ne fait pas disparaître immédiatement l'écran SmartScreen : la réputation se construit au fil des téléchargements. En revanche, Avast et les autres antivirus font nettement plus confiance à un exécutable signé.
- SignPath Foundation exige la politique de signature publiée dans le [README](../README.md#politique-de-signature-du-code--code-signing-policy).
