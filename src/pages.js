'use strict';

const { PAGE_SIZE } = require('./admin-query');
const { csvCell, escapeHTML } = require('./safe-output');

const QR_IMAGE_URL = 'imgs/wechat-official-account-qrcode_for_gh_4b320bf4dce6_1280.jpg';

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
  .err { display: none; margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 14px; }
  .err { background: #fef1f1; color: #f54a45; }
  .privacy { margin-top: 20px; font-size: 12px; color: #8f959e; line-height: 1.7; }
  .returning, .success { margin-bottom: 20px; line-height: 1.7; }
  .summary { margin-top: 12px; font-size: 14px; }
  .follow { margin-top: 20px; padding-top: 18px; border-top: 1px solid #eef0f3; text-align: center; }
  .follow p { font-size: 14px; }
  .qrcode { display: block; width: 180px; height: 180px; margin: 12px auto 0; border-radius: 8px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>产品试用预约</h1>
    <p class="sub" id="subtitle">请留下您的信息，我们会尽快与您联系</p>
    <section id="returningActions" class="returning" hidden>
      <h2 style="font-size:16px;margin-bottom:8px">欢迎回来</h2>
      <p>此浏览器已有预约记录，您可以查看上次填写的信息，或创建新的预约。</p>
      <button type="button" class="btn" id="viewPreviousBtn">查看上次预约信息</button>
      <button type="button" class="btn secondary" id="createNewBtn">创建新的预约</button>
    </section>
    <section id="successState" class="success" hidden>
      <h2 style="font-size:16px;margin-bottom:8px">预约提交成功</h2>
      <p>感谢您的提交，我们会尽快与您联系。</p>
      <div class="summary">
        <p>医院：<strong id="successHospital"></strong></p>
        <p>姓名：<strong id="successName"></strong></p>
      </div>
      <p id="storageWarning" class="hint" hidden>此浏览器无法保存访问凭证，关闭页面后将无法查看此预约。</p>
      <div class="follow">
        <p>为了与我们保持更多联系，欢迎关注即时超声公众号</p>
        <img id="qrcodeImg" class="qrcode" alt="即时超声公众号二维码" width="180" height="180" data-src="${QR_IMAGE_URL}">
      </div>
    </section>
    <form id="form" autocomplete="off" hidden>
      <h2 id="formTitle" style="font-size:16px;margin-bottom:8px">新建预约</h2>
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
      <p id="revisionHint" class="hint" hidden>保存后将更新此设备显示的最新预约信息，之前提交的记录仍会保留。</p>
      <button class="btn" type="submit" id="submitBtn">提交预约</button>
      <div class="err" id="errMsg" role="alert"></div>
      <p class="privacy">提交即表示您同意我们仅将以上信息用于本次试用安排与联系。信息不会被分享给第三方，您可以随时联系我们删除。</p>
    </form>
  </div>
</div>

<script>
(function () {
  var form = document.getElementById('form');
  var submitBtn = document.getElementById('submitBtn');
  var errMsg = document.getElementById('errMsg');
  var returningActions = document.getElementById('returningActions');
  var successState = document.getElementById('successState');
  var formTitle = document.getElementById('formTitle');
  var revisionHint = document.getElementById('revisionHint');
  var subtitle = document.getElementById('subtitle');
  var latestReservation = null;
  var accessToken = null;

  function showError(message) {
    errMsg.textContent = message;
    errMsg.style.display = 'block';
  }

  function showForm(usePrevious) {
    returningActions.hidden = true;
    successState.hidden = true;
    form.hidden = false;
    subtitle.hidden = false;
    form.reset();
    formTitle.textContent = usePrevious ? '修改上次预约' : '新建预约';
    submitBtn.textContent = usePrevious ? '保存修改' : '提交预约';
    revisionHint.hidden = !usePrevious;
    if (usePrevious && latestReservation) {
      form.hospital.value = latestReservation.hospital;
      form.department.value = latestReservation.department;
      form.name.value = latestReservation.name;
      form.phone.value = latestReservation.phone;
      form.note.value = latestReservation.note || '';
    }
    errMsg.style.display = 'none';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearAccessToken() {
    accessToken = null;
    try {
      localStorage.removeItem('trialReservationAccessToken');
      return true;
    } catch (_) {
      return false;
    }
  }

  function showReturningActions(item) {
    latestReservation = item;
    form.hidden = true;
    successState.hidden = true;
    subtitle.hidden = true;
    returningActions.hidden = false;
  }

  function showSuccess(data, storageFailed) {
    form.hidden = true;
    returningActions.hidden = true;
    subtitle.hidden = true;
    document.getElementById('successHospital').textContent = data.hospital;
    document.getElementById('successName').textContent = data.name;
    document.getElementById('storageWarning').hidden = !storageFailed;
    var qrcode = document.getElementById('qrcodeImg');
    if (qrcode && !qrcode.getAttribute('src')) {
      qrcode.setAttribute('src', qrcode.getAttribute('data-src'));
    }
    successState.hidden = false;
  }

  function loadReservations(readStoredToken) {
    if (readStoredToken) {
      try {
        accessToken = localStorage.getItem('trialReservationAccessToken');
      } catch (_) {
        form.hidden = false;
        showError('此浏览器无法读取预约访问凭证，请检查浏览器存储设置。');
        return;
      }
    }
    if (!accessToken) {
      form.hidden = false;
      return;
    }
    fetch('api/reservations', {
      headers: { Authorization: 'Bearer ' + accessToken }
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 401) {
        var tokenCleared = clearAccessToken();
        form.hidden = false;
        showError('访问凭证已过期（连续 30 天未成功访问）。原预约记录仍保留，但无法通过此凭证查看；您可以重新创建预约。' +
          (tokenCleared ? '' : ' 无法清除浏览器中的旧凭证，请清理此网站的浏览器数据。'));
        return;
      }
      if (!result.body.ok) throw new Error('Unable to load reservations');
      var latest = result.body.reservations[0];
      if (latest) showReturningActions(latest);
      else form.hidden = false;
    }).catch(function () {
      form.hidden = false;
      showError('暂时无法读取此设备的预约记录，请稍后重试。');
    });
  }

  document.getElementById('viewPreviousBtn').addEventListener('click', function () {
    showForm(true);
  });
  document.getElementById('createNewBtn').addEventListener('click', function () {
    showForm(false);
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
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
    if (data.name.length < 2 || data.name.length > 20) {
      showError('请填写姓名（2-20 字）'); return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
    var headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    fetch('api/reserve', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 401) {
        var tokenCleared = clearAccessToken();
        showError('访问凭证已过期，本次未创建预约。请再次提交以使用新凭证创建预约；原记录无法通过此凭证查看。' +
          (tokenCleared ? '' : ' 无法清除浏览器中的旧凭证，请清理此网站的浏览器数据。'));
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
        }
      }
      showSuccess(data, storageFailed);
    }).catch(function () {
      showError('网络异常，请检查网络后重试');
    }).finally(function () {
      submitBtn.disabled = false;
      if (submitBtn.textContent === '提交中…') {
        submitBtn.textContent = revisionHint.hidden ? '提交预约' : '保存修改';
      }
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
  .button-link { display: inline-block; padding: 9px 14px; border: 1px solid #007a52;
    border-radius: 5px; background: #008a52; color: #fff; text-decoration: none; }
  .button-link:hover { background: #006f43; }
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
<div class="actions"><a class="button-link" href="${escapeHTML(exportLink)}">Export filtered CSV (up to 10,000 rows)</a></div>
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

module.exports = { buildCSV, QR_IMAGE_URL, renderAdminPage, renderReservationPage };
