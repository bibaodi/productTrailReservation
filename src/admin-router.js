'use strict';

const { parseAdminFilters, queryAdminReservations } = require('./admin-query');
const { checkBasicAuth } = require('./auth');
const { createCSRF } = require('./csrf');
const { readForm, sendRedirect, sendText } = require('./http-utils');
const { buildCSV, renderAdminPage, renderSettingsPage } = require('./pages');
const { getSettings, saveSettings, validateSettings } = require('./settings');

function sendUnauthorized(res) {
  sendText(res, 401, 'Unauthorized', {
    'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"',
  });
}

// Browsers attach cached Basic credentials to cross-site form posts. CSRF
// tokens are the primary defence; this check rejects obviously foreign origins
// when the browser supplies one.
function sameOrigin(req) {
  const host = req.headers.host;
  if (!host) return false;
  const candidate = req.headers.origin || req.headers.referer;
  if (!candidate) return true;
  try {
    return new URL(candidate).host === host;
  } catch {
    return false;
  }
}

function createAdminRouter({ db, adminUser = 'admin', adminPass = '', now = Date.now }) {
  const csrf = createCSRF(adminPass);

  async function handleReview(req, res, url) {
    const parsed = parseAdminFilters(url.searchParams);
    if (parsed.err) return sendText(res, 400, parsed.err);

    if (url.pathname === '/admin') {
      const result = queryAdminReservations(db, parsed.ok);
      return sendText(res, 200, renderAdminPage(result, parsed.ok));
    }

    const result = queryAdminReservations(db, parsed.ok, true);
    const csv = buildCSV(result.rows);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="trialreservations.csv"',
      'X-Export-Truncated': String(result.truncated),
      'Content-Length': Buffer.byteLength(csv),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    return res.end(csv);
  }

  async function handleSettings(req, res, url) {
    if (req.method === 'GET') {
      return sendText(res, 200, renderSettingsPage(getSettings(db), {
        csrfToken: csrf.issue(now()),
        saved: url.searchParams.get('saved') === '1',
      }));
    }

    if (req.method !== 'POST') {
      return sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, POST' });
    }

    if (!sameOrigin(req)) return sendText(res, 403, 'Forbidden');

    let form;
    try {
      form = await readForm(req);
    } catch (error) {
      return sendText(res, error.statusCode || 400, 'Invalid form submission.');
    }

    if (!csrf.verify(form.get('csrf'), now())) {
      return sendText(res, 403,
        'The form has expired or is invalid. Please reload the settings page and try again.');
    }

    const submitted = {
      qrCaption: form.get('qr_caption') || '',
      departments: form.get('departments') || '',
      products: form.get('products') || '',
    };
    const validation = validateSettings(submitted);
    if (validation.err) {
      return sendText(res, 422, renderSettingsPage(getSettings(db), {
        csrfToken: csrf.issue(now()),
        error: validation.err,
        values: submitted,
      }));
    }

    saveSettings(db, validation.ok);
    return sendRedirect(res, 303, 'settings?saved=1');
  }

  return async function handleAdminRequest(req, res, url) {
    if (!checkBasicAuth(req, adminUser, adminPass)) {
      sendUnauthorized(res);
      return;
    }

    if (url.pathname === '/admin/settings') {
      return handleSettings(req, res, url);
    }
    if ((url.pathname === '/admin' || url.pathname === '/admin/export.csv') && req.method === 'GET') {
      return handleReview(req, res, url);
    }
    return sendText(res, 404, 'Not Found');
  };
}

module.exports = { createAdminRouter };
