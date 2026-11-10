# TODO — Text configuration and reservation-type templates

Date: 2026-11-10
Status: analysis only, no code changed
Related: `docs/261010-changes-readme.md`, `src/reservation-types.js`, `src/settings.js`

## 1. Goal

Answer three questions:

1. How much text in the product is hardcoded?
2. How much of it can be moved into a configuration/structure file?
3. Can templates support new reservation types (trial/demo) and new products
   (trial A/B/C, demo 1/2/3) without editing JavaScript?

## 2. Hardcoded text inventory

Counts are literal strings, not occurrences. Repeated strings are counted once
per file. Structural values (paths, keys, SQL, table names) are excluded unless
noted.

| File | Count | Kinds of text |
| --- | ---: | --- |
| `src/pages/reservation.js` | ~46 | Public page headings, labels, placeholders, buttons, returning/success copy, privacy template, 12 browser-side error messages |
| `src/reservation-types.js` | 14 | Per-type display fields (title, short label, product label, privacy verb, notification title) and two demo defaults |
| `src/settings.js` | 15 | 4 built-in defaults (QR caption, departments, trial products, demo notice) and 11 validation messages |
| `src/pages/admin-reservations.js` | ~20 | Filter labels, table headers, pager, export label, empty state |
| `src/pages/admin-settings.js` | ~19 | Field labels, help text, default previews, page title |
| `src/pages/layout.js` | 3 | Tab labels and the navigation aria-label |
| `src/pages/csv.js` | 9 | CSV header row (type values come from type config) |
| `src/notifications.js` | 6 | WeCom field labels (医院/科室/产品/姓名/电话/说明) |
| `src/reservation-validation.js` | 11 | Chinese validation messages |
| `src/app.js` | 8 | API error messages (`Not Found`, token/type/rate-limit errors) |
| `src/admin-router.js` | 7 | Auth, CSRF, method, and not-found messages |
| `src/admin-query.js` | 5 | Filter validation messages |
| `src/http-utils.js` | 7 | Body/Content-Type/JSON error messages |
| `src/server.js` | 4 | Startup log lines |
| **Total** | **~174** | |

Rough split by role:

| Role | Approx. count | Should it move to config? |
| --- | ---: | --- |
| Public/admin presentational copy | ~117 | Yes — one copy catalog |
| Validation and API error messages | ~45 | Optional — move as keyed catalog, low value while admin UI is English-only |
| Structural identifiers (setting keys, localStorage key, API paths, SQL defaults, table headers tied to schema) | ~12 | No — keep in code |
| Already runtime-editable via `/admin/settings` | 5 | Already done: QR caption, departments, trial products, demo products, demo notice |

**Answer 1:** about 174 hardcoded literals. Only 5 of them (≈3%) are editable
without a deploy today.

**Answer 2:** about 162 of 174 (≈93%) could live in a configuration file.
About 117 are worth extracting now as user-facing copy; ~45 error messages can
follow; ~12 are structural and should stay in code. A single
`config/copy.zh-CN.json` (or `config/copy.json`) plus a small loader would cover
the public page, admin pages, CSV headers, and notification labels.

## 3. Where types are hardcoded today

`src/reservation-types.js` is a good first step, but it is not sufficient as a
template source. Adding a third type still requires edits in at least these
places:

| Location | Hardcoding |
| --- | --- |
| `src/app.js:29-34` | `productsForType()` compares `config.productsSetting === 'demo_products'` |
| `src/app.js:68` | `type === 'demo' ? settings.demoNotice : ''` |
| `src/admin-query.js:26` | Valid values are literally `trial` and `demo` |
| `src/pages/admin-reservations.js:8-12` | `typeLabel()` hardcodes the two keys |
| `src/admin-router.js:90-100` | Form fields `demo_products` / `demo_notice` are named explicitly |
| `src/pages/admin-settings.js:30-68` | Demo product/notice sections are written out explicitly |
| `src/settings.js:94-141` | `validateSettings` has explicit `demoProducts` / `demoNotice` fields |
| `src/settings.js:187-199` | `getSettings` returns explicit per-type fields |
| `src/reservation-service.js:59` | Missing type defaults to the literal `'trial'` |
| `src/database.js:14,43` | Column default is the literal `'trial'` |

Things that are already type-agnostic and can stay as-is:

- `trialreservations.type` is a free-form text column.
- `listReservations(..., type)` filters by any type key.
- Admin type dropdown loops over `RESERVATION_TYPES`.
- CSV and WeCom notifications read the short label / heading from config.
- The browser token is shared across types; separate history already works
  because the query filters by type.

## 4. Where products are hardcoded today

Almost nowhere. Products are runtime data:

- Trial list: `settings.products`
- Demo list: `settings.demo_products`
- Both editable at `/admin/settings`; at least one is required.
- Admin filter merges configured + previously recorded products.

So **new products need no template work today**: enter `A`, `B`, `C` one per
line under Products (trial) or Demo products. That already yields a selector,
validation, storage, CSV, filter, and notification support.

The only product-related limits are:

1. The form fields are identical for every product. Per-product descriptions,
   notices, or extra fields are not supported.
2. Each type has one product list; there is no product category/group.
3. The product is a flat string; there is no stable product ID, so renaming a
   product splits historical records.

If per-product content is wanted, the settings value must change from
`string[]` to an object list, e.g.:

```json
[
  { "id": "trial-a", "label": "试用产品 A", "notice": "", "enabled": true },
  { "id": "trial-b", "label": "试用产品 B", "notice": "", "enabled": true }
]
```

That is a separate feature and a settings-schema migration. It is **not**
required for the A/B/C / 1/2/3 request as stated.

