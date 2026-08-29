# Troubleshooting

A field guide for the most common CaféSmart build / run issues, with
copy-paste fixes. If your error isn't here, file an issue and add a
new section.

---

## 1. `docker build` fails with `error during connect: ... got SIGTERM/SIGINT`

### Symptom

```
$ docker build -t cafesmart:latest .
[+] Building 0.0s (0/0)
ERROR: failed to build: error during connect: Get
  "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/_ping":
  got SIGTERM/SIGINT, forcing shutdown
```

### Cause

The Docker CLI couldn't talk to the Docker Desktop engine. On Windows,
Docker Desktop exposes its engine through the **named pipe**
`//./pipe/dockerDesktopLinuxEngine`. The error `got SIGTERM/SIGINT`
means the named pipe exists but nothing is listening — the engine is
either stopped, starting up, or the underlying WSL2/Hyper-V backend
is broken.

**This is a Docker Desktop issue, not a CaféSmart code issue.**
No Dockerfile, line ending, or application change will fix it.

### Fix

```powershell
# 1. Force-quit Docker Desktop (clears any stuck process)
Get-Process "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process com.docker.backend -ErrorAction SilentlyContinue | Stop-Process -Force

# 2. Relaunch and wait for the engine to come up
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Sleep -Seconds 5

# 3. Poll until the engine is ready (max 2 min)
for ($i=0; $i -lt 60; $i++) {
  if (docker info 2>&1 | Select-String -Quiet "Server Version") {
    Write-Host "Docker engine ready."
    break
  }
  Start-Sleep -Seconds 2
}

# 4. If still not ready, restart the WSL2 backend
wsl --shutdown
Start-Sleep -Seconds 3
wsl --distribution docker-desktop

# 5. Last resort — reset Docker Desktop to factory defaults
#    (Docker Desktop GUI → Troubleshoot → Reset to factory defaults)
```

### Verify

```powershell
docker info
# Should print a "Server:" section with "Server Version: 29.x.x"

docker run --rm hello-world
# Should pull and run a tiny test image
```

### If the engine never comes up

Common deeper causes:

- **Windows recently updated** — WSL2 may need to be re-enabled. Run
  `wsl --update` in an elevated PowerShell.
- **Virtualization disabled in BIOS** — Docker Desktop needs VT-x /
  AMD-V. Reboot, enter BIOS, enable it.
- **Conflicting service** — another process is bound to the named
  pipe. Check `Get-Process | Where-Object { $_.ProcessName -match
  "docker|vpn|wireguard" }`.
- **Out of disk space** — Docker Desktop needs ~10 GB free. The WSL2
  vhdx file lives at `%LOCALAPPDATA%\Docker\wsl\data\` and can be
  pruned via Docker Desktop → Troubleshoot → "Clean / Purge data".

---

## 2. `docker run --env-file .env ...` → `no such file or directory`

### Symptom

```
$ docker run --rm -p 3000:3000 -p 8000:8000 --env-file .env cafesmart:latest
docker: --env-file: open .env: The system cannot find the file specified.
```

### Cause

`.env` is gitignored and is not auto-created. A fresh clone has only
`.env.example` (template) and possibly `.env.local` (your dev secrets).

### Fix

Run the bootstrap script:

```powershell
# Windows
.\scripts\init-env.ps1

