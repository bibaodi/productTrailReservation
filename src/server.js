#!/usr/bin/env node
/**
 * 产品预约试用 — 微信公众号 H5 应用（单文件，零 npm 依赖）
 *
 * 运行要求：Node.js >= 23.4（推荐 24 LTS），使用内置 node:sqlite，无需安装任何包
 *
 * 功能：
 *   GET  /            手机端预约表单页（可直接挂到公众号菜单）
 *   POST /api/reserve 提交预约（含服务端校验、IP 频率限制）
 *   GET  /admin       管理后台：查看预约列表（HTTP Basic 认证）
 *   GET  /admin/export.csv  导出 CSV（Excel 可直接打开）
 *   GET  /healthz     健康检查
 *
 * 配置（环境变量）：
 *   PORT               监听端口，默认 8787
 *   HOST               监听地址，默认 127.0.0.1（Docker 容器内设为 0.0.0.0）
 *   DB_PATH            SQLite 文件路径，默认 ./trialreservations.db
 *   ADMIN_USER         后台用户名，默认 admin
 *   ADMIN_PASS         后台密码（必填，不设置则 /admin 直接拒绝访问）
 *   WECOM_WEBHOOK_URL  企业微信群机器人 Webhook（可选，有新预约时推送到群）
 */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { csvCell, escapeHTML } = require('./safe-output');
const { DEPARTMENTS, validateInput } = require('./reservation-validation');

// ==================== 配置 ====================
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || './trialreservations.db';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const WECOM_WEBHOOK_URL = process.env.WECOM_WEBHOOK_URL || '';

const MAX_BODY_BYTES = 64 * 1024;     // 请求体上限
const RATE_LIMIT = 10;                // 每 IP 每 RATE_WINDOW 最多提交次数
const RATE_WINDOW_MS = 3600 * 1000;

