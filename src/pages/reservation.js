'use strict';

const { escapeHTML } = require('../safe-output');
const { DEFAULT_TYPE, getReservationType } = require('../reservation-types');
const {
  DEFAULT_DEPARTMENTS,
  DEFAULT_PRODUCTS,
  DEFAULT_QR_CAPTION,
} = require('../settings');

const QR_IMAGE_URL = 'imgs/wechat-official-account-qrcode_for_gh_4b320bf4dce6_1280.jpg';

function renderReservationPage(
  departments,
  {
    products = DEFAULT_PRODUCTS,
    qrCaption = DEFAULT_QR_CAPTION,
    type = DEFAULT_TYPE,
    noteNotice = '',
  } = {},
) {
  const typeConfig = getReservationType(type);
  const departmentChoices = Array.isArray(departments) && departments.length
    ? departments
    : DEFAULT_DEPARTMENTS;
  const productChoices = Array.isArray(products) && products.length ? products : DEFAULT_PRODUCTS;
  const departmentOptions = departmentChoices
    .map((department) => `<option value="${escapeHTML(department)}">${escapeHTML(department)}</option>`)
    .join('');
  const productOptions = productChoices
    .map((product) => `<option value="${escapeHTML(product)}">${escapeHTML(product)}</option>`)
    .join('');
  // A single configured product needs no picker: show its name in the header
  // and submit it through a hidden field.
  const singleProduct = productChoices.length === 1;
  const productHeader = singleProduct
    ? `<p class="product" id="productName">${escapeHTML(typeConfig.productLabel)}：<strong>${escapeHTML(productChoices[0])}</strong></p>`
    : '';
  const productField = singleProduct
    ? `<input type="hidden" name="product" value="${escapeHTML(productChoices[0])}">`
    : `<label>${escapeHTML(typeConfig.productLabel)}<span class="req">*</span></label>
      <select name="product" required>
        <option value="">请选择产品</option>${productOptions}
      </select>`;
  const pageTitle = (singleProduct ? escapeHTML(productChoices[0]) + ' - ' : '') + typeConfig.title;
  // The demo page shows the attention text below the note box. It is a static
  // callout, not pre-filled content, so the user's note starts empty.
  const noticeText = typeConfig.key === 'demo' ? noteNotice : '';
  const noticeBlock = noticeText
    ? `<p class="note-notice" id="noteNotice"><strong>${escapeHTML(noticeText)}</strong></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>${pageTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
         background: #f2f4f7; color: #1f2329; min-height: 100vh; }
  .wrap { max-width: 480px; margin: 0 auto; padding: 16px 12px 28px; }
  .card { background: #fff; border-radius: 12px; padding: 20px 16px; box-shadow: 0 2px 8px rgba(31,35,41,.06); }
  h1 { font-size: 19px; text-align: center; margin-bottom: 4px; }
  .product { font-size: 15px; text-align: center; color: #1f2329; margin: 3px 0 6px; }
  .product strong { color: #00b96b; }
  .sub { font-size: 13px; color: #8f959e; text-align: center; margin-bottom: 16px; }
  label { display: block; font-size: 14px; font-weight: 600; margin: 12px 0 5px; }
  label .req { color: #f54a45; margin-left: 2px; }
  input, select, textarea { width: 100%; border: 1px solid #dcdfe6; border-radius: 8px;
         padding: 10px 12px; font-size: 16px; background: #fff; color: #1f2329; outline: none;
         -webkit-appearance: none; appearance: none; }
  select { background-image: none; }
  input:focus, select:focus, textarea:focus { border-color: #00b96b; }
  textarea { resize: none; }
  .note-field { position: relative; }
  .note-field textarea { height: 84px; overflow-y: auto; line-height: 1.5; }
  .note-field.has-expand textarea { padding-right: 46px; }
  textarea::placeholder { font-size: 14px; color: #8f959e; }
  .note-expand { position: absolute; right: 6px; top: 6px; width: 30px; height: 30px;
         display: inline-flex; align-items: center; justify-content: center;
         border: 1px solid #e5e6eb; border-radius: 6px; background: rgba(255,255,255,.95);
         color: #4e5969; cursor: pointer; padding: 0; font-size: 0; }
  .note-expand[hidden] { display: none; }
  .note-expand:active { background: #eef0f3; }
  .note-notice { margin-top: 8px; padding: 9px 11px; border-radius: 8px;
         background: #fff7e6; border: 1px solid #f0b429; color: #8a5a00;
         font-size: 13px; line-height: 1.6; font-weight: 700; }
  .hint { font-size: 12px; color: #8f959e; margin-top: 3px; }
  .hint.invalid { color: #f54a45; }
  .btn { display: block; width: 100%; margin-top: 16px; border: none; border-radius: 8px;
         background: #00b96b; color: #fff; font-size: 17px; font-weight: 600;
         padding: 12px 0; cursor: pointer; }
  .btn:disabled { opacity: .6; }
  .secondary { background: #eef0f3; color: #1f2329; }
  .err { display: none; margin-top: 14px; padding: 10px 12px; border-radius: 8px; font-size: 14px; }
  .err { background: #fef1f1; color: #f54a45; }
  .privacy { margin-top: 14px; font-size: 11px; color: #8f959e; line-height: 1.6; }
  .returning, .success { margin-bottom: 20px; line-height: 1.7; }
  .summary { margin-top: 12px; font-size: 14px; }
  .follow { margin-top: 20px; padding-top: 18px; border-top: 1px solid #eef0f3; text-align: center; }
  .follow p { font-size: 14px; }
  .qrcode { display: block; width: 180px; height: 180px; margin: 12px auto 0; border-radius: 8px; }
  body.editing-note { overflow: hidden; }
  .editor-overlay { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column;
         background: #fff; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
  .editor-overlay[hidden] { display: none; }
  .editor-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
         border-bottom: 1px solid #eef0f3; }
  .editor-title { flex: 1; font-size: 16px; font-weight: 600; }
  .editor-count { font-size: 12px; color: #8f959e; }
  .editor-done { border: none; border-radius: 6px; background: #00b96b; color: #fff;
         padding: 7px 14px; font-size: 14px; cursor: pointer; }
  .editor-overlay textarea { flex: 1; align-self: stretch; width: auto; margin: 12px 16px 16px;
         padding: 12px; border: 1px solid #dcdfe6; border-radius: 8px; font-size: 16px;
         line-height: 1.6; resize: none; overflow-y: auto; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <h1>${escapeHTML(typeConfig.title)}</h1>
    ${productHeader}
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
        <p id="qrCaption">${escapeHTML(qrCaption)}</p>
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
      ${productField}
      <label>您的姓名<span class="req">*</span></label>
      <input name="name" type="text" maxlength="20" placeholder="请填写姓名" required>
      <label>联系电话<span class="req">*</span></label>
      <input name="phone" type="tel" maxlength="20" placeholder="请填写手机号" required>
      <label>说明 / 建议</label>
      <div class="note-field">
        <textarea name="note" id="noteField" class="note" maxlength="500" rows="3" placeholder="（选填）产品、场景或特殊需求"></textarea>
        <button type="button" class="note-expand" id="noteExpandBtn" aria-label="展开全屏编辑说明 / 建议" title="全屏编辑" hidden>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="hint">最多 500 字</div>
      ${noticeBlock}
      <button class="btn" type="submit" id="submitBtn">提交预约</button>
      <p id="saveStateHint" class="hint" hidden></p>
      <div class="err" id="errMsg" role="alert"></div>
      <p class="privacy">提交即表示您同意我们仅将以上信息用于本次${typeConfig.privacyVerb}安排与联系。信息不会被分享给第三方，您可以随时联系我们删除。</p>
    </form>
  </div>
</div>

<div class="editor-overlay" id="noteEditor" role="dialog" aria-modal="true" aria-label="编辑说明 / 建议" hidden>
  <div class="editor-head">
    <span class="editor-title">说明 / 建议</span>
    <span class="editor-count" id="noteEditorCount">0/500</span>
    <button type="button" class="editor-done" id="noteEditorDone">完成</button>
  </div>
  <textarea id="noteEditorInput" maxlength="500" placeholder="（选填）产品、场景或特殊需求"></textarea>
</div>

<script>
(function () {
  var form = document.getElementById('form');
  var submitBtn = document.getElementById('submitBtn');
  var errMsg = document.getElementById('errMsg');
  var returningActions = document.getElementById('returningActions');
  var successState = document.getElementById('successState');
  var formTitle = document.getElementById('formTitle');
  var saveStateHint = document.getElementById('saveStateHint');
  var subtitle = document.getElementById('subtitle');
  var noteField = document.getElementById('noteField');
  var noteExpandBtn = document.getElementById('noteExpandBtn');
  var noteEditor = document.getElementById('noteEditor');
  var noteEditorInput = document.getElementById('noteEditorInput');
  var noteEditorCount = document.getElementById('noteEditorCount');
  var noteEditorDone = document.getElementById('noteEditorDone');
  var RESERVATION_TYPE = ${JSON.stringify(typeConfig.key)};
  var latestReservation = null;
  var accessToken = null;
  var formMode = 'create';
  var originalData = null;
  var submitting = false;

  function showError(message) {
    errMsg.textContent = message;
    errMsg.style.display = 'block';
  }

  // The expand button mirrors WeChat: it appears when the note no longer fits
  // the compact three-line box, and opens a near-full-screen editor.
  function updateNoteExpand() {
    if (!noteExpandBtn || !noteField) return;
    noteExpandBtn.hidden = noteField.scrollHeight <= noteField.clientHeight + 1;
    // Only reserve space for the icon while it is visible, so normal text keeps
    // the full line width.
    if (noteField.parentNode) {
      noteField.parentNode.classList.toggle('has-expand', !noteExpandBtn.hidden);
    }
  }

  function updateNoteCount() {
    if (noteEditorCount) noteEditorCount.textContent = noteEditorInput.value.length + '/500';
  }

  function openNoteEditor() {
    noteEditorInput.value = noteField.value;
    updateNoteCount();
    noteEditor.hidden = false;
    document.body.classList.add('editing-note');
    noteEditorInput.focus();
    var end = noteEditorInput.value.length;
    noteEditorInput.setSelectionRange(end, end);
  }

  function closeNoteEditor() {
    noteEditor.hidden = true;
    document.body.classList.remove('editing-note');
    updateNoteExpand();
    noteField.focus();
  }

  function revealForm() {
    form.hidden = false;
    updateNoteExpand();
  }

  function currentFormData() {
    return {
      type: RESERVATION_TYPE,
      hospital: form.hospital.value.trim(),
      department: form.department.value,
      product: form.product.value,
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      note: form.note.value.trim()
    };
  }

  function normalizedReservation(item) {
    return {
      hospital: (item.hospital || '').trim(),
      department: item.department || '',
      // A single product is fixed by the server and has no visible control;
      // the caller aligns it with the submitted value after rendering.
      product: item.product || '',
      name: (item.name || '').trim(),
      phone: (item.phone || '').trim(),
      note: (item.note || '').trim()
    };
  }

  function sameReservation(a, b) {
    return a.hospital === b.hospital &&
      a.department === b.department &&
      a.product === b.product &&
      a.name === b.name &&
      a.phone === b.phone &&
      a.note === b.note;
  }

  function validPhone(phone) {
    if (phone.length > 20 || !/^[0-9+ ()（）-]+$/.test(phone)) return false;
    var normalized = phone.replace(/[ ()（）-]/g, '');
    if (normalized.slice(0, 3) === '+86') normalized = normalized.slice(3);
    else if (normalized.slice(0, 4) === '0086') normalized = normalized.slice(4);
    return /^(?:1[3-9][0-9]{9}|0[0-9]{2,3}[0-9]{7,8})$/.test(normalized);
  }

  function validateReservation(data) {
    if (data.hospital.length <= 2 || data.hospital.length > 50) {
      return '请填写医院名称（3-50 字）';
    }
    if (!data.department) return '请选择科室';
    if (!data.product) return '请选择产品';
    if (data.name.length < 2 || data.name.length > 20) {
      return '请填写姓名（2-20 字）';
    }
    if (!validPhone(data.phone)) return '联系电话格式不正确';
    if (data.note.length > 500) return '说明/建议请控制在 500 字以内';
    return '';
  }

  function updateSubmitState() {
    if (formMode !== 'edit') {
      submitBtn.disabled = submitting;
      saveStateHint.hidden = true;
      return;
    }
    var data = currentFormData();
    var error = validateReservation(data);
    if (originalData && sameReservation(data, originalData)) {
      submitBtn.disabled = true;
      saveStateHint.textContent = '信息未变更，无需保存。';
      saveStateHint.className = 'hint';
      saveStateHint.hidden = false;
      return;
    }
    if (error) {
      submitBtn.disabled = true;
      saveStateHint.textContent = error;
      saveStateHint.className = 'hint invalid';
      saveStateHint.hidden = false;
      return;
    }
    submitBtn.disabled = submitting;
    saveStateHint.hidden = true;
  }

  function showForm(usePrevious) {
    returningActions.hidden = true;
    successState.hidden = true;
    form.hidden = false;
    subtitle.hidden = false;
    formMode = usePrevious ? 'edit' : 'create';
    originalData = null;
    form.reset();
    formTitle.textContent = usePrevious ? '修改上次预约' : '新建预约';
    submitBtn.textContent = usePrevious ? '保存修改' : '提交预约';
    if (usePrevious && latestReservation) {
      form.hospital.value = latestReservation.hospital;
      form.department.value = latestReservation.department;
      if (form.product && form.product.tagName === 'SELECT') {
        form.product.value = latestReservation.product || '';
      }
      form.name.value = latestReservation.name;
      form.phone.value = latestReservation.phone;
      form.note.value = latestReservation.note || '';
      originalData = normalizedReservation(latestReservation);
      if (form.product && form.product.tagName !== 'SELECT') {
        // The single configured product is not user-editable, so it must not
        // count as a change on its own.
        originalData.product = form.product.value;
      }
    }
    errMsg.style.display = 'none';
    updateNoteExpand();
    updateSubmitState();
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
        revealForm();
        showError('此浏览器无法读取预约访问凭证，请检查浏览器存储设置。');
        return;
      }
    }
    if (!accessToken) {
      revealForm();
      return;
    }
    fetch('api/reservations?type=' + encodeURIComponent(RESERVATION_TYPE), {
      headers: { Authorization: 'Bearer ' + accessToken }
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 401) {
        var tokenCleared = clearAccessToken();
        revealForm();
        showError('访问凭证已过期（连续 30 天未成功访问）。原预约记录仍保留，但无法通过此凭证查看；您可以重新创建预约。' +
          (tokenCleared ? '' : ' 无法清除浏览器中的旧凭证，请清理此网站的浏览器数据。'));
        return;
      }
      if (!result.body.ok) throw new Error('Unable to load reservations');
      var latest = result.body.reservations[0];
      if (latest) showReturningActions(latest);
      else revealForm();
    }).catch(function () {
      revealForm();
      showError('暂时无法读取此设备的预约记录，请稍后重试。');
    });
  }

  document.getElementById('viewPreviousBtn').addEventListener('click', function () {
    showForm(true);
  });
  document.getElementById('createNewBtn').addEventListener('click', function () {
    showForm(false);
  });

  function sendReservation(data, allowTokenRetry) {
    var headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
    return fetch('api/reserve', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().then(function (body) {
        return { status: response.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 401 && allowTokenRetry) {
        // The stored credential expired or belongs to a different database.
        // The server rejected it before saving, so retry once as a new device
        // instead of making the user tap Submit again.
        clearAccessToken();
        return sendReservation(data, false);
      }
      return result;
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errMsg.style.display = 'none';
    var data = currentFormData();
    var validationError = validateReservation(data);
    if (validationError) {
      if (formMode === 'edit') {
        updateSubmitState();
      } else {
        showError(validationError);
      }
      return;
    }
    if (formMode === 'edit' && originalData && sameReservation(data, originalData)) {
      updateSubmitState();
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中…';
    sendReservation(data, true).then(function (result) {
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
      submitting = false;
      if (submitBtn.textContent === '提交中…') {
        submitBtn.textContent = formMode === 'edit' ? '保存修改' : '提交预约';
      }
      updateSubmitState();
    });
  });

  form.addEventListener('input', updateSubmitState);
  form.addEventListener('change', updateSubmitState);
  if (noteExpandBtn) noteExpandBtn.addEventListener('click', openNoteEditor);
  if (noteEditorInput) {
    noteEditorInput.addEventListener('input', function () {
      noteField.value = noteEditorInput.value;
      updateNoteCount();
      updateSubmitState();
    });
  }
  if (noteEditorDone) noteEditorDone.addEventListener('click', closeNoteEditor);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && noteEditor && !noteEditor.hidden) closeNoteEditor();
  });
  if (noteField) noteField.addEventListener('input', updateNoteExpand);
  window.addEventListener('resize', updateNoteExpand);

  loadReservations(true);
})();
</script>
</body>
</html>`;
}

module.exports = { QR_IMAGE_URL, renderReservationPage };
