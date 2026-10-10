# Product Trial Reservation

**Version:** v01  
**Author:** Eton  
**Date:** 2026-10-10

A lightweight, mobile-friendly web application for collecting product trial
reservations. It uses Node.js built-in modules and SQLite, with no npm
dependencies.

## Features

- Mobile-friendly reservation form for hospitals, departments, contacts, and
  optional notes.
- Server-side input validation and per-IP submission rate limiting.
- SQLite storage for reservation records.
- Password-protected admin page and CSV export.
- Optional notifications to a WeCom group bot.
- Docker deployment with persistent database storage.

## Requirements

- Node.js **23.4 or later** (Node.js 24 LTS recommended).
- Docker Compose v2 for container deployment.

## Run with Node.js

Set an admin password, then start the application:

```bash
export ADMIN_PASS='replace-with-a-strong-password'
node src/server.js
```

The application listens on `127.0.0.1:8787` by default and creates
`trialreservations.db` in the current directory. Open
`http://127.0.0.1:8787/` to use the reservation form.

## Run with Docker Compose

1. Create `src/trialreservation.env` and set the admin credentials:

   ```dotenv
   ADMIN_USER=admin
   ADMIN_PASS=replace-with-a-strong-password
   ```

   Optionally add `WECOM_WEBHOOK_URL` to enable WeCom notifications. Keep this
   file private; do not commit credentials or webhook URLs.

2. Start the service from the repository root:

   ```bash
   docker compose up -d --build
   ```

3. Check the service:

   ```bash
   curl http://127.0.0.1:8787/healthz
   ```

   A healthy service returns `{"ok":true}`. The Compose configuration binds
   the service to localhost; use an HTTPS reverse proxy such as nginx when
   making it available externally. Reservation data is stored in `./data`.

See [docs/ubuntu-deploy.md](docs/ubuntu-deploy.md) for detailed Ubuntu
deployment and update instructions.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8787` | HTTP listening port |
| `HOST` | `127.0.0.1` | Listening address; Docker sets this to `0.0.0.0` inside the container |
| `DB_PATH` | `./trialreservations.db` | SQLite database file path |
| `ADMIN_USER` | `admin` | Username for the admin page |
| `ADMIN_PASS` | Empty | Admin password. Set this to enable admin access |
| `WECOM_WEBHOOK_URL` | Empty | Optional WeCom group bot webhook URL |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/` | Reservation form |
| `POST` | `/api/reserve` | Submit a reservation |
| `GET` | `/admin` | View recent reservations (HTTP Basic Authentication) |
| `GET` | `/admin/export.csv` | Export reservations as CSV (HTTP Basic Authentication) |
| `GET` | `/healthz` | Health check |

## License

No license has been specified.
