'use strict';

const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { openDatabase } = require('../src/database');
const { QR_IMAGE_URL } = require('../src/pages');
const { TOKEN_TTL_MS } = require('../src/reservation-service');
const { DEFAULT_PRODUCTS, DEFAULT_QR_CAPTION } = require('../src/settings');

const reservation = {
  hospital: 'Beijing General Hospital',
  department: '内科',
  product: DEFAULT_PRODUCTS[0],
  name: '王小明',
  phone: '13812345678',
  note: 'Trial request',
};

async function createFixture(t, options = {}) {
  const db = openDatabase(':memory:');
  const app = createApp({
    db,
    adminUser: 'admin',
    adminPass: 'strong-test-password',
    rateLimit: 1000,
    ...options,
  });
  const server = http.createServer(app.handle);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    app.close();
    db.close();
  });
  return { db, baseURL: 'http://127.0.0.1:' + address.port };
}

async function request(baseURL, path, { method = 'GET', token, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = 'Bearer ' + token;
  if (body !== undefined && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  const response = await fetch(baseURL + path, {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { response, text, body: parsed };
}

function basicAuth() {
  return 'Basic ' + Buffer.from('admin:strong-test-password').toString('base64');
}

function csrfToken(html) {
  const match = /name="csrf" value="([^"]+)"/.exec(html);
  assert.ok(match, 'settings page should include a CSRF token');
  return match[1];
}

async function postSettings(baseURL, fields, headers = {}) {
  const response = await fetch(baseURL + '/admin/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(),
      ...headers,
    },
    body: new URLSearchParams(fields).toString(),
    redirect: 'manual',
  });
  return { response, text: await response.text() };
}

test('creates reservations and gives the browser an opaque token stored only as a hash', async (t) => {
  const { db, baseURL } = await createFixture(t);
  const result = await request(baseURL, '/api/reserve', { method: 'POST', body: reservation });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.match(result.body.accessToken, /^[A-Za-z0-9_-]{43}$/);
  const stored = db.prepare('SELECT token_hash, expires_at FROM device_tokens').get();
  assert.match(stored.token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.token_hash, result.body.accessToken);
  assert.equal(stored.expires_at > Date.now(), true);

  const listed = await request(baseURL, '/api/reservations', { token: result.body.accessToken });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.reservations.length, 1);
  assert.equal(listed.body.reservations[0].id, result.body.id);
  assert.equal(listed.body.reservations[0].hospital, reservation.hospital);
});

test('keeps new submissions as separate records and only returns the latest to the browser', async (t) => {
  const { db, baseURL } = await createFixture(t);
  const first = await request(baseURL, '/api/reserve', { method: 'POST', body: reservation });
  const token = first.body.accessToken;
  const second = await request(baseURL, '/api/reserve', {
    method: 'POST',
    token,
    body: { ...reservation, name: '李小明' },
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.body.accessToken, undefined);
  const unsupportedUpdate = await request(baseURL, '/api/reservations/' + first.body.id, {
    method: 'PUT',
    token,
    body: { ...reservation, name: '林小明' },
  });
  assert.equal(unsupportedUpdate.response.status, 404);
  const listed = await request(baseURL, '/api/reservations', { token });
  assert.equal(listed.body.reservations.length, 1);
  assert.equal(listed.body.reservations[0].id, second.body.id);
  assert.equal(listed.body.reservations[0].name, '李小明');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trialreservations').get().n, 2);
});

test('slides token expiry on use and rejects an expired token', async (t) => {
  let now = 1_800_000_000_000;
  const { db, baseURL } = await createFixture(t, { now: () => now });
  const created = await request(baseURL, '/api/reserve', { method: 'POST', body: reservation });
  const token = created.body.accessToken;
  const initialExpiry = db.prepare('SELECT expires_at FROM device_tokens').get().expires_at;
  assert.equal(initialExpiry, now + TOKEN_TTL_MS);

  now += 10 * 24 * 60 * 60 * 1000;
  const refreshed = await request(baseURL, '/api/reservations', { token });
  assert.equal(refreshed.response.status, 200);
  assert.equal(refreshed.body.expiresAt, now + TOKEN_TTL_MS);

  now = refreshed.body.expiresAt;
  const expired = await request(baseURL, '/api/reservations', { token });
  assert.equal(expired.response.status, 401);
  const rejectedCreate = await request(baseURL, '/api/reserve', {
    method: 'POST',
    token,
    body: reservation,
  });
  assert.equal(rejectedCreate.response.status, 401);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trialreservations').get().n, 1);

  const replacement = await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: { ...reservation, name: '李小明' },
  });
  assert.equal(replacement.response.status, 200);
  assert.notEqual(replacement.body.accessToken, token);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM trialreservations').get().n, 2);
  const latest = await request(baseURL, '/api/reservations', {
    token: replacement.body.accessToken,
  });
  assert.equal(latest.response.status, 200);
  assert.equal(latest.body.reservations.length, 1);
  assert.equal(latest.body.reservations[0].name, '李小明');
});

