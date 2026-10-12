'use strict';

const { DatabaseSync } = require('node:sqlite');

function initializeDatabase(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS trialreservations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital    TEXT NOT NULL,
      department  TEXT,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      note        TEXT,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE TABLE IF NOT EXISTS device_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash  TEXT NOT NULL UNIQUE,
      expires_at  INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const columns = db.prepare('PRAGMA table_info(trialreservations)').all();
  if (!columns.some((column) => column.name === 'device_token_id')) {
    db.exec('ALTER TABLE trialreservations ADD COLUMN device_token_id INTEGER');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_trialreservations_device_token
      ON trialreservations(device_token_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_trialreservations_created_at
      ON trialreservations(created_at);
  `);
  return db;
}

function openDatabase(path) {
  const db = new DatabaseSync(path);
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  return initializeDatabase(db);
}

module.exports = { initializeDatabase, openDatabase };
