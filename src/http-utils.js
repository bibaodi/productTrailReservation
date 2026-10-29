'use strict';

const MAX_BODY_BYTES = 64 * 1024;

function sendText(res, status, body, headers = {}) {
  const buffer = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    ...headers,
  });
  res.end(buffer);
}

function sendJSON(res, status, value, headers = {}) {
  const buffer = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers,
  });
  res.end(buffer);
}

function sendRedirect(res, status, location) {
  res.writeHead(status, {
    Location: location,
    'Content-Length': 0,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        chunks.length = 0;
        const error = new Error('Request body too large');
        error.statusCode = 413;
        reject(error);
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

async function readForm(req) {
  const text = await readBody(req);
  const contentType = req.headers['content-type'] || '';
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)) {
    const error = new Error('Content-Type must be application/x-www-form-urlencoded');
    error.statusCode = 415;
    throw error;
  }
  return new URLSearchParams(text);
}

async function readJSON(req) {
  const text = await readBody(req);
  const contentType = req.headers['content-type'] || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    const error = new Error('Content-Type must be application/json');
    error.statusCode = 415;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('Malformed JSON');
    error.statusCode = 400;
    throw error;
  }
}

function parseErrorResponse(error) {
  const status = error.statusCode === 413 || error.statusCode === 415 ||
    error.statusCode === 401 ? error.statusCode : 400;
  const message = status === 413 ? 'Request body is too large.'
    : status === 415 ? 'Request must use application/json.'
      : status === 401 ? 'Access token is invalid or expired.'
        : 'Request body is not valid JSON.';
  return { status, body: { ok: false, message } };
}

module.exports = {
  parseErrorResponse,
  readBody,
  readForm,
  readJSON,
  sendJSON,
  sendRedirect,
  sendText,
};