test('validates bodies, content type, body size, and authorization', async (t) => {
  const { baseURL } = await createFixture(t);
  assert.equal((await request(baseURL, '/api/reservations')).response.status, 401);
  assert.equal((await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: 'x'.repeat(65 * 1024),
  })).response.status, 413);
  assert.equal((await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: { ...reservation, hospital: 'AB' },
  })).response.status, 422);
  assert.equal((await request(baseURL, '/api/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{}',
  })).response.status, 415);
  assert.equal((await request(baseURL, '/api/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  })).response.status, 400);
  assert.equal((await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: 'x'.repeat(65 * 1024),
  })).response.status, 413);
  assert.equal((await request(baseURL, '/api/reserve', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'x'.repeat(65 * 1024),
  })).response.status, 413);
});

test('admin search, date filter, pagination, and export require authentication', async (t) => {
  const { db, baseURL } = await createFixture(t);
  const insert = db.prepare(`
    INSERT INTO trialreservations
      (hospital, department, name, phone, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (let day = 1; day <= 120; day += 1) {
    const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
    insert.run(
      day % 2 ? 'Needle Clinic' : 'Other Hospital',
      day % 2 ? '内科' : '外科',
      'Person ' + day,
      '13812345678',
      day === 12 ? '=1+1' : '',
      date + ' 12:00:00',
    );
  }

  assert.equal((await request(baseURL, '/admin')).response.status, 401);
  const filtered = await request(
    baseURL,
    '/admin?hospital=Needle&from=2026-01-10&to=2026-01-20',
    { headers: { Authorization: basicAuth() } },
  );
  assert.equal(filtered.response.status, 200);
  assert.match(filtered.text, /5 matching reservations/);
  assert.match(filtered.text, /Person 19/);
  const nameAndDepartment = await request(
    baseURL,
    '/admin?name=Person+1&department=%E5%86%85%E7%A7%91',
    { headers: { Authorization: basicAuth() } },
  );
  assert.match(nameAndDepartment.text, /Person 11/);
  assert.doesNotMatch(nameAndDepartment.text, /Person 12/);

  const pageTwo = await request(baseURL, '/admin?page=2', {
    headers: { Authorization: basicAuth() },
  });
  assert.match(pageTwo.text, /Page 2 of 2/);
  assert.match(pageTwo.text, /Person 5/);
  assert.match(pageTwo.text, /20 matching reservations/);
  assert.match(pageTwo.text, /100 per page/);
  assert.doesNotMatch(pageTwo.text, /Person 21/);

  const csv = await request(baseURL, '/admin/export.csv?from=2026-01-12&to=2026-01-12', {
    headers: { Authorization: basicAuth() },
  });
  assert.equal(csv.response.status, 200);
  assert.equal(csv.response.headers.get('x-export-truncated'), 'false');
  assert.equal(csv.text.split('\r\n').length, 2);
  assert.match(csv.text, /'=1\+1/);
});

test('admin query rendering escapes reflected search input', async (t) => {
  const { baseURL } = await createFixture(t);
  const response = await request(baseURL, '/admin?hospital=%3Cscript%3E', {
    headers: { Authorization: basicAuth() },
  });
  assert.equal(response.response.status, 200);
  assert.doesNotMatch(response.text, /value="<script>/);
  assert.match(response.text, /name="hospital" maxlength="100" value="&lt;script&gt;"/);
});

test('a single product is shown in the header and submitted without a picker', async (t) => {
  const { baseURL } = await createFixture(t);
  const home = await request(baseURL, '/');
  assert.doesNotMatch(home.text, /<select name="product"/);
  assert.match(home.text, /id="productName"/);
  assert.match(home.text, new RegExp(
    '<input type="hidden" name="product" value="' + DEFAULT_PRODUCTS[0] + '">',
  ));

  const accepted = await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: reservation,
  });
  assert.equal(accepted.response.status, 200);
});

test('settings page is authenticated and shows the built-in defaults', async (t) => {
  const { baseURL } = await createFixture(t);
  assert.equal((await request(baseURL, '/admin/settings')).response.status, 401);

  const page = await request(baseURL, '/admin/settings', {
    headers: { Authorization: basicAuth() },
  });
  assert.equal(page.response.status, 200);
  assert.match(page.text, new RegExp(DEFAULT_QR_CAPTION));
  assert.match(page.text, new RegExp(DEFAULT_PRODUCTS[0]));
  assert.match(page.text, /name="departments"[^>]*>超声科\n妇产科/);
  assert.match(page.text, /name="csrf" value="[^"]+"/);
  assert.match(page.text, /href="\.\.\/admin"/);
});

test('admin settings update the reservation page and product validation', async (t) => {
  const { db, baseURL } = await createFixture(t);
  const page = await request(baseURL, '/admin/settings', {
    headers: { Authorization: basicAuth() },
  });
  const token = csrfToken(page.text);

  const saved = await postSettings(baseURL, {
    csrf: token,
    qr_caption: '欢迎关注我们的公众号',
    departments: '科室甲\r\n科室乙\r\n\r\n科室甲',
    products: '产品A\r\n产品B\r\n\r\n产品A',
  });
  assert.equal(saved.response.status, 303);
  assert.equal(saved.response.headers.get('location'), 'settings?saved=1');
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'qr_caption'").get().value,
    '欢迎关注我们的公众号');
  assert.deepEqual(
    JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'departments'").get().value),
    ['科室甲', '科室乙'],
  );
  assert.deepEqual(
    JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'products'").get().value),
    ['产品A', '产品B'],
  );

  const home = await request(baseURL, '/');
  assert.match(home.text, /欢迎关注我们的公众号/);
  assert.match(home.text, /<option value="科室甲">科室甲<\/option>/);
  assert.match(home.text, /<option value="产品A">产品A<\/option>/);
  assert.match(home.text, /<option value="产品B">产品B<\/option>/);
  assert.doesNotMatch(home.text, /妇产科/);
  assert.doesNotMatch(home.text, new RegExp(DEFAULT_QR_CAPTION));

  const accepted = await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: { ...reservation, department: '科室乙', product: '产品B' },
  });
  assert.equal(accepted.response.status, 200);
  const rejectedProduct = await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: { ...reservation, department: '科室乙', product: '不在列表' },
  });
  assert.equal(rejectedProduct.response.status, 422);
  const rejectedDepartment = await request(baseURL, '/api/reserve', {
    method: 'POST',
    body: { ...reservation, department: '内科', product: '产品B' },
  });
  assert.equal(rejectedDepartment.response.status, 422);

  const savedPage = await request(baseURL, '/admin/settings?saved=1', {
    headers: { Authorization: basicAuth() },
  });
  assert.match(savedPage.text, /Settings saved\./);
});

test('settings changes reject missing CSRF tokens, foreign origins, and invalid lists', async (t) => {
  const { db, baseURL } = await createFixture(t);
  const page = await request(baseURL, '/admin/settings', {
    headers: { Authorization: basicAuth() },
  });
  const token = csrfToken(page.text);

  const noToken = await postSettings(baseURL, { qr_caption: 'x', products: 'A' });
  assert.equal(noToken.response.status, 403);

  const tampered = await postSettings(baseURL, {
    csrf: token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'),
    qr_caption: 'x',
    products: 'A',
  });
  assert.equal(tampered.response.status, 403);

  const foreignOrigin = await postSettings(baseURL, {
    csrf: token,
    qr_caption: 'x',
    products: 'A',
  }, { Origin: 'https://evil.test' });
  assert.equal(foreignOrigin.response.status, 403);

  const blankProducts = await postSettings(baseURL, {
    csrf: token,
    qr_caption: 'x',
    departments: '内科',
    products: '\n  \n',
  });
  assert.equal(blankProducts.response.status, 422);
  assert.match(blankProducts.text, /At least one product is required/);
  // Invalid submissions never write partial state.
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM settings').get().n, 0);

  const wrongType = await fetch(baseURL + '/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Authorization: basicAuth() },
    body: 'csrf=' + token,
  });
  assert.equal(wrongType.status, 415);
});

test('serves the WeChat official account QR code image', async (t) => {
  const { baseURL } = await createFixture(t);
  const response = await fetch(baseURL + '/' + QR_IMAGE_URL);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
  assert.ok((await response.arrayBuffer()).byteLength > 0);
});

test('enforces the per-IP mutation rate limit', async (t) => {
  const { baseURL } = await createFixture(t, { rateLimit: 1 });
  const first = await request(baseURL, '/api/reserve', { method: 'POST', body: reservation });
  assert.equal(first.response.status, 200);
  const second = await request(baseURL, '/api/reserve', { method: 'POST', body: reservation });
  assert.equal(second.response.status, 429);
});
