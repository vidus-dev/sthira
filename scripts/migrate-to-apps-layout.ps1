# Run from repo root when nothing holds locks on these folders (close IDE terminals using venv, pause OneDrive if needed).
# Produces: apps/api, apps/web, apps/mobile
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Test-Path "fin-backend") -or -not (Test-Path "fin-front") -or -not (Test-Path "fin-mobile")) {
  Write-Error "Expected fin-backend, fin-front, fin-mobile under $root"
}

if (Test-Path "apps") {
  Write-Error "Remove or rename existing apps/ first."
}

New-Item -ItemType Directory -Path "apps" | Out-Null
Move-Item -Path "fin-backend" -Destination "apps\api"
Move-Item -Path "fin-front" -Destination "apps\web"
Move-Item -Path "fin-mobile" -Destination "apps\mobile"

Write-Host "Done. Update package.json workspaces to [\"apps/web\", \"apps/mobile\"] and .gitignore paths (fin-* -> apps/*)."
