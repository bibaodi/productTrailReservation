'use strict';

const { csvCell } = require('../safe-output');

function buildCSV(rows) {
  const header = ['ID', 'Hospital', 'Department', 'Product', 'Name', 'Phone', 'Notes', 'Created at'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push([
      row.id, row.hospital, row.department || '', row.product || '', row.name, row.phone,
      row.note || '', row.created_at,
    ].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n');
}

module.exports = { buildCSV };
