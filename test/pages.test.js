'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderAdminPage, renderReservationPage } = require('../src/pages');

test('reservation API URLs remain relative to a deployed subpath', () => {
  const html = renderReservationPage(['内科']);
  assert.match(html, /'api\/reserve'/);
  assert.match(html, /fetch\('api\/reservations'/);
  assert.match(html, /id="viewPreviousBtn">查看上次预约信息/);
  assert.match(html, /id="createNewBtn">创建新的预约/);
  assert.match(html, /formTitle\.textContent = usePrevious \? '修改上次预约' : '新建预约'/);
  assert.match(html, /submitBtn\.textContent = usePrevious \? '保存修改' : '提交预约'/);
  assert.match(html, /id="revisionHint" class="hint" hidden>保存后将更新此设备显示的最新预约信息，之前提交的记录仍会保留。/);
  assert.match(html, /id="successHospital"/);
  assert.match(html, /id="successName"/);
  assert.match(html, /fetch\('api\/reserve', \{\s*method: 'POST'/);
  assert.doesNotMatch(html, /method: 'PUT'|取消修改|修改此预约/);
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
  assert.match(html, /class="button-link" href="admin\/export\.csv/);
  assert.match(html, /Page 1 of 1; 100 per page/);
});
