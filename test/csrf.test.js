'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCSRF, TOKEN_MAX_AGE_MS } = require('../src/csrf');

test('issues verifiable tokens that are bound to the admin secret', () => {
  const csrf = createCSRF('admin-password');
  const now = 1_800_000_000_000;
  const token = csrf.issue(now);
  assert.match(token, /^\d{10,16}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(csrf.verify(token, now), true);
  assert.equal(createCSRF('other-password').verify(token, now), false);
});

test('rejects tampered, malformed, expired, and future tokens', () => {
  const csrf = createCSRF('admin-password');
  const now = 1_800_000_000_000;
  const token = csrf.issue(now);

  assert.equal(csrf.verify(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), now), false);
  assert.equal(csrf.verify('', now), false);
  assert.equal(csrf.verify('not-a-token', now), false);
  assert.equal(csrf.verify(null, now), false);
  assert.equal(csrf.verify(token, now + TOKEN_MAX_AGE_MS + 1), false);
  assert.equal(csrf.verify(token, now - 5 * 60 * 1000), false);
});
