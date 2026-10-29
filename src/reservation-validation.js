'use strict';

const { DEFAULT_DEPARTMENTS, DEFAULT_PRODUCTS } = require('./settings');

// Kept as a named export for callers that used the built-in list directly.
const DEPARTMENTS = DEFAULT_DEPARTMENTS;

function validPhone(phone) {
  if (typeof phone !== 'string') return false;
  if (phone.length > 20 || !/^[\d+\- ()（）]+$/.test(phone)) return false;
  const normalized = phone.replace(/[\s\-()（）]/g, '').replace(/^(?:\+86|0086)/, '');
  return /^(?:1[3-9]\d{9}|0\d{2,3}\d{7,8})$/.test(normalized);
}

function validateInput(body, products = DEFAULT_PRODUCTS, departments = DEFAULT_DEPARTMENTS) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { err: '请求内容无效' };
  }

  const hospital = typeof body.hospital === 'string' ? body.hospital.trim() : '';
  const department = typeof body.department === 'string' ? body.department.trim() : '';
  const product = typeof body.product === 'string' ? body.product.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const note = body.note === undefined
    ? ''
    : typeof body.note === 'string' ? body.note.trim() : null;
  const hasControlChars = (value) => /[\u0000-\u001f\u007f-\u009f]/.test(value);

  if (hospital.length <= 2 || hospital.length > 50 || hasControlChars(hospital)) {
    return { err: '请填写医院名称（3-50 字）' };
  }
  const departmentChoices = Array.isArray(departments) && departments.length
    ? departments
    : DEFAULT_DEPARTMENTS;
  if (!department) return { err: '请选择科室' };
  if (!departmentChoices.includes(department)) return { err: '科室不在可选列表内' };
  const productChoices = Array.isArray(products) && products.length ? products : DEFAULT_PRODUCTS;
  if (!product) return { err: '请选择产品' };
  if (!productChoices.includes(product)) return { err: '产品不在可选列表内' };
  if (name.length < 2 || name.length > 20 || hasControlChars(name)) {
    return { err: '请填写姓名（2-20 字）' };
  }
  if (!validPhone(phone)) return { err: '联系电话格式不正确' };
  if (note === null) return { err: '说明/建议内容无效' };
  if (note.length > 500) return { err: '说明/建议请控制在 500 字以内' };
  if (hasControlChars(note)) return { err: '说明/建议不能包含控制字符' };

  return { ok: { hospital, department, product, name, phone, note } };
}

module.exports = { DEPARTMENTS, validPhone, validateInput };
