'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderAdminPage, renderReservationPage } = require('../src/pages');

test('reservation API URLs remain relative to a deployed subpath', () => {
  const html = renderReservationPage(['内科']);
  assert.match(html, /'api\/reserve'/);
  assert.match(html, /fetch\('api\/reservations'/);
  assert.equal(
    new URL('api/reserve', 'https://example.test/trialreserve/').pathname,
    '/trialreserve/api/reserve',
  );
});

test('admin export and pagination preserve a deployed subpath and filters', () => {
  const filters = {
    name: 'Alice',
    hospital: 'Clinic',
    department: '内科',
    from: '2026-01-01',
    to: '2026-01-31',
    page: 1,
  };
  const html = renderAdminPage({ rows: [], total: 0, page: 1, pages: 1 }, filters);
  const exportHref = html.match(/href="(admin\/export\.csv[^"]*)"/)[1]
    .replaceAll('&amp;', '&');
  assert.equal(
    new URL(exportHref, 'https://example.test/trialreserve/admin').pathname,
    '/trialreserve/admin/export.csv',
  );
  assert.match(exportHref, /name=Alice/);
  assert.match(exportHref, /department=%E5%86%85%E7%A7%91/);
});
