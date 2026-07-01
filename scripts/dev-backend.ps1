$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $repoRoot "fin-backend")
Write-Host "Starting API (app.main) at http://127.0.0.1:8000 - CORS for Vite on 5173" -ForegroundColor Cyan
poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
