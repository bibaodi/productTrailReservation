'use strict';

const crypto = require('node:crypto');

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DEVICE_RESERVATIONS = 100;
const RESERVATION_COLUMNS = 'id, hospital, department, name, phone, note, created_at';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeAccessToken(db, now) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = now + TOKEN_TTL_MS;
  const result = db.prepare(
    'INSERT INTO device_tokens (token_hash, expires_at) VALUES (?, ?)'
  ).run(hashToken(token), expiresAt);
  return { id: Number(result.lastInsertRowid), token, expiresAt };
}

function findAndRefreshToken(db, token, now) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const record = db.prepare(
    'SELECT id FROM device_tokens WHERE token_hash = ? AND expires_at > ?'
  ).get(tokenHash, now);
  if (!record) return null;
  const expiresAt = now + TOKEN_TTL_MS;
  db.prepare('UPDATE device_tokens SET expires_at = ? WHERE id = ?').run(expiresAt, record.id);
  return { id: Number(record.id), expiresAt };
}

function createReservation(db, reservation, userAgent, token, now = Date.now()) {
  db.exec('BEGIN IMMEDIATE');
  try {
    let device;
    let accessToken;
    if (token === null) {
      const created = makeAccessToken(db, now);
      device = created;
      accessToken = created.token;
    } else {
      device = findAndRefreshToken(db, token, now);
      if (!device) {
        const error = new Error('Access token is missing or expired');
        error.statusCode = 401;
        throw error;
      }
    }

    const result = db.prepare(`
      INSERT INTO trialreservations
        (hospital, department, name, phone, note, user_agent, device_token_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      reservation.hospital,
      reservation.department,
      reservation.name,
      reservation.phone,
      reservation.note,
      userAgent.slice(0, 300),
      device.id,
    );
    db.exec('COMMIT');
    return { id: Number(result.lastInsertRowid), accessToken };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function listReservations(db, token, now = Date.now()) {
  const device = findAndRefreshToken(db, token, now);
  if (!device) return null;
  const total = Number(db.prepare(
    'SELECT COUNT(*) AS total FROM trialreservations WHERE device_token_id = ?'
  ).get(device.id).total);
  const rows = db.prepare(`
    SELECT ${RESERVATION_COLUMNS}
    FROM trialreservations
    WHERE device_token_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(device.id, MAX_DEVICE_RESERVATIONS);
  return {
    rows,
    total,
    truncated: total > MAX_DEVICE_RESERVATIONS,
    expiresAt: device.expiresAt,
  };
}

function updateReservation(db, id, reservation, token, now = Date.now()) {
  const device = findAndRefreshToken(db, token, now);
  if (!device) {
    const error = new Error('Access token is missing or expired');
    error.statusCode = 401;
    throw error;
  }
  const result = db.prepare(`
    UPDATE trialreservations
    SET hospital = ?, department = ?, name = ?, phone = ?, note = ?
    WHERE id = ? AND device_token_id = ?
  `).run(
    reservation.hospital,
    reservation.department,
    reservation.name,
    reservation.phone,
    reservation.note,
    id,
    device.id,
  );
  return Number(result.changes) === 1;
}

module.exports = {
  MAX_DEVICE_RESERVATIONS,
  TOKEN_TTL_MS,
  createReservation,
  findAndRefreshToken,
  listReservations,
  updateReservation,
};
