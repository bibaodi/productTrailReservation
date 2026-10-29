'use strict';

const crypto = require('node:crypto');

const TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

/**
 * Stateless CSRF tokens HMAC-signed with the admin password. Browsers cache
 * HTTP Basic credentials and attach them to cross-site form posts, so admin
 * mutation endpoints need a token that a third-party page cannot read.
 */
function createCSRF(secret) {
  const key = crypto.createHash('sha256')
    .update('trialreservation-csrf\0' + String(secret))
    .digest();
  const sign = (payload) => crypto.createHmac('sha256', key).update(payload).digest('base64url');

  return {
    issue(now = Date.now()) {
      const payload = String(Math.floor(now));
      return payload + '.' + sign(payload);
    },

    verify(token, now = Date.now()) {
      if (typeof token !== 'string' || token.length > 64) return false;
      const separator = token.indexOf('.');
      if (separator < 1) return false;

      const payload = token.slice(0, separator);
      const supplied = token.slice(separator + 1);
      if (!/^\d{10,16}$/.test(payload)) return false;

      const expected = sign(payload);
      const suppliedBuffer = Buffer.from(supplied);
      const expectedBuffer = Buffer.from(expected);
      if (suppliedBuffer.length !== expectedBuffer.length) return false;
      if (!crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return false;

      const issuedAt = Number(payload);
      return issuedAt <= now + CLOCK_SKEW_MS && now - issuedAt <= TOKEN_MAX_AGE_MS;
    },
  };
}

module.exports = { createCSRF, TOKEN_MAX_AGE_MS };
