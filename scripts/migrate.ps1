$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $repoRoot "fin-backend")
Write-Host "Running Alembic migrations (upgrade head)..." -ForegroundColor Cyan
poetry run alembic upgrade head
