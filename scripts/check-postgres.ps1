$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Push-Location (Join-Path $repoRoot "apps/api")
try {
  poetry run python scripts/check_postgres.py
} finally {
  Pop-Location
}
