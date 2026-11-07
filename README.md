# Crow’s Eye

Crow’s Eye is intended to be an endpoint-monitoring dashboard with a FastAPI backend and a static web interface. **This checkout is not currently a complete runnable app.** The default branch contains `static/`, Docker configuration, and Python requirements, but it does not contain the `server/` directory copied by the Dockerfile. The root `run.sh` expects a `crows-eye.zip` that is also not present in the current repository tree. As a result, the full backend cannot be initialized until its source files are restored.

This guide is the default startup guide for this repository and explains what works now and what is needed to run the complete system.

## 1. Prerequisites

For the full system, install:

- Git
- Docker Engine and the Docker Compose plugin
- A supported Linux, macOS, or Windows/WSL2 environment

For a static-only preview, Python 3 is sufficient.

## 2. Get the repository

```bash
git clone https://github.com/Bush-Steven/Crow-s-Eye.git
cd Crow-s-Eye
```

Check that the backend exists before attempting a full launch:

```bash
test -f server/main.py && echo "Backend source found" || echo "Backend source is missing"
test -f crows-eye.zip && echo "Project archive found" || echo "Project archive is missing"
```

At the time this guide was written, neither backend source nor the archive is in the default branch. The Docker build and `run.sh` will therefore fail until the backend is restored. Do not treat the dashboard-only preview below as a working monitoring backend.

## 3. Preview the static dashboard (no backend/data)

From the repository root:

```bash
python3 -m http.server 8080 --directory static
```

Open <http://127.0.0.1:8080>. This serves the static UI only. It does not start the API, authenticate users, or provide endpoint data, so live dashboard requests will show an unavailable-backend notice.

Stop the preview with `Ctrl+C`.

## 4. Initialize and start the full app (after backend source is restored)

First confirm these files are present:

```text
server/main.py
server/...
static/index.html
Dockerfile
docker-compose.yml
requirements.txt
```

Create a local environment file and set a unique, strong admin password. Keep `.env` private and never commit it:

```bash
cp .env.example .env
```

Edit `.env`. For local HTTP testing, use settings appropriate for local development; set `CROWS_EYE_SECURE_COOKIES=0`. For production behind HTTPS, use a strong unique `CROWS_EYE_ADMIN_PASSWORD` and set `CROWS_EYE_SECURE_COOKIES=1`. Only set `CROWS_EYE_TRUST_PROXY=1` when the service is behind a reverse proxy you control.

Build and start the app:

```bash
docker compose up --build
```

Open <http://127.0.0.1:8000>. Check the health endpoint:

```bash
curl -fsS http://127.0.0.1:8000/healthz
```

The documented initial username is `admin`; the password is the value of `CROWS_EYE_ADMIN_PASSWORD` in `.env` (or a generated password printed by the backend on first start, if that backend supports generated credentials). Change initial credentials after signing in. The current repository does not include the backend, so this login flow cannot be verified or used until those source files are restored.

Stop the service with `Ctrl+C`. To stop and remove the container while preserving its named data volume:

```bash
docker compose down
```

To also delete the persistent database volume (destructive; removes stored app data):

```bash
docker compose down -v
```

## 5. Run without Docker (after backend source is restored)

Create and activate a virtual environment, install dependencies, and start the server:

```bash
python3 -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m server.main
```

Then browse to <http://127.0.0.1:8000>. Do not expose a development server directly to the public internet.

## 6. GitHub Pages and production hosting

GitHub Pages can host only static files; it cannot run the FastAPI backend or SQLite database. The Pages deployment workflow and `docs/` site are not present in the current default branch. For a live system, first restore and deploy the backend on a host that runs Python/Docker, configure HTTPS, then publish the frontend and point it to that backend. Configure CORS and authentication deliberately; never put API keys or passwords in frontend JavaScript or public Pages files.

## Troubleshooting

- **Docker says `server` was not found:** backend source is absent; restore `server/` before building.
- **`run.sh` says the archive is missing:** the script expects `crows-eye.zip`; restore the archive or use the direct source layout, then update the launcher accordingly.
- **Health endpoint fails:** ensure the backend is running and inspect logs with `docker compose logs -f crows-eye`.
- **Dashboard shows unavailable API:** a static preview has no backend. Start the API and serve the frontend from the configured backend origin.
- **Login does not work:** check the backend startup logs and `.env`; there are no usable default credentials until the backend initializes its user database.

## Security and monitoring scope

Only install monitoring agents on machines you own or are authorized to administer. Review the data collected and inform affected users. Use HTTPS for remote access, protect `.env` and API keys, and avoid using sample passwords in production.
