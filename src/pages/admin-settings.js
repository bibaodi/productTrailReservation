'use strict';

const { escapeHTML } = require('../safe-output');
const {
  DEFAULT_DEMO_NOTICE,
  DEFAULT_DEMO_PRODUCTS,
  DEFAULT_DEPARTMENTS,
  DEFAULT_PRODUCTS,
  DEFAULT_QR_CAPTION,
  MAX_DEMO_NOTICE_LENGTH,
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
  const demoProductsValue = values
    ? values.demoProducts
    : (settings.demoProducts || DEFAULT_DEMO_PRODUCTS).join('\n');
  const demoNoticeValue = values ? values.demoNotice : (settings.demoNotice || DEFAULT_DEMO_NOTICE);

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
  <label>Demo products
    <textarea name="demo_products" rows="4" spellcheck="false" maxlength="${MAX_PRODUCT_TEXT_LENGTH}">${escapeHTML(demoProductsValue)}</textarea>
  </label>
  <p class="hint">Products shown on the demo page (<code>?type=demo</code>). One per line; at least one
    is required; up to ${MAX_PRODUCTS} products, each up to ${MAX_PRODUCT_LENGTH} characters.
    Duplicate lines are ignored.</p>
  <p class="hint">Built-in default demo product: ${escapeHTML(DEFAULT_DEMO_PRODUCTS[0])}</p>
  <label>Demo attention text (shown below 说明 / 建议)
    <textarea name="demo_notice" rows="3" maxlength="${MAX_DEMO_NOTICE_LENGTH}">${escapeHTML(demoNoticeValue)}</textarea>
  </label>
  <p class="hint">Bold highlighted text shown under the demo page's note hint, only for the demo page
    (<code>?type=demo</code>). It is not pre-filled into the note box. Leave blank to use the
    default: ${escapeHTML(DEFAULT_DEMO_NOTICE)}</p>
  <button type="submit">Save settings</button>
</form>`;

  return renderAdminLayout({
    title: 'Site Settings',
    activeTab: 'settings',
    body,
  });
}

module.exports = { renderSettingsPage };
