# Change Notes

This document records project updates, including changes made after 2026-10-10.

## 2026-11-10 — Demo reservation type

The application now serves two reservation types. `/` (or `/?type=trial`)
keeps the trial page, and `/?type=demo` renders a demo page titled
`产品演示预约`. Each type has its own configurable product list and its own
browser-visible reservation history, so a returning user on one page does not
see the other type's record.

New defaults:

- Demo products: `住院医师规范化培训系统`
- Demo attention text: `预约产品演示, 本系统不提供试用, 可备注业务场景, 我们针对性演示.`

The demo attention text is shown as a bold highlighted callout below the
`说明 / 建议` hint. It is a static instruction, not pre-filled note content.
Both demo settings are editable in `/admin/settings`.

The note box stays compact at three lines. When the content overflows, a
small expand icon appears in the note box and opens a near-full-screen editor
with a character counter; edits are synchronized back to the form.

Storage and admin changes:

- `trialreservations.type` records `trial` or `demo`; existing rows default to
  `trial`.
- `GET /api/reservations` accepts `type` and returns only that type's latest
  record for the device token.
- The admin page replaces the product text filter with a dropdown listing
  configured products and products already recorded, and adds a type filter,
  a Type column, and a Type column in the CSV export.
- WeCom notifications start with `新的试用预约` or `新的演示预约`.

Code additions include `src/reservation-types.js` for the per-type
configuration and a matching migration in `src/database.js`.

## 2026-10-29 — Configurable products and success-page caption

The reservation form now includes a required product selector. The product
list and the text shown above the WeChat QR code on the success page are
managed from a new password-protected settings page at `/admin/settings`.
Settings are stored in the `settings` table of the existing SQLite database,
so they persist across restarts and container rebuilds.

The admin area is now split into two tabs: **Reservations** (`/admin`) and
**Settings** (`/admin/settings`). The code was split to match:

- `src/admin-router.js` — admin authentication, CSRF, and tab routing.
- `src/pages/layout.js` — shared admin shell and tab navigation.
- `src/pages/admin-reservations.js` — data review page.
- `src/pages/admin-settings.js` — configuration page.
- `src/pages/reservation.js` — public reservation page.
- `src/pages/csv.js` — CSV export formatting.
- `src/admin-query.js` and `src/settings.js` — the corresponding data layers.

The department list is also configurable from the same Settings tab. Like
products, departments are stored in the database, validated server-side, and
shown to users in the order entered. Reservations keep the department recorded
at submission time even if the list later changes.

Defaults:

- Departments: `超声科`, `妇产科`, `体检中心`, `外科`, `内科`, `其他`
- Products: `超声探头隔离膜智换系统`
- QR caption: `为了可以与我们保持联系，请您关注“即时超声”公众号`

The first version of this caption used reversed quotation marks
(`”即时超声“`). On startup the application rewrites that exact stored value
to the corrected `“即时超声”`, so existing saved settings are fixed without an
admin edit.

When the product list contains exactly one product, the reservation form hides
the product selector and shows the product name in the page header instead. The
product is submitted through a hidden field, so it is still recorded on every
reservation. With two or more products, the “请选择产品” selector is shown.

If a submission is rejected because the browser's stored access token is no
longer recognized (for example after the database was replaced or restored),
the page now discards that token and retries once automatically as a new
browser. Previously the user had to submit a second time manually.

In the “修改上次预约” flow, the “保存修改” button is disabled while the form
still matches the saved reservation, and also while any field is invalid. It
becomes enabled only after a real change passes client-side validation. A hint
below the button explains whether nothing changed or which rule is failing.

The product is recorded with each reservation and appears in the admin table,
product search filter, CSV export, and WeCom notification. Products that are
removed from the list remain on previously recorded reservations.

Configuration guards:

- The QR caption is limited to 200 characters; blank resets it to the default.
- The department list requires at least one department and accepts at most 50
  departments of up to 30 characters each. Blank and duplicate lines are
  removed.
- The product list requires at least one product and accepts at most 50
  products of up to 50 characters each. Blank and duplicate lines are removed.
- Control characters are rejected, and all values are HTML-escaped on output.
- Settings writes require a signed, time-limited CSRF token and pass an origin
  check, because HTTP Basic credentials are attached to cross-site form posts.
- Invalid submissions re-render the form with an error and write nothing.
- Existing databases are migrated automatically by adding the `product` column
  and the `settings` table; existing records are preserved.

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
