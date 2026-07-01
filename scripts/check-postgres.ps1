$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $repoRoot "fin-backend")
try {
  poetry run python scripts/check_postgres.py
} finally {
  Pop-Location
}