# Linux / macOS
./scripts/init-env.sh
```

This will copy `.env.example` → `.env`, generate a random
`AUTH_SECRET`, and auto-import values from `.env.local` if present.

---

## 3. Container crashes with `exec /usr/local/bin/docker-entrypoint.sh: no such file or directory`

### Symptom

The container starts, then immediately exits with:

```
exec /usr/local/bin/docker-entrypoint.sh: no such file or directory
```

### Cause

The entrypoint script was committed with Windows **CRLF** line
endings. The Linux kernel's `execve()` reads the shebang up to the
first `\n`; with a trailing `\r`, it looks for the interpreter at
`/bin/sh\r` (which doesn't exist).

### Fix

Already handled in the repo by:

1. **`.gitattributes`** — forces `*.sh` and `Dockerfile*` to LF on
   checkout.
2. **`RUN dos2unix`** in the `Dockerfile` — strips CRLF during
   `docker build` even if a CRLF file slips through.
3. **`scripts/check-line-endings.sh`** — CI-friendly auditor.

To verify your local clone is clean:

```bash
./scripts/check-line-endings.sh
```

If it reports any files as ✗, fix them with:

```bash
dos2unix <file>          # if you have dos2unix installed
# OR
sed -i 's/\r$//' <file>  # universal fallback
```

---

## 4. Container starts but `PrismaClientInitializationError` immediately

### Symptom

The container is up (port 3000 responds), but the first request to
any DB-backed endpoint returns 500 with:

```
PrismaClientInitializationError: Can't reach database server at `db:5432`
```

### Cause

`DATABASE_URL` in your `.env` points to `db` (a hostname) or
`localhost`. Inside a Docker container, `localhost` is the container
itself, **not** your host machine.

### Fix

```bash
# Edit .env, then restart the container:
DATABASE_URL="postgresql://user:pass@host.docker.internal:5432/cafesmart"
docker run --rm -p 3000:3000 -p 8000:8000 --add-host=host.docker.internal:host-gateway --env-file .env cafesmart:latest
```

`host.docker.internal` is mapped to the host's loopback by Docker
Desktop (Windows/macOS). On Linux you may need
`--add-host=host.docker.internal:host-gateway`.

---

## 5. `npm ci` inside Dockerfile fails with `Could not find Prisma Schema`

### Symptom

```
[deps 5/5] RUN npm ci --include=dev
...
Error: Could not find Prisma Schema that is required for this command.
```

### Cause

The `postinstall` script (`prisma generate`) runs as part of
`npm ci`, but the `prisma/` directory was not `COPY`d before
`npm ci`.

### Fix

Already fixed in the current Dockerfile (the `deps` stage now
`COPY`s `prisma/` and `prisma.config.ts` before `npm ci`). If you
hit this on an older image, pull the latest.

---

## 6. `npm warn EBADENGINE Unsupported engine: @prisma/streams-local ... required node >= 22`

### Symptom

```
npm warn EBADENGINE Unsupported engine {
  package: '@prisma/streams-local@0.1.11',
  required: { node: '>=22.0.0' },
  current: { node: 'v20.20.2' }
}
```

### Cause

Prisma 7 transitively depends on `@prisma/streams-local`, which
requires Node 22+. The Dockerfile was on `node:20-alpine`.

### Fix

Already fixed. The Dockerfile now uses `node:22-alpine` for all
Node stages, and `package.json#engines.node` is `>=22.0.0`.

---

## 7. `next.config.ts` rejects `eslint` key at build time

### Symptom

```
Invalid next.config.ts options detected:
    Unrecognized key(s) in object: 'eslint'
```

### Cause

Next.js 16 removed the `eslint` key from `next.config.ts`. Lint is
now run as a separate CI step (`.github/workflows/ci.yml`).

### Fix

Already fixed. The offending block was removed from `next.config.ts`.
If you have local modifications, delete the `eslint: { ... }` block.

---

## 8. Playwright / browser tests will not start

### Symptom

```
Executable doesn't exist at ...\msedge.exe
```

### Cause

Playwright needs to download browser binaries on first use. This
fails in restricted networks or when the cache is corrupted.

### Fix

```bash
# First-time install (downloads ~500 MB)
npx playwright install chromium

# If that fails, install with system deps (Linux/WSL2)
npx playwright install --with-deps chromium
```

---

## Getting more help

If none of the above resolves your issue:

1. Run with verbose logging: `docker build -t cafesmart:latest . --progress=plain --no-cache`
2. Capture the failing layer: `docker build --target <stage> -t debug .`
3. Open an issue and include the full `docker info` + `docker build` output.


