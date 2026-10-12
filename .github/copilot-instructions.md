# Project Guidelines

## Architecture and conventions

- This is a dependency-free Node.js application. Prefer Node.js built-ins and
  the existing module boundaries under `src/`; do not add runtime dependencies
  without a clear need.
- Keep request validation on the server, use parameterized SQLite statements,
  and escape data for its output context (HTML, CSV, or WeCom Markdown).
- Browser reservation credentials are bearer secrets: never log or store their
  raw values in the database. Keep reservation access scoped to the token.
- Preserve support for deployment under a URL subpath; use relative URLs in
  rendered pages.
- Update `README.md` for user-visible or operational changes, and append dated
  entries to [the change notes](../docs/261010-changes-readme.md) for notable
  changes. Keep deployment instructions in `docs/ubuntu-deploy.md`.

## Tests and validation

- Run the full suite with `node --test` from the repository root on Node.js
  23.4 or later; Node.js 24 is recommended because the app uses `node:sqlite`.
- Add or update focused tests under `test/` for behavior changes, including
  relevant error, expiry, and access-control paths.
- Run `git diff --check` after editing. For smaller changes, also run the
  relevant test files.

## Safety when changing reservation flows

- A successful user submission creates a reservation; do not silently turn
  user input into updates or cancellations.
- Browser review should expose only the latest reservation. Access tokens
  expire after 30 days without successful access; expired credentials cannot
  retrieve their former records.
- Treat every submitted field as untrusted, even when it is rendered only in
  notifications or administrative output.