// ==================== 数据库 ====================
const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
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
`);
const insertStmt = db.prepare(
  'INSERT INTO trialreservations (hospital, department, name, phone, note, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
);
const listStmt = db.prepare('SELECT * FROM trialreservations ORDER BY id DESC LIMIT 500');
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM trialreservations');

// ==================== 工具函数 ====================
function sendText(res, status, body, headers = {}) {
  const buf = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(buf);
}

function sendJSON(res, status, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', (c) => {
      if (settled) return;
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        chunks.length = 0;
        reject(Object.assign(new Error('body too large'), { statusCode: 413 }));
        req.resume();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

// 取客户端真实 IP（nginx 反代下取 X-Forwarded-For 第一个）
function clientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

// ==================== IP 频率限制（内存即可，重启清零无妨） ====================
const rateMap = new Map(); // ip -> [timestamps]
function allowRequest(ip) {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    rateMap.set(ip, arr);
    return false;
  }
  arr.push(now);
  rateMap.set(ip, arr);
  return true;
}
setInterval(() => { // 定时清理，防止 Map 无限增长
  const now = Date.now();
  for (const [ip, arr] of rateMap) {
    const kept = arr.filter((t) => now - t < RATE_WINDOW_MS);
    if (kept.length === 0) rateMap.delete(ip); else rateMap.set(ip, kept);
  }
}, 10 * 60 * 1000).unref();

// ==================== 企业微信通知（可选） ====================
function notifyWeCom(data) {
  if (!WECOM_WEBHOOK_URL) return;
  const payload = JSON.stringify({
    msgtype: 'markdown',
    markdown: {
      content:
        '**新的试用预约**\n' +
        '> 医院：' + data.hospital + '\n' +
        '> 科室：' + (data.department) + '\n' +
        '> 姓名：' + data.name + '\n' +
        '> 电话：' + data.phone + '\n' +
        (data.note ? '> 说明：' + data.note + '\n' : ''),
    },
  });
  fetch(WECOM_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    signal: AbortSignal.timeout(5000),
  }).catch(() => { }); // 通知失败不影响主流程
}

// ==================== 页面：预约表单 ====================
const deptOptions = DEPARTMENTS.map((d) => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');

const FORM_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>产品试用预约</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
         background: #f2f4f7; color: #1f2329; min-height: 100vh; }
  .wrap { max-width: 480px; margin: 0 auto; padding: 24px 16px 40px; }
  .card { background: #fff; border-radius: 12px; padding: 24px 20px; box-shadow: 0 2px 8px rgba(31,35,41,.06); }
  h1 { font-size: 20px; text-align: center; margin-bottom: 6px; }
  .sub { font-size: 13px; color: #8f959e; text-align: center; margin-bottom: 24px; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 16px 0 6px; }
  label .req { color: #f54a45; margin-left: 2px; }
  input, select, textarea { width: 100%; border: 1px solid #dcdfe6; border-radius: 8px;
         padding: 11px 12px; font-size: 16px; background: #fff; color: #1f2329; outline: none;
         -webkit-appearance: none; appearance: none; }
  select { background-image: none; }
  input:focus, select:focus, textarea:focus { border-color: #00b96b; }
  textarea { resize: vertical; min-height: 76px; }
  .hint { font-size: 12px; color: #8f959e; margin-top: 4px; }
  .btn { display: block; width: 100%; margin-top: 28px; border: none; border-radius: 8px;
         background: #00b96b; color: #fff; font-size: 17px; font-weight: 600;
         padding: 13px 0; cursor: pointer; }
  .btn:disabled { opacity: .6; }
  .err { display: none; margin-top: 14px; padding: 10px 12px; border-radius: 8px;
         background: #fef1f1; color: #f54a45; font-size: 14px; }
  .privacy { margin-top: 20px; font-size: 12px; color: #8f959e; line-height: 1.7; }
  .ok-card { display: none; text-align: center; padding: 40px 0 16px; }
  .ok-icon { width: 64px; height: 64px; line-height: 64px; margin: 0 auto 18px; border-radius: 50%;
             background: #e8f8f0; color: #00b96b; font-size: 32px; font-weight: 700; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card" id="formCard">
    <h1>产品试用预约</h1>
    <p class="sub">请留下您的信息，我们会尽快与您联系</p>
    <form id="form" autocomplete="off">
      <label>医院<span class="req">*</span></label>
      <input name="hospital" type="text" maxlength="50" placeholder="请填写医院全称">

      <label>科室<span class="req">*</span></label>
      <select name="department" required>
        <option value="">请选择科室</option>
        ${deptOptions}
      </select>

      <label>您的姓名<span class="req">*</span></label>
      <input name="name" type="text" maxlength="20" placeholder="请填写姓名">

      <label>联系电话<span class="req">*</span></label>
      <input name="phone" type="tel" maxlength="20" placeholder="请填写手机号">

      <label>说明 / 建议</label>
      <textarea name="note" maxlength="500" placeholder="（选填）想试用的产品、场景或特殊需求等"></textarea>
      <div class="hint">最多 500 字</div>

      <button class="btn" type="submit" id="submitBtn">提交预约</button>
      <div class="err" id="errMsg"></div>
      <p class="privacy">提交即表示您同意我们仅将以上信息用于本次试用安排与联系。信息不会被分享给第三方，您可以随时联系我们删除。</p>
    </form>
  </div>

  <div class="card ok-card" id="okCard">
    <div class="ok-icon">✓</div>
    <h1>提交成功</h1>
    <p class="sub">感谢您的预约，我们会尽快与您联系</p>
  </div>
</div>

<script>
(function () {
  var form = document.getElementById('form');
  var btn = document.getElementById('submitBtn');
  var errMsg = document.getElementById('errMsg');

  function showError(msg) {
    errMsg.textContent = msg;
    errMsg.style.display = 'block';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errMsg.style.display = 'none';

    var data = {
      hospital: form.hospital.value.trim(),
      department: form.department.value,
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      note: form.note.value.trim()
    };

    if (data.hospital.length <= 2 || data.hospital.length > 50) {
      showError('请填写医院名称（3-50 字）'); return;
    }
    if (!data.department) { showError('请选择科室'); return; }
    if (data.name.length < 2 || data.name.length > 20) {
      showError('请填写姓名（2-20 字）'); return;
    }
    if (!data.phone) { showError('请填写联系电话'); return; }

    btn.disabled = true;
    btn.textContent = '提交中…';

    fetch('api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, body: j }; });
    }).then(function (res) {
      if (res.status === 200 && res.body.ok) {
        document.getElementById('formCard').style.display = 'none';
        document.getElementById('okCard').style.display = 'block';
        window.scrollTo(0, 0);
      } else {
        showError((res.body && res.body.message) || '提交失败，请稍后重试');
        btn.disabled = false;
        btn.textContent = '提交预约';
      }
    }).catch(function () {
      showError('网络异常，请检查网络后重试');
      btn.disabled = false;
      btn.textContent = '提交预约';
    });
  });
})();
</script>
</body>
</html>`;

