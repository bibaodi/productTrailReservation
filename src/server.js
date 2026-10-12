#!/usr/bin/env node
'use strict';

const http = require('node:http');
const { createApp } = require('./app');
const { openDatabase } = require('./database');

function startServer(env = process.env) {
  const port = Number(env.PORT || 8787);
  const host = env.HOST || '127.0.0.1';
  const dbPath = env.DB_PATH || './trialreservations.db';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const db = openDatabase(dbPath);
  const app = createApp({
    db,
    adminUser: env.ADMIN_USER || 'admin',
    adminPass: env.ADMIN_PASS || '',
    wecomWebhookURL: env.WECOM_WEBHOOK_URL || '',
  });
  const server = http.createServer(app.handle);
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;

  server.listen(port, host, () => {
    console.log('trialreservation server listening on ' + host + ':' + port);
    console.log('  DB_PATH=' + dbPath);
    console.log('  admin ' + (env.ADMIN_PASS ? 'enabled (user=' + (env.ADMIN_USER || 'admin') + ')' : 'DISABLED: set ADMIN_PASS to enable'));
    console.log('  wecom notify ' + (env.WECOM_WEBHOOK_URL ? 'enabled' : 'disabled'));
  });

  function shutdown() {
    server.close(() => {
      app.close();
      db.close();
      process.exit(0);
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { server, db, app };
}

if (require.main === module) startServer();

module.exports = { startServer };
