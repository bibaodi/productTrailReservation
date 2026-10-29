'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/database');
const {
  DEFAULT_DEPARTMENTS,
  DEFAULT_PRODUCTS,
  DEFAULT_QR_CAPTION,
  getSettings,
  saveSettings,
  validateSettings,
} = require('../src/settings');

function withDatabase(fn) {
  const db = openDatabase(':memory:');
  try {
    fn(db);
  } finally {
    db.close();
  }
}

test('returns built-in defaults when nothing has been configured or values are corrupt', () => {
  withDatabase((db) => {
    assert.deepEqual(getSettings(db), {
      qrCaption: DEFAULT_QR_CAPTION,
      departments: DEFAULT_DEPARTMENTS.slice(),
      products: DEFAULT_PRODUCTS.slice(),
    });

    db.prepare("INSERT INTO settings (key, value) VALUES ('departments', ?)").run('[]');
    db.prepare("INSERT INTO settings (key, value) VALUES ('products', ?)").run('{broken');
    db.prepare("INSERT INTO settings (key, value) VALUES ('qr_caption', ?)").run('坏\u0007字符');
    assert.deepEqual(getSettings(db), {
      qrCaption: DEFAULT_QR_CAPTION,
      departments: DEFAULT_DEPARTMENTS.slice(),
      products: DEFAULT_PRODUCTS.slice(),
    });
  });
});

test('rewrites the legacy reversed-quote QR caption on startup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-settings-'));
  const dbPath = path.join(dir, 'settings.db');
  try {
    const first = openDatabase(dbPath);
    first.prepare("INSERT INTO settings (key, value) VALUES ('qr_caption', ?)")
      .run('为了可以与我们保持联系，请您关注”即时超声“公众号');
    first.close();

    const second = openDatabase(dbPath);
    assert.equal(
      second.prepare("SELECT value FROM settings WHERE key = 'qr_caption'").get().value,
      DEFAULT_QR_CAPTION,
    );
    assert.equal(DEFAULT_QR_CAPTION, '为了可以与我们保持联系，请您关注“即时超声”公众号');
    second.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('normalizes, saves, and reloads settings', () => {
  withDatabase((db) => {
    const validation = validateSettings({
      qrCaption: '  关注公众号  ',
      departments: '  内科 \r\n外科\n内科\n\n',
      products: '  产品A \r\n产品B\n产品A\n\n',
    });
    assert.deepEqual(validation.ok, {
      qrCaption: '关注公众号',
      departments: ['内科', '外科'],
      products: ['产品A', '产品B'],
    });
    saveSettings(db, validation.ok);
    assert.deepEqual(getSettings(db), validation.ok);

    const reset = validateSettings({
      qrCaption: '   ', departments: '科室C', products: '产品C',
    });
    assert.equal(reset.ok.qrCaption, DEFAULT_QR_CAPTION);
  });
});

test('rejects unsafe or oversized settings', () => {
  const longDepartment = '科'.repeat(31);
  const longProduct = '产'.repeat(51);
  const departments = '内科';
  for (const input of [
    { qrCaption: 'x'.repeat(201), departments, products: 'A' },
    { qrCaption: 'bad\ncaption', departments, products: 'A' },
    { qrCaption: 'ok', departments: '', products: 'A' },
    { qrCaption: 'ok', departments: '\n\n', products: 'A' },
    { qrCaption: 'ok', departments: longDepartment, products: 'A' },
    { qrCaption: 'ok', departments: 'bad\u0000department', products: 'A' },
    { qrCaption: 'ok', departments: Array.from({ length: 51 }, (_, i) => '科室' + i).join('\n'), products: 'A' },
    { qrCaption: 'ok', departments: [42], products: 'A' },
    { qrCaption: 'ok', departments, products: '' },
    { qrCaption: 'ok', departments, products: '\n\n' },
    { qrCaption: 'ok', departments, products: longProduct },
    { qrCaption: 'ok', departments, products: 'bad\u0000product' },
    { qrCaption: 'ok', departments, products: Array.from({ length: 51 }, (_, i) => '产品' + i).join('\n') },
    { qrCaption: 'ok', departments, products: [42] },
  ]) {
    assert.ok(validateSettings(input).err, JSON.stringify(input));
  }
});
