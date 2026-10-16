; Inclus automatiquement par electron-builder (NSIS).
; Mémorise la langue choisie dans l'installeur : l'application l'applique à son premier
; lancement (electron/i18n.ts), puis la langue se change dans les Paramètres.
!macro customInstall
  WriteRegStr HKCU "Software\HOTS REVIVAL" "InstallerLanguage" "$LANGUAGE"
!macroend
