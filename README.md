# Crow's Eye

Endpoint and network monitoring for machines **you own and administer**: a server (FastAPI + SQLite), a web
console, and a host agent. Agents report telemetry; the server stores it, runs your detection rules, and raises
detections, live alerts, webhooks and emails. Nothing scans or captures packets on the network.

```
agent (each host) --HTTPS + per-host API key--> server: events -> rule engine -> detections -> UI / webhook / email
```

## Quick start (try it)
    pip install -r requirements.txt
    CROWS_EYE_DEMO=1 python -m server.main        # synthetic data through the real pipeline
Open http://127.0.0.1:8000. First-run login: user `admin`, password printed in the log (or `CROWS_EYE_ADMIN_PASSWORD`).

## Deploy for real
**Server (Docker):** `cp .env.example .env`, edit it, `docker compose up -d --build`, then put a TLS reverse proxy in
front (`deploy/Caddyfile`). **Or systemd:** `deploy/crows-eye.service`. Run exactly one server process.

**Add an endpoint:** Console > Computers > *Add endpoint* (admin). It creates an API key bound to that hostname and shows
the install command once. On the endpoint:

    sudo mkdir -p /opt/crows-eye-agent /etc/crows-eye && sudo cp agent/crows_eye_agent.py /opt/crows-eye-agent/
    sudo python3 -m venv /opt/crows-eye-agent/venv && sudo /opt/crows-eye-agent/venv/bin/pip install psutil
    printf 'CROWS_EYE_URL=https://crows-eye.example.org\nCROWS_EYE_API_KEY=ce_...\n' | sudo tee /etc/crows-eye/agent.env
    sudo chmod 600 /etc/crows-eye/agent.env
    sudo cp deploy/crows-eye-agent.service /etc/systemd/system/ && sudo systemctl enable --now crows-eye-agent

## What the agent collects (and nothing else)
CPU/memory/disk and network throughput; new processes (name, user, command line with `--password`/`token=`/`api-key`
style secrets redacted); new outbound connections and new listening ports (process name, remote IP:port); SSH/PAM
login failures and successes from `/var/log/auth.log` or `/var/log/secure` (Linux). It starts in the foreground with a
line stating exactly what it monitors. Disable parts with `--no-processes`, `--no-connections`, `--no-auth-log`.
Command lines can still contain sensitive data the redaction doesn't recognise: tell your users what is collected.

## Detection
Rules (Console > Alert rules) match event fields (`eq, ne, contains, regex, gt/gte/lt/lte, in, is_private, in_blocklist`),
optionally with a threshold (N events in T seconds, grouped by a field) and a cooldown that suppresses repeats. Defaults:
brute-force logins, encoded PowerShell, connections to blocklisted IPs (Settings > Blocklist), new listening ports, disk >= 95%.
Missing heartbeats (`offline_after`, default 90s) raise a LOW detection. Health score = % of endpoints reporting, minus 5
per open CRITICAL and 2 per open HIGH detection.

## Integrations
Create an *integration key* (Settings > API keys) for: `POST /api/ingest/wazuh` (raw Wazuh alert JSON; `rule.level` 12+
CRITICAL, 10+ HIGH, 7+ MEDIUM, else LOW) and `POST /api/ingest/events` (`{severity,name,source,device,detail}`), header `X-API-Key`.
Webhook (Slack-compatible JSON) and SMTP email alerts are configured in Settings; the SMTP password comes from the
`CROWS_EYE_SMTP_PASSWORD` environment variable, never the database.

## Security model
- Users: scrypt-hashed passwords (10+ chars), roles **viewer** (read) / **analyst** (+triage, alerts) / **admin** (+rules, settings, keys, users).
  HttpOnly + SameSite=Strict session cookie, per-session CSRF token on every write, login throttling (5 failures / 5 min),
  sessions revoked on password change/disable. The last active admin cannot be removed.
- Agents authenticate with per-host API keys (stored as SHA-256 hashes). A key can only speak for its own hostname and cannot call
  integration endpoints, and vice versa. Revoke in Settings; removing an endpoint revokes its keys.
- All ingested text is HTML-escaped in the UI; strict CSP, no inline scripts. Admin/auth actions go to an audit log.
- Use HTTPS (agents warn on plain HTTP to non-local hosts). Set `CROWS_EYE_SECURE_COOKIES=1`.

## Operations
- **Backup:** `sqlite3 /var/lib/crows-eye/crows_eye.db ".backup /backups/ce-$(date +%F).db"` (safe while running).
- **Retention:** raw events 7 days (`retention_days`), traffic/metrics 2 days, detections 1 year.
- **Health check:** `GET /healthz`. **Config:** `CROWS_EYE_DATA, _HOST, _PORT, _DEMO, _ADMIN_PASSWORD, _SECURE_COOKIES, _TRUST_PROXY, _SMTP_PASSWORD, _DB`.
- **Tests:** `pip install pytest httpx psutil && python -m pytest tests`

## Known limits
Polling agent: processes that start and exit between polls (10s) are missed; this is not a kernel-level EDR. Auth-log
collection is Linux-only (Windows agents report processes, connections, ports and metrics, but not Windows event logs;
untested on Windows/macOS). SQLite on one node suits dozens to low hundreds of endpoints. No rate limiting on ingest beyond
payload caps (500 events/report, 4 MB). Webhook URLs are admin-supplied and not restricted to public addresses.
