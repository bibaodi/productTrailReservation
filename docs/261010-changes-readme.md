# Change Notes

This document records project updates, including changes made after 2026-10-10.

## 2026-10-12 — WeCom notification Markdown safety

Reservation fields included in WeCom notifications are untrusted input. The
notification formatter now replaces Markdown syntax, URL delimiters, and
mention markers with their fullwidth equivalents before building the message.
This prevents submitted reservation text from creating links, changing message
formatting, or triggering mentions such as `@all`.

The regression tests now check every character in the escape map and verify
that hospital, department, name, phone, and note values are escaped in the
outgoing notification while ordinary Chinese text and digits remain readable.

Run the focused tests from the repository root with:

```bash
node --test test/notifications.test.js
```

To deploy the fix, rebuild and update the application image/container using the
deployment steps in [ubuntu-deploy.md](./ubuntu-deploy.md).

## 2026-10-12 — Returning visitor reservation flow

After the first successful submission, the page now confirms success and shows
only the hospital and name. On a later visit with a valid browser token, the
user can choose to view the latest reservation details or create a new
reservation. The previous-data action opens an explicitly labeled “修改上次
预约” form with a “保存修改” button. Saving creates a new database record and
makes it the latest reservation for this browser; the previous record is
retained. The browser retrieval endpoint returns only the latest record.
Expired-token submission errors explain that the failed submission was not
saved and preserve the form so it can be submitted again using a new token.

## 2026-10-12 — Admin list and CSV export controls

The admin reservations list now displays 100 records per page. The filtered
CSV export link is styled as a rectangular button for clearer visibility.
