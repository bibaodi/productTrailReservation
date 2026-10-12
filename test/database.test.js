'use strict';

const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeDatabase } = require('../src/database');

test('migrates an existing reservations table without losing records', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE trialreservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital TEXT NOT NULL,
        department TEXT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        note TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      INSERT INTO trialreservations (hospital, department, name, phone)
      VALUES ('Old Hospital', '内科', '王小明', '13812345678');
    `);

    initializeDatabase(db);
    const row = db.prepare('SELECT * FROM trialreservations').get();
    const columns = db.prepare('PRAGMA table_info(trialreservations)').all();
    assert.equal(row.hospital, 'Old Hospital');
    assert.equal(row.device_token_id, null);
    assert.ok(columns.some((column) => column.name === 'device_token_id'));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM device_tokens').get().n, 0);
  } finally {
    db.close();
  }
});
