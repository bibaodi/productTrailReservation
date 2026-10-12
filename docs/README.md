# Update Notes

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
