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
- Browser-specific reservation retrieval and editing, with access tokens that
  expire 30 days after the last successful use.
- SQLite storage for reservation records.
- Password-protected admin page with pagination, text search, date filters, and
  filtered CSV export.
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

Reservation access is tied to a random token saved in the browser's local
storage. The same browser profile can retrieve, edit, or add reservations made
with that token. Use the same browser profile on the same device; clearing site
data, using private browsing, or waiting 30 days without a successful visit
will remove access. Expired reservations remain in the database but cannot be
recovered through this feature.

## Tests

Run the built-in Node.js unit tests from the repository root:

```bash
node --test
```

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
| `GET` | `/api/reservations` | List reservations for the browser's bearer token |
| `PUT` | `/api/reservations/:id` | Update a reservation belonging to that token |
| `GET` | `/admin` | View recent reservations (HTTP Basic Authentication) |
| `GET` | `/admin/export.csv` | Export reservations as CSV (HTTP Basic Authentication) |
| `GET` | `/healthz` | Health check |

The admin page has separate name, hospital, and department search fields;
filters by inclusive calendar-date range; and displays 25 records per page.
CSV exports include the active search and date filters, capped at 10,000
records.

## License

No license has been specified.
