'use strict';

const { PAGE_SIZE } = require('../admin-query');
const { escapeHTML } = require('../safe-output');
const { renderAdminLayout } = require('./layout');

function queryString(filters, page) {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.hospital) params.set('hospital', filters.hospital);
  if (filters.department) params.set('department', filters.department);
  if (filters.product) params.set('product', filters.product);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (page > 1) params.set('page', String(page));
  return '?' + params.toString();
}

function renderAdminPage(result, filters) {
  const rows = result.rows.map((row) =>
    '<tr>' +
    '<td>' + row.id + '</td>' +
    '<td>' + escapeHTML(row.hospital) + '</td>' +
    '<td>' + escapeHTML(row.department || '—') + '</td>' +
    '<td>' + escapeHTML(row.product || '—') + '</td>' +
    '<td>' + escapeHTML(row.name) + '</td>' +
    '<td>' + escapeHTML(row.phone) + '</td>' +
    '<td>' + escapeHTML(row.note || '—') + '</td>' +
    '<td>' + escapeHTML(row.created_at) + '</td>' +
    '</tr>'
  ).join('');

  const exportParams = new URLSearchParams();
  if (filters.name) exportParams.set('name', filters.name);
  if (filters.hospital) exportParams.set('hospital', filters.hospital);
  if (filters.department) exportParams.set('department', filters.department);
  if (filters.product) exportParams.set('product', filters.product);
  if (filters.from) exportParams.set('from', filters.from);
  if (filters.to) exportParams.set('to', filters.to);
  const exportQuery = exportParams.toString();
  const exportLink = 'admin/export.csv' + (exportQuery ? '?' + exportQuery : '');
  const previous = result.page > 1
    ? '<a href="' + queryString(filters, result.page - 1) + '">Previous</a>'
    : '';
  const next = result.page < result.pages
    ? '<a href="' + queryString(filters, result.page + 1) + '">Next</a>'
    : '';

  const body = `
<p>${result.total} matching reservations</p>
<form class="filters" method="get">
  <label>Name
    <input name="name" maxlength="100" value="${escapeHTML(filters.name)}">
  </label>
  <label>Hospital
    <input name="hospital" maxlength="100" value="${escapeHTML(filters.hospital)}">
  </label>
  <label>Department
    <input name="department" maxlength="100" value="${escapeHTML(filters.department)}">
  </label>
  <label>Product
    <input name="product" maxlength="100" value="${escapeHTML(filters.product)}">
  </label>
  <label>From date
    <input type="date" name="from" value="${escapeHTML(filters.from)}">
  </label>
  <label>To date
    <input type="date" name="to" value="${escapeHTML(filters.to)}">
  </label>
  <button type="submit">Search</button>
  <a href="?">Clear</a>
</form>
<div class="actions">
  <a class="button-link" href="${escapeHTML(exportLink)}">Export filtered CSV (up to 10,000 rows)</a>
</div>
<table>
  <thead><tr><th>#</th><th>Hospital</th><th>Department</th><th>Product</th><th>Name</th><th>Phone</th><th>Notes</th><th>Created</th></tr></thead>
  <tbody>${rows || '<tr><td class="empty" colspan="8">No reservations found.</td></tr>'}</tbody>
</table>
<nav class="pages" aria-label="Pagination">
  ${previous}<span>Page ${result.page} of ${result.pages}; ${PAGE_SIZE} per page</span>${next}
</nav>`;

  return renderAdminLayout({
    title: 'Reservation Admin',
    activeTab: 'reservations',
    body,
  });
}

module.exports = { renderAdminPage };
