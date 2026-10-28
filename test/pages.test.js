'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { QR_IMAGE_URL, renderAdminPage, renderReservationPage } = require('../src/pages');

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
  assert.match(html, /<p class="sub" id="subtitle">请留下您的信息，我们会尽快与您联系<\/p>/);
  assert.match(html, /subtitle\.hidden = true;/);
  assert.match(html, /subtitle\.hidden = false;/);
  assert.match(html, /fetch\('api\/reserve', \{\s*method: 'POST'/);
  assert.doesNotMatch(html, /method: 'PUT'|取消修改|修改此预约/);
  assert.equal(
    new URL('api/reserve', 'https://example.test/trialreserve/').pathname,
    '/trialreserve/api/reserve',
  );
});

test('success prompt invites the user to follow the WeChat account with a QR code', () => {
  const html = renderReservationPage(['内科']);
  assert.match(html, /为了与我们保持更多联系，欢迎关注即时超声公众号/);
  assert.match(html, /id="qrcodeImg" class="qrcode" alt="即时超声公众号二维码"/);
  assert.equal(QR_IMAGE_URL, 'imgs/wechat-official-account-qrcode_for_gh_4b320bf4dce6_1280.jpg');
  assert.match(html, new RegExp('data-src="' + QR_IMAGE_URL + '"'));
  assert.match(html, /qrcode\.setAttribute\('src', qrcode\.getAttribute\('data-src'\)\)/);
  assert.equal(
    new URL(QR_IMAGE_URL, 'https://example.test/trialreserve/').pathname,
    '/trialreserve/' + QR_IMAGE_URL,
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
