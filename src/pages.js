'use strict';

const { PAGE_SIZE } = require('./admin-query');
const { csvCell, escapeHTML } = require('./safe-output');

function renderReservationPage(departments) {
  const departmentOptions = departments
    .map((department) => `<option value="${escapeHTML(department)}">${escapeHTML(department)}</option>`)
    .join('');

  return `<!DOCTYPE html>
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
  .btn { display: block; width: 100%; margin-top: 20px; border: none; border-radius: 8px;
         background: #00b96b; color: #fff; font-size: 17px; font-weight: 600;
         padding: 13px 0; cursor: pointer; }
  .btn:disabled { opacity: .6; }
  .secondary { background: #eef0f3; color: #1f2329; }
  .err, .notice { display: none; margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 14px; }
  .err { background: #fef1f1; color: #f54a45; }
  .notice { background: #e8f8f0; color: #16834e; }
  .privacy { margin-top: 20px; font-size: 12px; color: #8f959e; line-height: 1.7; }
  .reservations { margin-bottom: 20px; }
  .reservation-item { border-top: 1px solid #e5e6eb; padding: 12px 0; font-size: 14px; line-height: 1.6; }
  .reservation-item button { border: 0; background: none; color: #008a52; padding: 6px 0; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>产品试用预约</h1>
    <p class="sub">请留下您的信息，我们会尽快与您联系</p>
    <section id="reservations" class="reservations" hidden>
      <h2 style="font-size:16px;margin-bottom:8px">此设备的预约记录</h2>
      <div id="reservationList"></div>
      <p id="reservationLimit" class="hint" hidden>这里只显示最近 100 条记录</p>
      <button type="button" class="btn secondary" id="addAnotherBtn">新增预约</button>
    </section>
    <form id="form" autocomplete="off">
      <label>医院<span class="req">*</span></label>
      <input name="hospital" type="text" maxlength="50" placeholder="请填写医院全称" required>
      <label>科室<span class="req">*</span></label>
      <select name="department" required>
        <option value="">请选择科室</option>
        ${departmentOptions}
      </select>
      <label>您的姓名<span class="req">*</span></label>
      <input name="name" type="text" maxlength="20" placeholder="请填写姓名" required>
      <label>联系电话<span class="req">*</span></label>
      <input name="phone" type="tel" maxlength="20" placeholder="请填写手机号" required>
      <label>说明 / 建议</label>
      <textarea name="note" maxlength="500" placeholder="（选填）想试用的产品、场景或特殊需求等"></textarea>
      <div class="hint">最多 500 字</div>
      <button class="btn" type="submit" id="submitBtn">提交预约</button>
      <button class="btn secondary" type="button" id="cancelEditBtn" hidden>取消修改</button>
      <div class="err" id="errMsg" role="alert"></div>
      <div class="notice" id="noticeMsg" role="status"></div>
      <p class="privacy">提交即表示您同意我们仅将以上信息用于本次试用安排与联系。信息不会被分享给第三方，您可以随时联系我们删除。</p>
    </form>
  </div>
</div>

<script>
(function () {
  var form = document.getElementById('form');
  var submitBtn = document.getElementById('submitBtn');
  var cancelEditBtn = document.getElementById('cancelEditBtn');
  var errMsg = document.getElementById('errMsg');
  var noticeMsg = document.getElementById('noticeMsg');
  var reservationsBox = document.getElementById('reservations');
  var reservationList = document.getElementById('reservationList');
  var reservationLimit = document.getElementById('reservationLimit');
  var accessToken = null;
  var editingId = null;
  var reservations = [];

  function showError(message) {
    noticeMsg.style.display = 'none';
    errMsg.textContent = message;
    errMsg.style.display = 'block';
  }

  function showNotice(message) {
    errMsg.style.display = 'none';
    noticeMsg.textContent = message;
    noticeMsg.style.display = 'block';
  }

  function resetForm() {
    form.reset();
    editingId = null;
    submitBtn.textContent = '提交预约';
    cancelEditBtn.hidden = true;
  }

  function renderReservations(items, truncated) {
    reservations = items;
    reservationList.replaceChildren();
    reservationsBox.hidden = items.length === 0;
    reservationLimit.hidden = !truncated;
    items.forEach(function (item) {
      var entry = document.createElement('div');
      entry.className = 'reservation-item';
      var details = document.createElement('div');
      details.textContent = item.hospital + ' · ' + item.department + ' · ' + item.name +
        ' · ' + item.phone + ' · ' + item.created_at;
      var edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = '修改此预约';
      edit.addEventListener('click', function () {
        form.hospital.value = item.hospital;
        form.department.value = item.department;
        form.name.value = item.name;
        form.phone.value = item.phone;
        form.note.value = item.note || '';
        editingId = item.id;
        submitBtn.textContent = '保存修改';
        cancelEditBtn.hidden = false;
        errMsg.style.display = 'none';
        noticeMsg.style.display = 'none';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      entry.append(details, edit);
      reservationList.append(entry);
    });
  }

  function forgetToken(message) {
    accessToken = null;
    var storageCleanupFailed = false;
    try {
      localStorage.removeItem('trialReservationAccessToken');
    } catch (error) {
      storageCleanupFailed = true;
    }
    renderReservations([], false);
    resetForm();
    showError(message + (storageCleanupFailed ? ' 无法清除旧凭证，请清理浏览器站点数据后重试。' : ''));
  }

  function loadReservations(readStoredToken) {
    if (readStoredToken) {
      try {
        accessToken = localStorage.getItem('trialReservationAccessToken');
      } catch (error) {
        showError('此浏览器无法读取预约访问凭证，请检查浏览器存储设置。');
        return;
      }
    }
    if (!accessToken) return;
    fetch('api/reservations', {
      headers: { Authorization: 'Bearer ' + accessToken }
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 401) {
        forgetToken('本设备的预约访问已过期，请重新提交预约。原预约记录仍保留，但无法通过此设备凭证修改。');
        return;
      }
      if (!result.body.ok) throw new Error('Unable to load reservations');
      renderReservations(result.body.reservations, result.body.truncated);
    }).catch(function () {
      showError('暂时无法读取此设备的预约记录，请稍后重试。');
    });
  }

  document.getElementById('addAnotherBtn').addEventListener('click', function () {
    resetForm();
    errMsg.style.display = 'none';
    noticeMsg.style.display = 'none';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  cancelEditBtn.addEventListener('click', function () {
    resetForm();
    errMsg.style.display = 'none';
    noticeMsg.style.display = 'none';
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errMsg.style.display = 'none';
    noticeMsg.style.display = 'none';
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
    if (data.name.length < 2 || data.name.length > 20) {
      showError('请填写姓名（2-20 字）'); return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
    var updating = editingId !== null;
    var headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    var endpoint = editingId === null ? 'api/reserve' : 'api/reservations/' + editingId;
    fetch(endpoint, {
      method: editingId === null ? 'POST' : 'PUT',
      headers: headers,
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 401) {
        forgetToken('访问凭证已过期。您仍可新增预约；原记录无法使用此凭证修改。');
        return;
      }
      if (result.status !== 200 || !result.body.ok) {
        showError(result.body.message || '提交失败，请稍后重试');
        return;
      }
      var storageFailed = false;
      if (result.body.accessToken) {
        accessToken = result.body.accessToken;
        try {
          localStorage.setItem('trialReservationAccessToken', accessToken);
        } catch (_) {
          storageFailed = true;
          showError('预约已提交，但浏览器无法保存访问凭证；关闭此页面后将无法取回此预约。');
        }
      }
      resetForm();
      if (!storageFailed) {
        showNotice(updating ? '预约已更新。' : '预约已提交。此浏览器可查看和修改此设备提交的预约。');
      }
      loadReservations(false);
    }).catch(function () {
      showError('网络异常，请检查网络后重试');
    }).finally(function () {
      submitBtn.disabled = false;
      if (editingId !== null) submitBtn.textContent = '保存修改';
      else if (submitBtn.textContent === '提交中…') submitBtn.textContent = '提交预约';
    });
  });

  loadReservations(true);
})();
</script>
</body>
</html>`;
}

