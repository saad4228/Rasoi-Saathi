<#
.SYNOPSIS
  Checks the setup and starts RasoiSaathi (backend + frontend). Run via dev.cmd.

.DESCRIPTION
  1. Checks Python / Node and installs anything missing (only what's missing).
  2. Checks both .env files and that the Supabase project is reachable
     (free projects pause after about a week of inactivity).
  3. Applies database migrations (alembic upgrade head).
  4. Starts the API (port 8000) and the Next.js app in their own windows
     and opens the app in your browser.

.PARAMETER Check
  Only run the checks; don't install, migrate or start anything.
#>
param([switch]$Check)

# "Continue": in Windows PowerShell 5.1, "Stop" turns any stderr line from python/npm into a crash.
$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend-mockup"
$script:Problems = 0
$script:Warnings = 0

function Say($text) { Write-Host "  $text" }
function Ok($text) { Write-Host "  [ok]   $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  [warn] $text" -ForegroundColor Yellow; $script:Warnings++ }
function Fail($text) { Write-Host "  [fail] $text" -ForegroundColor Red; $script:Problems++ }
function Section($text) { Write-Host ""; Write-Host "== $text" -ForegroundColor Cyan }

function Read-EnvFile($path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $path)) { return $values }
  foreach ($line in Get-Content -LiteralPath $path -Encoding UTF8) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) { continue }
    $index = $trimmed.IndexOf("=")
    $values[$trimmed.Substring(0, $index).Trim()] = $trimmed.Substring($index + 1).Trim().Trim('"').Trim("'")
  }
  return $values
}

function Test-HostResolves($hostName) {
  try { [void][System.Net.Dns]::GetHostAddresses($hostName); return $true } catch { return $false }
}

function Get-PortOwner($port) {
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) { return $null }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process) { return "$($process.Name) (pid $($listener.OwningProcess)): $($process.CommandLine)" }
  return "pid $($listener.OwningProcess)"
}

function Test-RasoiBackend {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 3
    return ($health.service -eq "rasoi-saathi")
  } catch { return $false }
}

function Find-RasoiFrontend {
  # Only probe ports that are listening; the first request may wait for Next.js to compile /login.
  $ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge 3000 -and $_.LocalPort -le 3010 } |
    Select-Object -ExpandProperty LocalPort -Unique | Sort-Object
  foreach ($port in $ports) {
    try {
      $page = Invoke-WebRequest -Uri "http://localhost:$port/login" -UseBasicParsing -TimeoutSec 60
      if ($page.Content -match "Sign in to your workspace") { return "http://localhost:$port" }
    } catch { }
  }
  return $null
}

function Start-InWindow($title, $directory, $command) {
  $script = "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$directory'; $command"
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $script) | Out-Null
}

# Prints the requirements.txt lines whose package can't be imported, so only those are installed
# (a full "pip install -r" into a shared Python could change versions other projects rely on).
$MissingPackagesScript = @'
import importlib, pathlib, re
modules = {"fastapi": "fastapi", "uvicorn": "uvicorn", "sqlalchemy": "sqlalchemy", "psycopg": "psycopg", "jwt": "pyjwt",
           "cryptography": "pyjwt", "pydantic_settings": "pydantic-settings", "dotenv": "python-dotenv", "httpx": "httpx",
           "twilio": "twilio", "multipart": "python-multipart", "alembic.config": "alembic", "google.genai": "google-genai",
           "pandas": "pandas", "numpy": "numpy", "xgboost": "xgboost", "sklearn": "scikit-learn", "tzdata": "tzdata"}
lines = [l.strip() for l in pathlib.Path("requirements.txt").read_text().splitlines() if l.strip() and not l.startswith("#")]
by_name = {re.split(r"[\[<>=!~ ]", l, maxsplit=1)[0].lower(): l for l in lines}
missing = set()
for module, package in modules.items():
    try:
        importlib.import_module(module)
    except Exception:
        missing.add(by_name.get(package, package))
print("\n".join(sorted(missing)))
'@

Write-Host "RasoiSaathi developer launcher" -ForegroundColor Cyan

# ── Tools ────────────────────────────────────────────────────────────────────
Section "Tools"
# Prefer a project virtualenv if there is one; otherwise the Python on PATH.
$Py = $null
foreach ($candidate in @((Join-Path $Backend ".venv\Scripts\python.exe"), (Join-Path $Backend "venv\Scripts\python.exe"))) {
  if (-not $Py -and (Test-Path -LiteralPath $candidate)) { $Py = $candidate }
}
if (-not $Py) {
  $found = Get-Command python -ErrorAction SilentlyContinue
  if (-not $found) { $found = Get-Command py -ErrorAction SilentlyContinue }
  if ($found) { $Py = $found.Source }
}
if ($Py) { Ok ("Python: " + (& $Py --version 2>&1) + "  ($Py)") } else { Fail "Python not found. Install Python 3.12+ from https://www.python.org/downloads/" }
if (Get-Command npm -ErrorAction SilentlyContinue) { Ok ("Node.js: " + (& node --version)) } else { Fail "Node.js not found. Install it from https://nodejs.org/" }
if ($script:Problems) { exit 1 }