// ==================== 页面：管理后台 ====================
function buildAdminHTML() {
  const rows = listStmt.all();
  const count = countStmt.get().n;
  const trs = rows.map((r) =>
    '<tr>' +
    '<td>' + r.id + '</td>' +
    '<td>' + escapeHTML(r.hospital) + '</td>' +
    '<td>' + escapeHTML(r.department || '—') + '</td>' +
    '<td>' + escapeHTML(r.name) + '</td>' +
    '<td>' + escapeHTML(r.phone) + '</td>' +
    '<td>' + escapeHTML(r.note || '—') + '</td>' +
    '<td>' + escapeHTML(r.created_at) + '</td>' +
    '</tr>'
  ).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>预约管理后台</title>
<style>
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 24px; color: #1f2329; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #8f959e; font-size: 13px; margin-bottom: 16px; }
  a.export { display: inline-block; margin-bottom: 12px; padding: 8px 16px; border-radius: 8px;
             background: #00b96b; color: #fff; text-decoration: none; font-size: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; background: #fff; }
  th, td { border: 1px solid #e5e6eb; padding: 8px 10px; text-align: left; word-break: break-all; }
  th { background: #f7f8fa; position: sticky; top: 0; }
  tr:hover td { background: #f7fcf9; }
  .empty { padding: 32px; text-align: center; color: #8f959e; }
</style>
</head>
<body>
<h1>预约管理后台</h1>
<p class="meta">共 ${count} 条记录（最多显示最近 500 条）</p>
<a class="export" href="admin/export.csv">导出 CSV</a>
<table>
  <thead>
    <tr><th>#</th><th>医院</th><th>科室</th><th>姓名</th><th>电话</th><th>说明/建议</th><th>提交时间</th></tr>
  </thead>
  <tbody>${trs || '<tr><td class="empty" colspan="7">暂无预约记录</td></tr>'}</tbody>
</table>
</body>
</html>`;
}

// ==================== Basic Auth ====================
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest(); }

function checkAuth(req) {
  if (!ADMIN_PASS) return false; // 未配置密码则一律拒绝
  const h = req.headers['authorization'] || '';
  const m = /^Basic ([A-Za-z0-9+/=]+)$/.exec(h);
  if (!m) return false;
  let decoded;
  try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch { return false; }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  try {
    return crypto.timingSafeEqual(sha256(user), sha256(ADMIN_USER)) &&
      crypto.timingSafeEqual(sha256(pass), sha256(ADMIN_PASS));
  } catch { return false; }
}

function denyAuth(res) {
  sendText(res, 401, '未授权', { 'WWW-Authenticate': 'Basic realm="admin", charset="UTF-8"' });
}

// ==================== CSV 导出 ====================
function buildCSV() {
  const rows = listStmt.all();
  const header = ['序号', '医院', '科室', '姓名', '电话', '说明/建议', '提交时间'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([r.id, r.hospital, r.department || '', r.name, r.phone, r.note || '', r.created_at].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n'); // BOM 让 Excel 正确识别 UTF-8
}

// ==================== 路由 ====================
const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  try {
    // ---- 健康检查 ----
    if (url === '/healthz') return sendJSON(res, 200, { ok: true });

    // ---- 预约表单页 ----
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      return sendText(res, 200, FORM_HTML, { 'Cache-Control': 'no-store' });
    }

    // ---- 提交预约 ----
    if (req.method === 'POST' && url === '/api/reserve') {
      const ip = clientIP(req);
      if (!allowRequest(ip)) {
        return sendJSON(res, 429, { ok: false, message: '提交过于频繁，请稍后再试' });
      }
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (e) {
        const tooLarge = e.statusCode === 413;
        return sendJSON(res, tooLarge ? 413 : 400, {
          ok: false,
          message: tooLarge ? '请求内容过大' : '请求格式错误',
        });
      }
      const v = validateInput(body);
      if (v.err) return sendJSON(res, 422, { ok: false, message: v.err });

      const info = insertStmt.run(v.ok.hospital, v.ok.department, v.ok.name, v.ok.phone, v.ok.note,
        String(req.headers['user-agent'] || '').slice(0, 300));
      notifyWeCom(v.ok);
      return sendJSON(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
    }

    // ---- 管理后台 ----
    if (url === '/admin' || url === '/admin/export.csv') {
      if (!checkAuth(req)) return denyAuth(res);
      if (url === '/admin') {
        return sendText(res, 200, buildAdminHTML(), { 'Cache-Control': 'no-store' });
      }
      const buf = Buffer.from(buildCSV());
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="trialreservations.csv"',
        'Content-Length': buf.length,
      });
      return res.end(buf);
    }

    return sendText(res, 404, '<h1>404 Not Found</h1>');
  } catch (e) {
    console.error('[' + new Date().toISOString() + '] error:', e);
    if (!res.headersSent) sendJSON(res, 500, { ok: false, message: '服务器内部错误' });
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log('trialreservation server listening on ' + HOST + ':' + PORT);
  console.log('  DB_PATH=' + DB_PATH);
  console.log('  admin ' + (ADMIN_PASS ? 'enabled (user=' + ADMIN_USER + ')' : 'DISABLED: set ADMIN_PASS to enable'));
  console.log('  wecom notify ' + (WECOM_WEBHOOK_URL ? 'enabled' : 'disabled'));
});

process.on('SIGTERM', () => { console.log('bye'); server.close(() => process.exit(0)); });