function queryString(filters, page) {
  const params = new URLSearchParams();
  if (filters.name) params.set('name', filters.name);
  if (filters.hospital) params.set('hospital', filters.hospital);
  if (filters.department) params.set('department', filters.department);
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reservation Admin</title>
<style>
  body { font-family: sans-serif; margin: 24px; color: #1f2329; }
  h1 { font-size: 20px; }
  form { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin: 16px 0; }
  label { display: grid; gap: 4px; font-size: 13px; }
  input, button { padding: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; background: #fff; }
  th, td { border: 1px solid #e5e6eb; padding: 8px 10px; text-align: left; word-break: break-word; }
  th { background: #f7f8fa; }
  .actions, .pages { margin: 14px 0; display: flex; gap: 16px; align-items: center; }
  .empty { padding: 32px; text-align: center; color: #8f959e; }
</style>
</head>
<body>
<h1>Reservation Admin</h1>
<p>${result.total} matching reservations</p>
<form method="get">
  <label>Name
    <input name="name" maxlength="100" value="${escapeHTML(filters.name)}">
  </label>
  <label>Hospital
    <input name="hospital" maxlength="100" value="${escapeHTML(filters.hospital)}">
  </label>
  <label>Department
    <input name="department" maxlength="100" value="${escapeHTML(filters.department)}">
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
<div class="actions"><a href="${escapeHTML(exportLink)}">Export filtered CSV (up to 10,000 rows)</a></div>
<table>
  <thead><tr><th>#</th><th>Hospital</th><th>Department</th><th>Name</th><th>Phone</th><th>Notes</th><th>Created</th></tr></thead>
  <tbody>${rows || '<tr><td class="empty" colspan="7">No reservations found.</td></tr>'}</tbody>
</table>
<nav class="pages" aria-label="Pagination">
  ${previous}<span>Page ${result.page} of ${result.pages}; ${PAGE_SIZE} per page</span>${next}
</nav>
</body>
</html>`;
}

function buildCSV(rows) {
  const header = ['ID', 'Hospital', 'Department', 'Name', 'Phone', 'Notes', 'Created at'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push([
      row.id, row.hospital, row.department || '', row.name, row.phone, row.note || '', row.created_at,
    ].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

module.exports = { buildCSV, renderAdminPage, renderReservationPage };
