'use strict';

const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { createAdminRouter } = require('./admin-router');
const { bearerToken } = require('./auth');
const { parseErrorResponse, readBody, readJSON, sendJSON, sendText } = require('./http-utils');
const { createWeComNotifier } = require('./notifications');
const { QR_IMAGE_URL, renderReservationPage } = require('./pages');
const { createRateLimiter } = require('./rate-limit');
const { createReservation, listReservations } = require('./reservation-service');
const { validateInput } = require('./reservation-validation');
const { getSettings } = require('./settings');

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function clientIP(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    const candidate = forwardedFor.split(',').pop().trim();
    if (net.isIP(candidate)) return candidate;
  }
  return req.socket.remoteAddress || 'unknown';
}

function createApp({
  db,
  adminUser = 'admin',
  adminPass = '',
  wecomWebhookURL = '',
  now = Date.now,
  rateLimit = RATE_LIMIT,
  rateWindowMs = RATE_WINDOW_MS,
} = {}) {
  if (!db) throw new TypeError('A database connection is required');
  const limiter = createRateLimiter({ limit: rateLimit, windowMs: rateWindowMs, now });
  const notify = createWeComNotifier(wecomWebhookURL);
  const adminRouter = createAdminRouter({ db, adminUser, adminPass, now });
  const qrImage = fs.readFileSync(path.join(__dirname, '..', QR_IMAGE_URL));

  async function handle(req, res) {
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname;

      if (req.method === 'GET' && path === '/healthz') {
        return sendJSON(res, 200, { ok: true });
      }
      if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
        const settings = getSettings(db);
        return sendText(res, 200, renderReservationPage(settings.departments, settings));
      }
      if (req.method === 'GET' && path === '/' + QR_IMAGE_URL) {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': qrImage.length,
          'Cache-Control': 'public, max-age=86400',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        });
        return res.end(qrImage);
      }

      if (req.method === 'POST' && path === '/api/reserve') {
        if (!limiter.allow(clientIP(req))) {
          try {
            await readBody(req);
          } catch (error) {
            const failure = parseErrorResponse(error);
            return sendJSON(res, failure.status, failure.body);
          }
          return sendJSON(res, 429, { ok: false, message: 'Too many submissions. Please try again later.' });
        }
        let body;
        try {
          body = await readJSON(req);
        } catch (error) {
          const failure = parseErrorResponse(error);
          return sendJSON(res, failure.status, failure.body);
        }
        let token;
        try {
          token = bearerToken(req);
        } catch {
          return sendJSON(res, 401, { ok: false, message: 'Access token is invalid or expired.' });
        }
        const settings = getSettings(db);
        const validation = validateInput(body, settings.products, settings.departments);
        if (validation.err) return sendJSON(res, 422, { ok: false, message: validation.err });

        const result = createReservation(
          db,
          validation.ok,
          String(req.headers['user-agent'] || ''),
          token,
          now(),
        );
        notify(validation.ok);
        return sendJSON(res, 200, {
          ok: true,
          id: result.id,
          ...(result.accessToken ? { accessToken: result.accessToken } : {}),
        });
      }

      if (req.method === 'GET' && path === '/api/reservations') {
        let token;
        try {
          token = bearerToken(req);
        } catch {
          return sendJSON(res, 401, { ok: false, message: 'Access token is invalid or expired.' });
        }
        if (!token) return sendJSON(res, 401, { ok: false, message: 'Access token is required.' });
        const result = listReservations(db, token, now());
        if (!result) return sendJSON(res, 401, { ok: false, message: 'Access token is invalid or expired.' });
        return sendJSON(res, 200, {
          ok: true,
          reservations: result.rows,
          expiresAt: result.expiresAt,
        });
      }

      if (path === '/admin' || path.startsWith('/admin/')) {
        return await adminRouter(req, res, url);
      }

      return sendText(res, 404, 'Not Found');
    } catch (error) {
      if (error.statusCode === 401) {
        return sendJSON(res, 401, { ok: false, message: 'Access token is invalid or expired.' });
      }
      console.error('[' + new Date().toISOString() + '] request error:', error);
      if (!res.headersSent) return sendJSON(res, 500, { ok: false, message: 'Internal server error.' });
      res.destroy();
    }
  }

  return { handle, close: () => limiter.close() };
}

module.exports = { createApp };
