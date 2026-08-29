# ─────────────────────────────────────────────────────────────────────────────
# init-env.ps1 — Bootstrap a `.env` file from `.env.example` for CaféSmart.
# ─────────────────────────────────────────────────────────────────────────────
# Usage (from the repository root):
#   .\scripts\init-env.ps1
#
# What it does:
#   1. If `.env` already exists, asks before overwriting.
#   2. Copies `.env.example` → `.env`.
#   3. Generates a cryptographically-random 32-byte AUTH_SECRET (base64).
#   4. Prompts for the few secrets that MUST be filled in by hand
#      (DATABASE_URL, Google OAuth, PayHere).
#   5. Optionally runs `docker build` so the image is ready to launch.
# ─────────────────────────────────────────────────────────────────────────────

[CmdletBinding()]
param(
  [switch]$Force,         # overwrite existing .env without asking
  [switch]$NoBuild        # skip the docker build step
)

$ErrorActionPreference = "Stop"

# Move to repo root (parent of the scripts/ directory)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

Write-Host ""
Write-Host "CaféSmart — .env bootstrap" -ForegroundColor Cyan
Write-Host "──────────────────────────" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"
Write-Host ""

$EnvPath = Join-Path $RepoRoot ".env"
if (Test-Path $EnvPath) {
  if (-not $Force) {
    $answer = Read-Host "  .env already exists. Overwrite? [y/N]"
    if ($answer -ne "y" -and $answer -ne "Y") {
      Write-Host "  Aborted. Existing .env left unchanged." -ForegroundColor Yellow
      exit 0
    }
  }
  Write-Host "  • Overwriting existing .env" -ForegroundColor Yellow
}

if (-not (Test-Path (Join-Path $RepoRoot ".env.example"))) {
  Write-Host "  ✗ .env.example not found in $RepoRoot" -ForegroundColor Red
  exit 1
}

# 1) Copy template → .env
Copy-Item -Path (Join-Path $RepoRoot ".env.example") -Destination $EnvPath -Force
Write-Host "  ✓ Copied .env.example → .env" -ForegroundColor Green

# 2) Generate AUTH_SECRET (32 random bytes, base64)
# Use a modern, deterministic CSPRNG call. RNGCryptoServiceProvider is
# deprecated in .NET 6+; we use the GetBytes(byte[]) overload directly.
$randomBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
$AuthSecret = [Convert]::ToBase64String($randomBytes)

# Replace the placeholder in .env. Note: the template uses
# AUTH_SECRET="REPLACE-ME-..." so the regex below is safe.
$envContent = Get-Content $EnvPath -Raw
$envContent = $envContent -replace 'AUTH_SECRET="REPLACE-ME-WITH-A-32-BYTE-RANDOM-BASE64-STRING"', "AUTH_SECRET=`"$AuthSecret`""
$envContent = $envContent -replace 'NEXTAUTH_SECRET="REPLACE-ME-WITH-A-32-BYTE-RANDOM-BASE64-STRING"', "NEXTAUTH_SECRET=`"$AuthSecret`""
Set-Content -Path $EnvPath -Value $envContent -NoNewline
Write-Host "  ✓ Generated AUTH_SECRET and NEXTAUTH_SECRET" -ForegroundColor Green

# 3) Prompt for required hand-filled secrets
function Update-EnvValue {
  param([string]$Key, [string]$Prompt, [bool]$Required = $true)
  $existing = (Select-String -Path $EnvPath -Pattern "^$Key=" | Select-Object -First 1).ToString()
  if ($existing -and $existing -notmatch "REPLACE-ME" -and $existing -notmatch "your-") {
    Write-Host "  • $Key already filled in — keeping existing value" -ForegroundColor DarkGray
    return
  }
  # If .env.local has a real value for this key, prefer it (typical
  # dev workflow: .env.local has the secrets you used during dev,
  # .env is what the Docker container will read).
  $localPath = Join-Path $RepoRoot ".env.local"
  if (Test-Path $localPath) {
    $localVal = (Select-String -Path $localPath -Pattern "^$Key=" | Select-Object -First 1)
    if ($localVal -and $localVal -notmatch "REPLACE-ME" -and $localVal -notmatch "your-") {
      # Extract the value between the first "=" and the closing quote
      $val = ($localVal -replace "^$Key=", "") -replace '^"', '' -replace '"$', ''
      $envContent = Get-Content $EnvPath -Raw
      $envContent = $envContent -replace "(?m)^$Key=.*$", "$Key=`"$val`""
      Set-Content -Path $EnvPath -Value $envContent -NoNewline
      Write-Host "  ✓ $Key copied from .env.local" -ForegroundColor Green
      return
    }
  }
  $value = Read-Host "  $Prompt"
  if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
    Write-Host "    Skipped (you can edit .env later)" -ForegroundColor Yellow
    return
  }
  $envContent = Get-Content $EnvPath -Raw
  $envContent = $envContent -replace "(?m)^$Key=.*$", "$Key=`"$value`""
  Set-Content -Path $EnvPath -Value $envContent -NoNewline
  Write-Host "  ✓ $Key updated" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Required hand-filled values (press Enter to skip and edit .env later):" -ForegroundColor Yellow
Update-EnvValue "DATABASE_URL"          "DATABASE_URL (e.g. postgresql://user:pass@host:5432/db)"
Update-EnvValue "AUTH_GOOGLE_ID"        "AUTH_GOOGLE_ID (Google OAuth client ID)"
Update-EnvValue "AUTH_GOOGLE_SECRET"    "AUTH_GOOGLE_SECRET (Google OAuth client secret)"
Update-EnvValue "PAYHERE_MERCHANT_ID"   "PAYHERE_MERCHANT_ID (sandbox: 1211111)"
Update-EnvValue "PAYHERE_MERCHANT_SECRET" "PAYHERE_MERCHANT_SECRET (sandbox value)"

# 4) Done
Write-Host ""
Write-Host "  ✓ .env is ready at $EnvPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Cyan
Write-Host "    1. (Optional) Inspect or edit: code .env"
Write-Host "    2. Build the Docker image:       docker build -t cafesmart:latest ."
Write-Host "    3. Run the container:            docker run --rm -p 3000:3000 -p 8000:8000 --env-file .env cafesmart:latest"
Write-Host ""

# 5) Optionally build the image now
if (-not $NoBuild) {
  $answer = Read-Host "  Build the Docker image now? [y/N]"
  if ($answer -eq "y" -or $answer -eq "Y") {
    docker build -t cafesmart:latest .
  } else {
    Write-Host "  Skipped. Run 'docker build -t cafesmart:latest .' when you're ready." -ForegroundColor DarkGray
  }
}
