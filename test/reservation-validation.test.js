'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEPARTMENTS,
  validPhone,
  validateInput,
} = require('../src/reservation-validation');
const { DEFAULT_PRODUCTS } = require('../src/settings');
const { csvCell, escapeHTML } = require('../src/safe-output');

const PRODUCT = DEFAULT_PRODUCTS[0];

function validReservation(overrides = {}) {
  return {
    hospital: '北京协和医院',
    department: '内科',
    product: PRODUCT,
    name: '王小明',
    phone: '13812345678',
    note: '',
    ...overrides,
  };
}

test('accepts a complete reservation and trims surrounding whitespace', () => {
  assert.deepEqual(validateInput(validReservation({
    hospital: '  北京协和医院  ',
    department: ' 内科 ',
    product: '  ' + PRODUCT + '  ',
    name: ' 王小明 ',
    phone: ' 13812345678 ',
    note: '  预约试用  ',
  })), {
    ok: {
      hospital: '北京协和医院',
      department: '内科',
      product: PRODUCT,
      name: '王小明',
      phone: '13812345678',
      note: '预约试用',
    },
  });
});

test('rejects non-object request bodies and non-string fields', () => {
  assert.ok(validateInput(null).err);
  assert.ok(validateInput([]).err);
  assert.ok(validateInput('reservation').err);
  assert.ok(validateInput(validReservation({ hospital: { value: '医院' } })).err);
  assert.ok(validateInput(validReservation({ note: 123 })).err);
});

test('validates hospital and user name length boundaries', () => {
  for (const length of [3, 50]) {
    assert.ok(validateInput(validReservation({ hospital: '医'.repeat(length) })).ok);
  }
  for (const length of [0, 1, 2, 51]) {
    assert.ok(validateInput(validReservation({ hospital: '医'.repeat(length) })).err);
  }
  for (const length of [2, 20]) {
    assert.ok(validateInput(validReservation({ name: '名'.repeat(length) })).ok);
  }
  for (const length of [0, 1, 21]) {
    assert.ok(validateInput(validReservation({ name: '名'.repeat(length) })).err);
  }
});

test('requires a listed department', () => {
  assert.ok(DEPARTMENTS.includes('内科'));
  assert.ok(validateInput(validReservation({ department: '' })).err);
  assert.ok(validateInput(validReservation({ department: '未知科室' })).err);
  assert.ok(validateInput(validReservation({ department: '<script>alert(1)</script>' })).err);
});

test('requires a product from the configured list', () => {
  assert.ok(validateInput(validReservation({ product: '' })).err);
  assert.ok(validateInput(validReservation({ product: '未知产品' })).err);
  assert.ok(validateInput(validReservation({ product: '<script>alert(1)</script>' })).err);
  assert.deepEqual(
    validateInput(validReservation({ product: '产品B' }), ['产品A', '产品B']).ok.product,
    '产品B',
  );
  assert.ok(validateInput(validReservation({ product: '产品C' }), ['产品A', '产品B']).err);
  // An empty override must never silently disable the required field.
  assert.ok(validateInput(validReservation(), []).ok);
});

test('requires a department from the configured list', () => {
  assert.deepEqual(
    validateInput(validReservation({ department: '新科室' }), undefined, ['新科室']).ok.department,
    '新科室',
  );
  assert.ok(validateInput(validReservation({ department: '内科' }), undefined, ['新科室']).err);
  // An empty override must never silently disable the required field.
  assert.ok(validateInput(validReservation({ department: '内科' }), undefined, []).ok);
});

test('accepts valid mainland mobile and landline formats', () => {
  for (const phone of [
    '13812345678',
    '+86 138-1234-5678',
    '0086 (138) 12345678',
    '010-12345678',
    '+86 010 12345678',
  ]) {
    assert.equal(validPhone(phone), true, phone);
    assert.ok(validateInput(validReservation({ phone })).ok);
  }
});

test('rejects invalid, oversized, and control-character phone numbers', () => {
  assert.equal(validPhone(null), false);
  assert.equal(validPhone(13812345678), false);
  for (const phone of [
    '12345678901',
    '12812345678',
    '1381234567',
    '021123456',
    '138123456789',
    '+86138abc5678',
    '13812\n345678',
    '1'.repeat(21),
  ]) {
    assert.equal(validPhone(phone), false, phone);
    assert.ok(validateInput(validReservation({ phone })).err);
  }
});

test('allows optional descriptions up to 500 characters and rejects invalid content', () => {
  assert.deepEqual(validateInput(validReservation({ note: undefined })).ok.note, '');
  assert.equal(validateInput(validReservation({ note: '说'.repeat(500) })).ok.note.length, 500);
  assert.ok(validateInput(validReservation({ note: '说'.repeat(501) })).err);
  assert.ok(validateInput(validReservation({ note: 'first\nsecond' })).err);
});

test('rejects control characters in hospital and name', () => {
  assert.ok(validateInput(validReservation({ hospital: '北京\n医院' })).err);
  assert.ok(validateInput(validReservation({ name: '王\n小明' })).err);
});

test('HTML output escapes user-provided markup', () => {
  const payload = '<script>alert("x")</script>';
  assert.ok(validateInput(validReservation({ note: payload })).ok);
  assert.equal(
    escapeHTML(payload + ' & \u0027'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;',
  );
});

test('CSV output quotes values and neutralizes formula injection', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('  @SUM(A1:A2)'), '"\'  @SUM(A1:A2)"');
  assert.equal(csvCell('text, with "quotes"'), '"text, with ""quotes"""');
  assert.equal(csvCell('普通文本'), '"普通文本"');
});
