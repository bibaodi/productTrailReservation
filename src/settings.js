'use strict';

const DEFAULT_QR_CAPTION = '为了可以与我们保持联系，请您关注“即时超声”公众号';
// The first release of this setting shipped with reversed quotation marks.
// Rewrite that exact stored value once so existing deployments show the
// corrected text without requiring an admin to edit it.
const LEGACY_QR_CAPTIONS = Object.freeze([
  '为了可以与我们保持联系，请您关注”即时超声“公众号',
]);
const DEFAULT_DEPARTMENTS = Object.freeze([
  '超声科', '妇产科', '体检中心', '外科', '内科', '其他',
]);
const DEFAULT_PRODUCTS = Object.freeze(['超声探头隔离膜智换系统']);

const MAX_QR_CAPTION_LENGTH = 200;
const MAX_DEPARTMENTS = 50;
const MAX_DEPARTMENT_LENGTH = 30;
const MAX_PRODUCTS = 50;
const MAX_PRODUCT_LENGTH = 50;

const DEPARTMENT_RULES = Object.freeze({
  singular: 'department',
  plural: 'departments',
  maxItems: MAX_DEPARTMENTS,
  maxLength: MAX_DEPARTMENT_LENGTH,
});
const PRODUCT_RULES = Object.freeze({
  singular: 'product',
  plural: 'products',
  maxItems: MAX_PRODUCTS,
  maxLength: MAX_PRODUCT_LENGTH,
});

const MAX_DEPARTMENT_TEXT_LENGTH = textLimit(DEPARTMENT_RULES);
const MAX_PRODUCT_TEXT_LENGTH = textLimit(PRODUCT_RULES);

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

function textLimit({ maxItems, maxLength }) {
  return maxItems * (maxLength + 2) * 4;
}

function normalizeChoices(value, { singular, plural, maxItems, maxLength }) {
  if (!Array.isArray(value)) return { err: `The ${singular} list is invalid.` };

  const items = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') return { err: `Each ${singular} must be text.` };
    const name = item.trim();
    if (!name) continue;
    if (CONTROL_CHARS.test(name)) {
      return { err: `${plural[0].toUpperCase() + plural.slice(1)} must not contain control characters.` };
    }
    if (name.length > maxLength) {
      return { err: `Each ${singular} must be ${maxLength} characters or fewer.` };
    }
    if (!seen.has(name)) {
      seen.add(name);
      items.push(name);
    }
  }

  if (items.length === 0) return { err: `At least one ${singular} is required.` };
  if (items.length > maxItems) return { err: `At most ${maxItems} ${plural} are allowed.` };
  return { ok: items };
}

function parseChoicesText(text, rules) {
  if (typeof text !== 'string') return { err: `The ${rules.singular} list is invalid.` };
  if (text.length > textLimit(rules)) return { err: `The ${rules.singular} list is too large.` };
  return normalizeChoices(text.split(/\r?\n/), rules);
}

function normalizeDepartments(value) {
  return normalizeChoices(value, DEPARTMENT_RULES);
}

function normalizeProducts(value) {
  return normalizeChoices(value, PRODUCT_RULES);
}

function parseDepartmentText(text) {
  return parseChoicesText(text, DEPARTMENT_RULES);
}

function parseProductText(text) {
  return parseChoicesText(text, PRODUCT_RULES);
}

function validateSettings({ qrCaption, departments, products } = {}) {
  const caption = typeof qrCaption === 'string' ? qrCaption.trim() : '';
  if (CONTROL_CHARS.test(caption)) {
    return { err: 'The QR caption must not contain control characters.' };
  }
  if (caption.length > MAX_QR_CAPTION_LENGTH) {
    return { err: `The QR caption must be ${MAX_QR_CAPTION_LENGTH} characters or fewer.` };
  }

  const parsedDepartments = typeof departments === 'string'
    ? parseDepartmentText(departments)
    : normalizeDepartments(departments);
  if (parsedDepartments.err) return parsedDepartments;

  const parsedProducts = typeof products === 'string'
    ? parseProductText(products)
    : normalizeProducts(products);
  if (parsedProducts.err) return parsedProducts;

  return {
    ok: {
      // An empty caption resets the page to the built-in default.
      qrCaption: caption || DEFAULT_QR_CAPTION,
      departments: parsedDepartments.ok,
      products: parsedProducts.ok,
    },
  };
}

function readStoredList(stored, key, normalize, fallback) {
  const value = stored.get(key);
  if (value === undefined) return fallback;
  try {
    const parsed = normalize(JSON.parse(value));
    return parsed.ok || fallback;
  } catch {
    // Ignore corrupt values and keep the safe default.
    return fallback;
  }
}

function migrateLegacySettings(db) {
  const update = db.prepare(`
    UPDATE settings
    SET value = ?, updated_at = datetime('now', 'localtime')
    WHERE key = 'qr_caption' AND value = ?
  `);
  for (const legacy of LEGACY_QR_CAPTIONS) update.run(DEFAULT_QR_CAPTION, legacy);
}

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = new Map(rows.map((row) => [row.key, row.value]));

  let qrCaption = DEFAULT_QR_CAPTION;
  const storedCaption = stored.get('qr_caption');
  if (typeof storedCaption === 'string') {
    const caption = storedCaption.trim();
    if (caption && !CONTROL_CHARS.test(caption) && caption.length <= MAX_QR_CAPTION_LENGTH) {
      qrCaption = caption;
    }
  }

  return {
    qrCaption,
    departments: readStoredList(
      stored, 'departments', normalizeDepartments, DEFAULT_DEPARTMENTS.slice(),
    ),
    products: readStoredList(
      stored, 'products', normalizeProducts, DEFAULT_PRODUCTS.slice(),
    ),
  };
}

function saveSettings(db, settings) {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    upsert.run('qr_caption', settings.qrCaption);
    upsert.run('departments', JSON.stringify(settings.departments));
    upsert.run('products', JSON.stringify(settings.products));
    db.exec('COMMIT');
    return settings;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = {
  DEFAULT_DEPARTMENTS,
  DEFAULT_PRODUCTS,
  DEFAULT_QR_CAPTION,
  MAX_DEPARTMENTS,
  MAX_DEPARTMENT_LENGTH,
  MAX_DEPARTMENT_TEXT_LENGTH,
  MAX_PRODUCTS,
  MAX_PRODUCT_LENGTH,
  MAX_PRODUCT_TEXT_LENGTH,
  MAX_QR_CAPTION_LENGTH,
  getSettings,
  migrateLegacySettings,
  normalizeDepartments,
  normalizeProducts,
  parseDepartmentText,
  parseProductText,
  saveSettings,
  validateSettings,
};
