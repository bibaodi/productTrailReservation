'use strict';

const crypto = require('node:crypto');

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

function checkBasicAuth(req, username, password) {
  if (!password) return false;
  const header = req.headers.authorization || '';
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/.exec(header);
  if (!match) return false;

  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) return false;
  const suppliedUser = decoded.slice(0, separator);
  const suppliedPassword = decoded.slice(separator + 1);
  return crypto.timingSafeEqual(digest(suppliedUser), digest(username)) &&
    crypto.timingSafeEqual(digest(suppliedPassword), digest(password));
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
  if (!match) {
    const error = new Error('Invalid authorization header');
    error.statusCode = 401;
    throw error;
  }
  return match[1];
}

module.exports = { bearerToken, checkBasicAuth };
