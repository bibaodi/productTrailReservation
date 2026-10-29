# Product Trial Reservation

**Version:** v1.2  
**Author:** Eton  
**Date:** 2026-10-10

A lightweight, mobile-friendly web application for collecting product trial
reservations. It uses Node.js built-in modules and SQLite, with no npm
dependencies.

## Features

- Mobile-friendly reservation form for hospitals, departments, products,
  contacts, and optional notes.
- Server-side input validation and per-IP submission rate limiting.
- Browser-specific retrieval of the latest reservation, with access tokens
  that expire after 30 days without successful access.
- Returning visitors can start a new reservation from their latest details;
  submitting always creates a new record and never changes an existing one.
- SQLite storage for reservation records and site settings.
- Password-protected admin page with pagination, text search, date filters, and
  filtered CSV export.
- Password-protected settings page for the department list, product list, and
  the text shown above the WeChat QR code on the success page.
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
See [docs/261010-changes-readme.md](docs/261010-changes-readme.md) for a dated
record of notable application changes.

Reservation access is tied to a random token saved in the browser's local
storage. After the first successful submission, the page displays confirmation
with the hospital and name only. When the same browser profile opens the page
again, it can view the latest reservation's details or start a new reservation.
Choosing to view the previous details opens a form labeled “修改上次预约”
with a “保存修改” button. That button stays disabled until at least one field
differs from the saved reservation and all fields pass client-side validation;
a short hint explains why it is disabled. Saving makes the changed information
the latest reservation in this browser; the system keeps the original
submission as a separate database record. The browser view shows only the
latest record.

Use the same browser profile on the same device; clearing site data, using
private browsing, or going 30 days without successful access loses access to
the existing records. Expired records remain in the database but cannot be
recovered through this feature. After expiry, a new submission creates a new
browser access token.

Tokens are stored as hashes in the database, so replacing or restoring the
database can leave a browser holding a token the server does not recognize. In
that case the submission is rejected without saving; the page discards the old
token and retries once automatically as a new browser, so no second tap is
needed. Keep the database files together (`trialreservations.db` plus its
`-wal` and `-shm` files) when backing up or migrating, because SQLite runs in
WAL mode and recent token rows may live in the WAL file.

## Tests

Run the built-in Node.js unit tests from the repository root:

```bash
node --test
```

This discovers and runs the test files in `test/`. To run one test file:

```bash
node --test test/reservation-validation.test.js
```

Do not use `node test`: Node treats `test` as a script filename, but this
repository has a `test/` directory rather than a `test` script. No npm script
is configured.

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
| `GET` | `/admin` | View recent reservations (HTTP Basic Authentication) |
| `GET` | `/admin/export.csv` | Export reservations as CSV (HTTP Basic Authentication) |
| `GET` | `/admin/settings` | Edit departments, products, and QR caption (HTTP Basic Authentication) |
| `POST` | `/admin/settings` | Save settings (HTTP Basic Authentication plus CSRF token) |
| `GET` | `/healthz` | Health check |

The admin area has two tabs: **Reservations** (data review and CSV export) and
**Settings** (site configuration). The reservations tab has separate name,
hospital, department, and product search fields; filters by inclusive
calendar-date range; and displays 100 records per page. CSV exports include the
active search and date filters, capped at 10,000 records.

Settings are stored in the `settings` table in the same SQLite database, so
they survive restarts and container rebuilds without editing environment
files. Open `/admin/settings` with the admin credentials to change them.

Departments and products are entered one per line and appear in the form in
that order. Each list requires at least one entry, allows up to 50 entries of
up to 30 characters (departments) or 50 characters (products), and removes
blank and duplicate lines. When the product list contains only one product, the
reservation form hides the product selector, shows the product name in the page
header, and still records that product with each reservation. With two or more
products, the “请选择产品” selector is shown.

The built-in default departments are `超声科`, `妇产科`, `体检中心`, `外科`,
`内科`, and `其他`. The built-in default product is
`超声探头隔离膜智换系统`. The default QR caption is
`为了可以与我们保持联系，请您关注“即时超声”公众号`; leaving that field
blank restores the default. Removing a department or product, or changing the
caption, does not alter reservations that have already been recorded.

Admin settings form submissions are protected against cross-site request
forgery with a signed, time-limited token and an origin check. All configured
values are validated, length-limited, and HTML-escaped when rendered.

## License

No license has been specified.
