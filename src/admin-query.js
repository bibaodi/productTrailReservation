'use strict';

const PAGE_SIZE = 25;
const MAX_EXPORT_ROWS = 10000;
const MAX_SEARCH_LENGTH = 100;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseAdminFilters(searchParams) {
  const name = (searchParams.get('name') || '').trim();
  const hospital = (searchParams.get('hospital') || '').trim();
  const department = (searchParams.get('department') || '').trim();
  const from = (searchParams.get('from') || '').trim();
  const to = (searchParams.get('to') || '').trim();
  const rawPage = searchParams.get('page') || '1';

  if ([name, hospital, department].some((value) => value.length > MAX_SEARCH_LENGTH)) {
    return { err: 'Search fields must be 100 characters or fewer.' };
  }
  if ((from && !validDate(from)) || (to && !validDate(to))) {
    return { err: 'Dates must use the YYYY-MM-DD format.' };
  }
  if (from && to && from > to) return { err: 'Start date must not be after end date.' };
  if (!/^[1-9]\d{0,6}$/.test(rawPage)) return { err: 'Page number is invalid.' };

  return { ok: { name, hospital, department, from, to, page: Number(rawPage) } };
}

function buildWhere(filters) {
  const clauses = [];
  const values = [];
  for (const field of ['name', 'hospital', 'department']) {
    if (filters[field]) {
      const escaped = filters[field].replace(/[\\%_]/g, '\\$&');
      clauses.push(`${field} LIKE ? ESCAPE '\\'`);
      values.push('%' + escaped + '%');
    }
  }
  if (filters.from) {
    clauses.push('created_at >= ?');
    values.push(filters.from + ' 00:00:00');
  }
  if (filters.to) {
    clauses.push('created_at <= ?');
    values.push(filters.to + ' 23:59:59');
  }
  return {
    sql: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '',
    values,
  };
}

function queryAdminReservations(db, filters, exportAll = false) {
  const where = buildWhere(filters);
  const total = Number(db.prepare(
    `SELECT COUNT(*) AS total FROM trialreservations ${where.sql}`
  ).get(...where.values).total);

  if (exportAll) {
    const rows = db.prepare(`
      SELECT id, hospital, department, name, phone, note, created_at
      FROM trialreservations ${where.sql}
      ORDER BY id DESC
      LIMIT ?
    `).all(...where.values, MAX_EXPORT_ROWS);
    return { rows, total, truncated: total > MAX_EXPORT_ROWS };
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const rows = db.prepare(`
    SELECT id, hospital, department, name, phone, note, created_at
    FROM trialreservations ${where.sql}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...where.values, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  return { rows, total, page, pages };
}

module.exports = {
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  parseAdminFilters,
  queryAdminReservations,
};
