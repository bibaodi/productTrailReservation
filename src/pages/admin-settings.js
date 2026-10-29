'use strict';

const { escapeHTML } = require('../safe-output');
const {
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
} = require('../settings');
const { renderAdminLayout } = require('./layout');

function renderSettingsPage(settings, { csrfToken = '', saved = false, error = '', values = null } = {}) {
  const captionValue = values ? values.qrCaption : settings.qrCaption;
  const departmentsValue = values ? values.departments : settings.departments.join('\n');
  const productsValue = values ? values.products : settings.products.join('\n');

  const body = `
${saved ? '<p class="notice" role="status">Settings saved.</p>' : ''}
${error ? '<p class="error" role="alert">' + escapeHTML(error) + '</p>' : ''}
<form class="settings-form" method="post" action="" autocomplete="off">
  <input type="hidden" name="csrf" value="${escapeHTML(csrfToken)}">
  <label>Text above the WeChat QR code
    <textarea name="qr_caption" maxlength="${MAX_QR_CAPTION_LENGTH}" rows="3">${escapeHTML(captionValue)}</textarea>
  </label>
  <p class="hint">Shown on the success page above the QR code. Leave blank to use the default:
    ${escapeHTML(DEFAULT_QR_CAPTION)}</p>
  <label>Departments
    <textarea name="departments" rows="6" spellcheck="false" maxlength="${MAX_DEPARTMENT_TEXT_LENGTH}">${escapeHTML(departmentsValue)}</textarea>
  </label>
  <p class="hint">One department per line. At least one is required; up to ${MAX_DEPARTMENTS} departments,
    each up to ${MAX_DEPARTMENT_LENGTH} characters. Duplicate lines are ignored. Removing a department
    does not change reservations that already recorded it.</p>
  <p class="hint">Built-in default departments: ${escapeHTML(DEFAULT_DEPARTMENTS.join(', '))}</p>
  <label>Products
    <textarea name="products" rows="8" spellcheck="false" maxlength="${MAX_PRODUCT_TEXT_LENGTH}">${escapeHTML(productsValue)}</textarea>
  </label>
  <p class="hint">One product per line. At least one is required; up to ${MAX_PRODUCTS} products,
    each up to ${MAX_PRODUCT_LENGTH} characters. Duplicate lines are ignored. Removing a product
    does not change reservations that already recorded it.</p>
  <p class="hint">Built-in default product: ${escapeHTML(DEFAULT_PRODUCTS[0])}</p>
  <button type="submit">Save settings</button>
</form>`;

  return renderAdminLayout({
    title: 'Site Settings',
    activeTab: 'settings',
    body,
  });
}

module.exports = { renderSettingsPage };
