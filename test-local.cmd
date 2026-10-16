@echo off
rem Double-clic : teste la version locale sans toucher a l'application installee (voir scripts\test-local.ps1).
rem "test-local.cmd reset" : repart d'une copie fraiche de vos donnees.
if /i "%~1"=="reset" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\test-local.ps1" -Reset
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\test-local.ps1"
)
pause
