'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAdminFilters } = require('../src/admin-query');

test('parses empty and valid admin filters', () => {
  assert.deepEqual(parseAdminFilters(new URLSearchParams()), {
    ok: { name: '', hospital: '', department: '', product: '', from: '', to: '', page: 1 },
  });
  assert.deepEqual(parseAdminFilters(new URLSearchParams(
    'name=Jane&hospital=clinic&department=cardiology&product=probe&from=2026-01-01&to=2026-01-31&page=2'
  )), {
    ok: {
      name: 'Jane',
      hospital: 'clinic',
      department: 'cardiology',
      product: 'probe',
      from: '2026-01-01',
      to: '2026-01-31',
      page: 2,
    },
  });
});

test('rejects invalid dates, reversed ranges, oversized search, and invalid pages', () => {
  for (const query of [
    'from=2026-02-30',
    'to=20260101',
    'from=2026-02-02&to=2026-02-01',
    'page=0',
    'page=-1',
    'page=1.5',
    'page=10000000',
    'name=' + 'x'.repeat(101),
    'product=' + 'x'.repeat(101),
  ]) {
    assert.ok(parseAdminFilters(new URLSearchParams(query)).err, query);
  }
});
