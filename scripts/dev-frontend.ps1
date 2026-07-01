$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location (Join-Path $repoRoot "fin-front")
if (-not (Test-Path ".env")) {
  Write-Host "Warning: fin-front/.env missing. Copy fin-front/.env.example to .env" -ForegroundColor Yellow
}
Write-Host "Starting Vite - open http://localhost:5173 (API: VITE_API_BASE_URL from .env)" -ForegroundColor Cyan
npm run dev
