# Security Review Summary

## Scope and outcome

The review covered the reservation application changes, including request
validation, browser-token access, admin queries, HTML/CSV output, and WeCom
notifications. One medium-severity issue was identified and fixed. A follow-up
review found no remaining concrete high-confidence security issues.

## Finding

| # | Severity | File | Vulnerability | Status |
|---|----------|------|---------------|--------|
| 1 | MEDIUM | `src/notifications.js` | User-controlled reservation fields were inserted into WeCom Markdown notifications without escaping. A submitted value could alter the message's formatting, add links, or trigger mentions. | Fixed |

The notifier now replaces Markdown syntax and mention/link punctuation in
reservation fields with fullwidth characters before composing the notification.
Regression coverage is in `test/notifications.test.js`.

## Verification

- The notification tests verify that Markdown links, formatting syntax, and
  `@all`-style mentions in user-supplied values are neutralized.
- The final follow-up review reported no remaining concrete high-confidence
  security or logic issues.
