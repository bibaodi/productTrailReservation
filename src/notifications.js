'use strict';

const MARKDOWN_REPLACEMENTS = Object.freeze({
  '&': '＆',
  '<': '＜',
  '>': '＞',
  '`': '｀',
  '*': '＊',
  '_': '＿',
  '{': '｛',
  '}': '｝',
  '[': '［',
  ']': '］',
  '(': '（',
  ')': '）',
  '#': '＃',
  '+': '＋',
  '.': '．',
  '!': '！',
  '~': '～',
  '|': '｜',
  '\\': '＼',
  '@': '＠',
  ':': '：',
  '/': '／',
  '-': '－',
});

function escapeMarkdown(value) {
  return value.replace(/[&<>`*_{}\[\]()#+.!~|\\@:/-]/g, (character) =>
    MARKDOWN_REPLACEMENTS[character] || character
  );
}

function createWeComNotifier(webhookURL, fetchImpl = fetch) {
  return function notifyWeCom(data) {
    if (!webhookURL) return;
    const safe = Object.fromEntries(
      Object.entries(data).map(([key, value]) =>
        [key, escapeMarkdown(value == null ? '' : String(value))])
    );
    const payload = JSON.stringify({
      msgtype: 'markdown',
      markdown: {
        content:
          '**新的试用预约**\n' +
          '> 医院：' + safe.hospital + '\n' +
          '> 科室：' + safe.department + '\n' +
          (safe.product ? '> 产品：' + safe.product + '\n' : '') +
          '> 姓名：' + safe.name + '\n' +
          '> 电话：' + safe.phone + '\n' +
          (safe.note ? '> 说明：' + safe.note + '\n' : ''),
      },
    });
    try {
      fetchImpl(webhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(5000),
      }).catch((error) => {
        console.error('WeCom notification failed:', error.name);
      });
    } catch (error) {
      console.error('WeCom notification failed:', error.name);
    }
  };
}

module.exports = { createWeComNotifier, escapeMarkdown };
