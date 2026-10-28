/** Traductions anglaises du processus principal, indexées par le texte français (voir i18n.ts). */
export const EN: Record<string, string> = {
  // main.ts
  "Démarrage de votre coach…": "Starting your coach…",
  "Écran {n} ({w}×{h})": "Display {n} ({w}×{h})",
  " – principal": " – primary",
  "Le moteur d'analyse n'a pas pu démarrer.": "The analysis engine failed to start.",
  "Journal : {path}\nVérifiez qu'aucun antivirus ne bloque l'application, puis relancez-la.":
    "Log: {path}\nMake sure no antivirus is blocking the application, then restart it.",

  // updater.ts
  "Mode développement": "Development mode",

  // shortcuts.ts
  "Afficher / masquer l'overlay": "Show / hide the overlay",
  "Overlay interactif (clics)": "Interactive overlay (clicks)",
  "Synchroniser l'horloge sur 0:00": "Sync the clock to 0:00",
  "Niveau allié +1": "Ally level +1",
  "Niveau adverse +1": "Enemy level +1",
  "Objectif terminé": "Objective finished",
  "Marquer ce moment à revoir (replay)": "Bookmark this moment for review (replay)",
  "Couper / rétablir le guide vocal": "Mute / unmute the voice guide",
  "Capturer l'écran pour calibrer la lecture": "Capture the screen to calibrate screen reading",
  "Capture enregistrée. Ouvrez les paramètres pour placer les zones.": "Capture saved. Open the settings to place the zones.",
  "La capture est noire : le plein écran exclusif bloque la lecture de l'écran.":
    "The capture is black: exclusive fullscreen blocks screen reading.",
  "Capture impossible.": "Capture failed.",

  // capture.ts
  "capture refusée": "capture denied",
  "aucun écran trouvé": "no display found",

  // voices.ts
  "Nom de profil invalide.": "Invalid profile name.",
  "Clé de phrase invalide : {key}": "Invalid phrase key: {key}",
  "Chemin invalide.": "Invalid path.",
  "Profil introuvable.": "Profile not found.",
  "Profil officiel : il ne peut pas être modifié.": "Official profile: it can't be modified.",
  "Un profil porte déjà ce nom.": "A profile with this name already exists.",
  "Format audio non pris en charge.": "Unsupported audio format.",
  "Enregistrement vide ou trop long.": "Recording is empty or too long.",
  "Importer des enregistrements": "Import recordings",
  "Fichier trop volumineux.": "File is too large.",
  "Fichier non sélectionné.": "File not selected.",
};
