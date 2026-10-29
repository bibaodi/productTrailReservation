'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  QR_IMAGE_URL,
  renderAdminPage,
  renderReservationPage,
  renderSettingsPage,
} = require('../src/pages');
const { DEFAULT_DEPARTMENTS, DEFAULT_PRODUCTS, DEFAULT_QR_CAPTION } = require('../src/settings');

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
  assert.match(html, new RegExp(DEFAULT_QR_CAPTION));
  assert.match(html, /id="qrCaption"/);
  assert.match(html, /id="qrcodeImg" class="qrcode" alt="即时超声公众号二维码"/);
  assert.equal(QR_IMAGE_URL, 'imgs/wechat-official-account-qrcode_for_gh_4b320bf4dce6_1280.jpg');
  assert.match(html, new RegExp('data-src="' + QR_IMAGE_URL + '"'));
  assert.match(html, /qrcode\.setAttribute\('src', qrcode\.getAttribute\('data-src'\)\)/);
  assert.equal(
    new URL(QR_IMAGE_URL, 'https://example.test/trialreserve/').pathname,
    '/trialreserve/' + QR_IMAGE_URL,
  );
});

test('reservation form renders configured products and escapes them', () => {
  const html = renderReservationPage(['内科'], {
    products: ['产品A', '<script>alert(1)</script>'],
    qrCaption: '<b>关注</b>',
  });
  assert.match(html, /<select name="product" required>/);
  assert.match(html, /<option value="">请选择产品<\/option>/);
  assert.match(html, /<option value="产品A">产品A<\/option>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /id="qrCaption">&lt;b&gt;关注&lt;\/b&gt;<\/p>/);
  assert.match(html, /form\.product\.value = latestReservation\.product \|\| ''/);
  assert.match(html, /if \(!data\.product\) return '请选择产品';/);
  // A stale browser token is discarded and retried once automatically.
  assert.match(html, /result\.status === 401 && allowTokenRetry/);
  assert.match(html, /return sendReservation\(data, false\)/);
});

test('the edit form only enables saving after a valid change', () => {
  const html = renderReservationPage(['内科']);
  assert.match(html, /id="saveStateHint" class="hint" hidden/);
  assert.match(html, /var formMode = 'create'/);
  assert.match(html, /var originalData = null/);
  assert.match(html, /function sameReservation/);
  assert.match(html, /function validPhone/);
  assert.match(html, /function validateReservation/);
  assert.match(html, /function updateSubmitState/);
  assert.match(html, /信息未变更，无需保存。/);
  assert.match(html, /submitBtn\.disabled = true/);
  assert.match(html, /originalData && sameReservation\(data, originalData\)/);
  assert.match(html, /formMode === 'edit' && originalData && sameReservation\(data, originalData\)/);
  assert.match(html, /form\.addEventListener\('input', updateSubmitState\)/);
  assert.match(html, /form\.addEventListener\('change', updateSubmitState\)/);
  assert.match(html, /formMode = usePrevious \? 'edit' : 'create'/);
  assert.deepEqual(DEFAULT_PRODUCTS, ['超声探头隔离膜智换系统']);
});

test('a single product is shown in the header without a picker', () => {
  const onlyProduct = renderReservationPage(['科室甲', '科室乙'], {
    products: ['唯一产品'],
  });
  assert.doesNotMatch(onlyProduct, /<select name="product"/);
  assert.doesNotMatch(onlyProduct, /<option value="">请选择产品<\/option>/);
  assert.match(onlyProduct,
    /<p class="product" id="productName">试用产品：<strong>唯一产品<\/strong><\/p>/);
  assert.match(onlyProduct,
    /<input type="hidden" name="product" value="唯一产品">/);
  assert.match(onlyProduct, /<title>唯一产品 - 产品试用预约<\/title>/);
  assert.match(onlyProduct, /<option value="科室甲">科室甲<\/option>/);
  assert.match(onlyProduct, /<option value="科室乙">科室乙<\/option>/);
  assert.doesNotMatch(onlyProduct, /超声科/);
  assert.match(onlyProduct, /if \(form\.product && form\.product\.tagName === 'SELECT'\)/);

  const fallback = renderReservationPage([], { products: [] });
  for (const department of DEFAULT_DEPARTMENTS) {
    assert.match(fallback, new RegExp('<option value="' + department + '">'));
  }
  assert.match(fallback,
    new RegExp('<input type="hidden" name="product" value="' + DEFAULT_PRODUCTS[0] + '">'));
});

test('settings page escapes stored values and embeds a CSRF token', () => {
  const html = renderSettingsPage({
    qrCaption: '<script>alert(1)</script>',
    departments: ['科室A', '科室B'],
    products: ['产品A', '产品B'],
  }, { csrfToken: 'token+"value' });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /name="departments"[^>]*>科室A\n科室B<\/textarea>/);
  assert.match(html, /name="products"[^>]*>产品A\n产品B<\/textarea>/);
  assert.match(html, /name="csrf" value="token\+&quot;value"/);
  assert.match(html, /method="post" action=""/);
  assert.match(html, /<a class="tab" href="\.\.\/admin">Reservations<\/a>/);
  assert.match(html, /<a class="tab active" href="settings" aria-current="page">Settings<\/a>/);
});

test('admin export and pagination preserve a deployed subpath and filters', () => {
  const filters = {
    name: 'Alice',
    hospital: 'Clinic',
    department: '内科',
    product: '产品A',
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
  assert.match(exportHref, /product=%E4%BA%A7%E5%93%81A/);
  assert.match(html, /class="button-link" href="admin\/export\.csv/);
  assert.match(html, /<th>Product<\/th>/);
  assert.match(html, /Page 1 of 1; 100 per page/);
  assert.match(html, /<a class="tab active" href="admin" aria-current="page">Reservations<\/a>/);
  assert.match(html, /<a class="tab" href="admin\/settings">Settings<\/a>/);
});
