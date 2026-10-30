@echo off
rem Double-clic : teste la version locale sans toucher a l'application installee (voir scripts\test-local.ps1).
rem "test-local.cmd reset" : repart d'une copie fraiche de vos donnees.
rem "test-local.cmd jeu" (ou test-local-jeu.cmd) : pour tester en partie, les nouveaux replays sont importes dans la copie.
if /i "%~1"=="reset" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\test-local.ps1" -Reset
) else if /i "%~1"=="jeu" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\test-local.ps1" -Jeu
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\test-local.ps1"
)
pause
