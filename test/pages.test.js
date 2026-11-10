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
  assert.match(html, /fetch\('api\/reservations\?type=' \+ encodeURIComponent\(RESERVATION_TYPE\)/);
  assert.match(html, /id="viewPreviousBtn">查看上次预约信息/);
  assert.match(html, /id="createNewBtn">创建新的预约/);
  assert.match(html, /formTitle\.textContent = usePrevious \? '修改上次预约' : '新建预约'/);
  assert.match(html, /submitBtn\.textContent = usePrevious \? '保存修改' : '提交预约'/);
  assert.doesNotMatch(html, /保存后将更新此设备显示的最新预约信息/);
  assert.doesNotMatch(html, /id="revisionHint"/);
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
  assert.match(html, /name="demo_products"[^>]*>住院医师规范化培训系统<\/textarea>/);
  assert.match(html, /name="demo_notice"[^>]*>预约产品演示/);
  assert.match(html, /name="csrf" value="token\+&quot;value"/);
  assert.match(html, /method="post" action=""/);
  assert.match(html, /<a class="tab" href="\.\.\/admin">Reservations<\/a>/);
  assert.match(html, /<a class="tab active" href="settings" aria-current="page">Settings<\/a>/);
});

test('the demo page uses its own title, product label, and attention text', () => {
  const notice = '预约产品演示, 本系统不提供试用, 可备注业务场景, 我们针对性演示.';
  const html = renderReservationPage(['内科'], {
    type: 'demo',
    products: ['住院医师规范化培训系统'],
    noteNotice: notice,
  });
  assert.match(html, /<h1>产品演示预约<\/h1>/);
  assert.match(html, /<title>住院医师规范化培训系统 - 产品演示预约<\/title>/);
  assert.match(html, /演示产品：<strong>住院医师规范化培训系统<\/strong>/);
  assert.match(html, new RegExp(
    '<p class="note-notice" id="noteNotice"><strong>' + notice + '</strong></p>',
  ));
  assert.match(html, /var RESERVATION_TYPE = "demo"/);
  assert.match(html, /本次演示安排/);
  // The note is never pre-filled; the notice is a separate callout.
  assert.match(html, /<textarea name="note"[^>]*><\/textarea>/);

  const trial = renderReservationPage(['内科'], { noteNotice: notice });
  assert.match(trial, /<h1>产品试用预约<\/h1>/);
  assert.doesNotMatch(trial, /noteNotice/);
  assert.doesNotMatch(trial, /预约产品演示/);
});

test('the note box offers a near-full-screen editor when text overflows', () => {
  const html = renderReservationPage(['内科']);
  assert.match(html, /id="noteField"/);
  assert.match(html, /id="noteExpandBtn"/);
  assert.match(html, /id="noteEditor" role="dialog" aria-modal="true"/);
  assert.match(html, /id="noteEditorInput" maxlength="500"/);
  assert.match(html, /noteExpandBtn\.hidden = noteField\.scrollHeight <= noteField\.clientHeight \+ 1/);
  assert.match(html, /noteEditor\.hidden = false/);
  assert.match(html, /document\.body\.classList\.add\('editing-note'\)/);
  assert.match(html, /noteField\.value = noteEditorInput\.value/);
  assert.match(html, /event\.key === 'Escape'/);
});

test('admin export and pagination preserve a deployed subpath and filters', () => {
  const filters = {
    name: 'Alice',
    hospital: 'Clinic',
    department: '内科',
    product: '产品A',
    type: 'demo',
    from: '2026-01-01',
    to: '2026-01-31',
    page: 1,
  };
  const html = renderAdminPage({ rows: [], total: 0, page: 1, pages: 1 }, filters, {
    products: ['产品A', '产品B'],
  });
  const exportHref = html.match(/href="(admin\/export\.csv[^"]*)"/)[1]
    .replaceAll('&amp;', '&');
  assert.equal(
    new URL(exportHref, 'https://example.test/trialreserve/admin').pathname,
    '/trialreserve/admin/export.csv',
  );
  assert.match(exportHref, /name=Alice/);
  assert.match(exportHref, /department=%E5%86%85%E7%A7%91/);
  assert.match(exportHref, /product=%E4%BA%A7%E5%93%81A/);
  assert.match(exportHref, /type=demo/);
  assert.match(html, /class="button-link" href="admin\/export\.csv/);
  assert.match(html, /<select name="product">/);
  assert.match(html, /<option value="产品A" selected>产品A<\/option>/);
  assert.match(html, /<select name="type">/);
  assert.match(html, /<option value="demo" selected>演示<\/option>/);
  assert.match(html, /<th>Type<\/th>/);
  assert.match(html, /Page 1 of 1; 100 per page/);
  assert.match(html, /<a class="tab active" href="admin" aria-current="page">Reservations<\/a>/);
  assert.match(html, /<a class="tab" href="admin\/settings">Settings<\/a>/);
});