## 5. Can templates support new types and products?

**Products: yes, today.** No code change, no template change.

**New types: almost, after one generalization pass.** The data model already
supports arbitrary type keys. The remaining work is removing the `trial`/`demo`
special cases so a type is defined entirely by configuration.

### Proposed type template

```json
{
  "defaultType": "trial",
  "types": [
    {
      "key": "trial",
      "enabled": true,
      "order": 10,
      "title": "产品试用预约",
      "shortLabel": "试用",
      "productLabel": "试用产品",
      "privacyVerb": "试用",
      "notificationTitle": "新的试用预约",
      "notice": "",
      "products": ["超声探头隔离膜智换系统"]
    },
    {
      "key": "demo",
      "enabled": true,
      "order": 20,
      "title": "产品演示预约",
      "shortLabel": "演示",
      "productLabel": "演示产品",
      "privacyVerb": "演示",
      "notificationTitle": "新的演示预约",
      "notice": "预约产品演示, 本系统不提供试用, 可备注业务场景, 我们针对性演示.",
      "products": ["住院医师规范化培训系统"]
    }
  ]
}
```

With this shape:

- `?type=<key>` resolves against `types`.
- `productsForType` becomes `typeConfig.products` or a generic
  `products:<key>` settings row.
- The notice is a generic per-type field, not a demo-only field. Trial simply
  has an empty notice.
- Admin settings renders one product textarea and one notice textarea per
  configured type by looping.
- Admin unit filter values and labels come from the same list.
- CSV and WeCom headings keep using `shortLabel` / `notificationTitle`.
- Adding `expo` = add one object; no JS changes.

### Template rendering

The public page is one large template literal. Two viable levels:

1. **Config-driven single template (recommended).** Keep one HTML template
   with slots; per-type differences are data (`title`, `productLabel`,
   `notice`, `privacyVerb`). This covers trial/demo/expo and adds no dependency.
2. **Per-type HTML templates.** Add `config/templates/<key>.html` with a tiny
   `{{placeholder}}` renderer. Useful only if a new type needs a different
   form structure. More files, more validation, more escaping surface.

Recommendation: do (1) now; leave (2) as a future option. Node has no built-in
template engine, and adding one would break the "no npm dependencies"
constraint unless a small local renderer is written.

### Configuration source

The existing `settings` table is the right home for editable content
(departments, products, notices, QR caption). It should not hold the type
registry itself, because a bad admin edit could remove the last usable type.
Recommended split:

- `config/reservation-types.json` — type registry, read at startup, validated,
  requires restart to change.
- `settings` table — per-type products/notices and global copy, editable in
  admin without restart.
- `config/copy.zh-CN.json` — static UI copy (labels, placeholders, errors),
  read at startup.

If runtime-editable types are required instead, types must live in SQLite with
strict validation and a fallback to the built-in registry when the stored value
is invalid.

## 6. Proposed TODO phases

### Phase 0 — inventory (done)
- [x] Count hardcoded strings by file.
- [x] Identify type/product coupling points.
- [x] Decide config vs code boundary.

### Phase 1 — copy catalog, no behavior change
- [ ] Add `config/copy.zh-CN.json` with public page, admin page, CSV header,
      and notification labels.
- [ ] Add a loader that validates keys and falls back to built-in defaults.
- [ ] Replace literals with lookups.
- [ ] Keep every rendered value HTML-escaped.
- [ ] Tests: assert rendered output is unchanged for the current Chinese copy.

### Phase 2 — generalize reservation types
- [ ] Extend the type config with `enabled`, `order`, `notice`, `products`.
- [ ] Remove `type === 'demo'` and the `productsSetting` branch.
- [ ] Generalize settings validation and storage to arbitrary type keys
      (`demo_products` may remain as the initial value for `demo`).
- [ ] Generalize admin filters and type labels.
- [ ] Generate admin settings fields by looping over types.
- [ ] Add a third test-only type (e.g. `expo`) and prove it works end-to-end
      without touching server code.

### Phase 3 — optional product objects
- [ ] Decide whether products need IDs, per-product notices, or enable flags.
- [ ] If yes, migrate `string[]` settings to object arrays with backward
      compatibility for plain strings.

### Phase 4 — docs and tests
- [ ] Document the config schema and how to add a type/product.
- [ ] Add a test that a new type entry alone produces a working page, API
      validation, admin filter, CSV value, and notification heading.
- [ ] Keep the existing 49 tests green.

## 7. Decisions needed before implementation

1. **Type registry location:** config file (restart to change) vs SQLite
   (admin-editable at runtime)? Recommendation: config file.
2. **Should notices be per type, per product, or both?** Current request only
   needs per type.
3. **Should the admin UI stay English** while the public page is Chinese? If
   yes, extracting admin copy is optional.
4. **Is i18n ever needed** (zh-CN + English), or is zh-CN the only target? This
   determines whether the catalog is `copy.json` or `copy.<locale>.json`.
5. **Should removed types remain viewable?** Historical rows must still render
   a type label; keep short labels for disabled/removed keys in the registry.
6. **Product identity:** is renaming a product expected? If yes, stable product
   IDs are needed; if no, flat strings are enough.

## 8. Estimates

| Work | Files touched | Risk |
| --- | --- | --- |
| Copy catalog | ~8 source files + new config/loader + tests | Low; no behavior change |
| Generalize types | ~7 source files + tests | Medium; settings/admin form changes |
| Third type end-to-end | config only after Phase 2 | Low |
| Product objects | settings + validation + admin form + migration | Medium-high; data migration |

Recommended order: Phase 1, then Phase 2. Do not start Phase 3 until product
renaming/per-product content is actually required.