# ── Configuration ────────────────────────────────────────────────────────────
Section "Configuration"
$backendEnvPath = Join-Path $Backend ".env"
if (-not (Test-Path -LiteralPath $backendEnvPath)) {
  Copy-Item -LiteralPath (Join-Path $Backend ".env.example") -Destination $backendEnvPath
  Fail "Created backend\.env from the example. Fill in DATABASE_URL, SUPABASE_URL and GEMINI_API_KEY, then run this again."
  exit 1
}
$backendEnv = Read-EnvFile $backendEnvPath
$frontendEnv = Read-EnvFile (Join-Path $Frontend ".env")
foreach ($key in @("DATABASE_URL", "SUPABASE_URL")) {
  if ($backendEnv[$key]) { Ok "backend\.env has $key" } else { Fail "backend\.env is missing $key" }
}
if ($backendEnv["GEMINI_API_KEY"]) { Ok "backend\.env has GEMINI_API_KEY" } else { Warn "GEMINI_API_KEY is empty: the AI Copilot is off and WhatsApp uses the built-in order parser" }
foreach ($key in @("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  if ($frontendEnv[$key]) { Ok "frontend-mockup\.env has $key" } else { Fail "frontend-mockup\.env is missing $key (Supabase -> Project Settings -> API)" }
}
if ($backendEnv["SUPABASE_URL"] -and $frontendEnv["NEXT_PUBLIC_SUPABASE_URL"] -and ($backendEnv["SUPABASE_URL"].TrimEnd("/") -ne $frontendEnv["NEXT_PUBLIC_SUPABASE_URL"].TrimEnd("/"))) {
  Fail "backend\.env SUPABASE_URL and frontend-mockup\.env NEXT_PUBLIC_SUPABASE_URL point to different projects"
}
if ($script:Problems) { exit 1 }

# ── Supabase ─────────────────────────────────────────────────────────────────
Section "Supabase"
$supabaseHost = ([Uri]$backendEnv["SUPABASE_URL"]).Host
$projectRef = $supabaseHost.Split(".")[0]
$supabaseUp = Test-HostResolves $supabaseHost
if ($supabaseUp) {
  Ok "Project $projectRef is reachable"
  try {
    $authSettings = Invoke-RestMethod -Uri "$($backendEnv['SUPABASE_URL'].TrimEnd('/'))/auth/v1/settings" -Headers @{ apikey = $frontendEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"] } -TimeoutSec 15
    if ($authSettings.mailer_autoconfirm) {
      Ok "'Confirm email' is off (sign-ups, staff and demo logins work straight away)"
    } else {
      Warn "'Confirm email' is ON: every new login needs a confirmation email (Supabase sends only a few per hour) and the demo logins can't be created."
      Say "Turn it off: Supabase -> Authentication -> Sign In / Providers -> Email -> 'Confirm email' -> Save."
    }
  } catch {
    Warn "Couldn't read the Supabase auth settings - check NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend-mockup\.env"
  }
} else {
  Fail "Project $projectRef can't be reached - it is paused or deleted (free projects pause after ~1 week idle)."
  Say "Restore it here, wait until it shows 'Healthy', then run this again:"
  Say "  https://supabase.com/dashboard/project/$projectRef"
}

# ── Backend dependencies & database ──────────────────────────────────────────
Section "Backend"
Push-Location -LiteralPath $Backend
# Piped through stdin: Windows PowerShell 5.1 mangles double quotes in native command arguments.
try { $missing = @($MissingPackagesScript | & $Py - 2>$null | Where-Object { $_ -and $_.Trim() }) } finally { Pop-Location }
if ($missing.Count -eq 0) {
  Ok "Python packages installed"
} elseif ($Check) {
  Fail ("Missing Python packages: " + ($missing -join ", ") + " (run dev.cmd without -Check to install them)")
} else {
  Say ("Installing missing Python packages: " + ($missing -join ", "))
  & $Py -m pip install @missing
  if ($LASTEXITCODE -ne 0) { Fail "pip install failed (see above)"; exit 1 }
  Ok "Python packages installed"
}

if ($supabaseUp) {
  Push-Location -LiteralPath $Backend
  try {
    $dbCheck = (& $Py -c "from sqlalchemy import text; from app.database import engine; c = engine.connect(); c.execute(text('select 1')); print('db-ok')" 2>&1 | Out-String)
    if ($dbCheck -match "db-ok") {
      Ok "Database connection works"
      if ($Check) {
        $current = (& $Py migrate.py current 2>$null | Out-String)
        if ($current -match "\(head\)") { Ok "Database schema is up to date" } else { Warn "Database migrations are pending (dev.cmd applies them)" }
      } else {
        Say "Applying database migrations ..."
        & $Py migrate.py upgrade head
        if ($LASTEXITCODE -ne 0) { Fail "Migrations failed (see above)"; exit 1 }
        Ok "Database schema is up to date"
        Say "Setting up the demo restaurant (first run only) ..."
        & $Py seed_demo.py --if-missing
        if ($LASTEXITCODE -eq 0) { Ok "Demo logins ready (shown on the login page)" } else { Warn "Demo logins weren't created (see the message above). The app still works; run 'python seed_demo.py' in backend\ once fixed." }
      }
    } else {
      $reason = ($dbCheck -split "`n" | Where-Object { $_ -match "Error|FATAL" } | Select-Object -Last 1)
      Fail "Can't connect to the database: $reason"
      Say "Check DATABASE_URL in backend\.env (Supabase -> Connect -> Session pooler)."
    }
  } finally { Pop-Location }
} else {
  Warn "Skipping database checks until Supabase is reachable"
}

# ── Frontend ─────────────────────────────────────────────────────────────────
Section "Frontend"
if (Test-Path -LiteralPath (Join-Path $Frontend "node_modules")) {
  Ok "npm packages installed"
} elseif ($Check) {
  Fail "npm packages missing (run dev.cmd without -Check to install them)"
} else {
  Say "Installing npm packages ..."
  Push-Location -LiteralPath $Frontend
  try { & npm install; if ($LASTEXITCODE -ne 0) { Fail "npm install failed"; exit 1 } } finally { Pop-Location }
  Ok "npm packages installed"
}
$runningFrontend = Find-RasoiFrontend
$port3000 = Get-PortOwner 3000
if ($port3000 -and $runningFrontend -ne "http://localhost:3000") {
  Warn "Port 3000 is used by another app: $port3000"
  Say "RasoiSaathi will start on the next free port. Supabase email links (password reset, sign-up"
  Say "confirmation) open your Supabase 'Site URL' - usually http://localhost:3000 - so stop that app if you need them."
}
if ($runningFrontend) { Ok "RasoiSaathi web app is running on $runningFrontend" }
if (Test-RasoiBackend) { Ok "RasoiSaathi API is running on http://127.0.0.1:8000" }

if ($Check) {
  Section "Summary"
  if ($script:Problems) { Write-Host "  $($script:Problems) problem(s) found - see the [fail] lines above." -ForegroundColor Red; exit 1 }
  if ($script:Warnings) { Write-Host "  No blocking problems, but $($script:Warnings) warning(s) above need attention. The app will still start with dev.cmd." -ForegroundColor Yellow; exit 0 }
  Write-Host "  Everything looks good. Run dev.cmd to start the app." -ForegroundColor Green
  exit 0
}

if (-not $supabaseUp) {
  Write-Host ""
  $answer = Read-Host "Supabase is unreachable, so sign-in won't work. Start the app anyway? (y/N)"
  if ($answer -notmatch "^[yY]") { exit 1 }
}

# ── Start ────────────────────────────────────────────────────────────────────
Section "Starting"
if (Test-RasoiBackend) {
  Ok "Backend already running on http://127.0.0.1:8000"
} else {
  $port8000 = Get-PortOwner 8000
  if ($port8000) { Fail "Port 8000 is used by another app: $port8000"; exit 1 }
  Start-InWindow "RasoiSaathi API (port 8000)" $Backend "& '$Py' -m uvicorn app.main:app --reload --port 8000"
  Say "Starting backend ..."
  $deadline = (Get-Date).AddSeconds(60)
  while (-not (Test-RasoiBackend) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
  if (Test-RasoiBackend) { Ok "Backend running on http://127.0.0.1:8000" } else { Fail "Backend didn't start - check its window for errors"; exit 1 }
}

if ($runningFrontend) {
  Ok "Frontend already running on $runningFrontend"
} else {
  Start-InWindow "RasoiSaathi web app" $Frontend "npm run dev"
  Say "Starting frontend (the first start takes a little while) ..."
  $deadline = (Get-Date).AddSeconds(180)
  while (-not $runningFrontend -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 2; $runningFrontend = Find-RasoiFrontend }
  if ($runningFrontend) { Ok "Frontend running on $runningFrontend" } else { Fail "Frontend didn't start - check its window for errors"; exit 1 }
}

Start-Process "$runningFrontend/login"
Write-Host ""
Write-Host "  RasoiSaathi is running: $runningFrontend (API: http://127.0.0.1:8000)" -ForegroundColor Green
Write-Host "  Close the two server windows to stop it."
