# Lance la version locale (code du dépôt) pour la tester, sans toucher à l'application installée.
#  - ferme l'application installée (elle utilise le même port), puis la relance à la fin ;
#  - travaille sur une COPIE de vos données (parties, réglages, voix) : rien n'est modifié dans l'original ;
#  - n'importe aucun replay et ne partage rien avec la plateforme communautaire.
# Usage : double-clic sur test-local.cmd. « test-local.cmd reset » repart d'une copie fraîche de vos données.
param([switch]$Reset)
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$real = Join-Path $env:APPDATA "HOTS REVIVAL"
$test = Join-Path $env:LOCALAPPDATA "HOTS REVIVAL (test)"
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
$installed = Join-Path $env:LOCALAPPDATA "Programs\hots-revival-desktop\HOTS REVIVAL.exe"

function Step($text) { Write-Host "`n> $text" -ForegroundColor Cyan }

if (-not (Test-Path $python)) { throw "Environnement Python introuvable : $python" }

# 1. Application installée : fermée proprement (sinon forcée), relancée à la fin.
$running = @(Get-Process -Name "HOTS REVIVAL", "hots-backend" -ErrorAction SilentlyContinue)
if ($running) {
  Step "Fermeture de l'application installée"
  $running | ForEach-Object { [void]$_.CloseMainWindow() }
  Start-Sleep -Seconds 4
  Get-Process -Name "HOTS REVIVAL", "hots-backend" -ErrorAction SilentlyContinue | Stop-Process -Force
}
# Moteur d'une précédente version de test resté ouvert : il occuperait le port.
Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# 2. Copie des données (première fois, ou avec « reset »).
if ($Reset -and (Test-Path $test)) { Remove-Item $test -Recurse -Force }
if (-not (Test-Path $test)) {
  Step "Copie de vos données dans $test"
  New-Item -ItemType Directory -Force $test | Out-Null
  if (Test-Path $real) {
    # jamais community.json : identifiants de la plateforme communautaire
    foreach ($f in "settings.json", "overlay-prefs.json", "screen-reader.json", "analysis_version.txt", "map_hashes.json", "community_timings.json") {
      if (Test-Path (Join-Path $real $f)) { Copy-Item (Join-Path $real $f) $test }
    }
    if (Test-Path (Join-Path $real "voices")) { Copy-Item (Join-Path $real "voices") $test -Recurse }
    if (Test-Path (Join-Path $real "hots.db")) {
      # copie cohérente de la base (journal WAL compris)
      & $python -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()" (Join-Path $real "hots.db") (Join-Path $test "hots.db")
    }
  }
}

# 3. Lancement : la fenêtre de test s'ouvre ; la fermer arrête tout.
$env:HOTS_DATA_DIR = $test
$env:HOTS_SPAWN_BACKEND = "1"
$env:HOTS_PYTHON = $python
$env:HOTS_WATCH_REPLAYS = "false"
$env:HOTS_SHARE_MATCHES = "false"
Set-Location (Join-Path $root "apps\desktop")
if (-not (Test-Path "node_modules")) { Step "Installation des dépendances (première fois)"; npm install }
Step "Lancement de la version de test (fermez sa fenêtre pour terminer)"
npm run dev

# 4. Nettoyage et retour à l'application installée.
Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
if ($running -and (Test-Path $installed)) {
  Step "Relance de l'application installée"
  Start-Process $installed
}
Write-Host "`nVersion de test fermée." -ForegroundColor Green
