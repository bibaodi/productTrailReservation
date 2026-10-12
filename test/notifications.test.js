'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWeComNotifier, escapeMarkdown } = require('../src/notifications');

test('replaces every supported Markdown metacharacter with its fullwidth equivalent', () => {
  const input = '&<>`*_{}[]()#+.!~|\\@:/-';
  const expected = '＆＜＞｀＊＿｛｝［］（）＃＋．！～｜＼＠：／－';
  assert.equal(escapeMarkdown(input), expected);
});

test('neutralizes links, mentions, formatting, and preserves ordinary text', () => {
  const input = '[Click](https://evil.test) <@all> **spoof**';
  const safe = escapeMarkdown(input);
  assert.equal(safe, '［Click］（https：／／evil．test） ＜＠all＞ ＊＊spoof＊＊');
  assert.doesNotMatch(safe, /\[|\]|\(|\)|<|>|https?:\/\//);
  assert.match(safe, /＠all/);
  assert.match(escapeMarkdown('王小明 13812345678'), /^王小明 13812345678$/);
});

test('WeCom notification escapes untrusted content in every reservation field', () => {
  let sent;
  const notify = createWeComNotifier('https://webhook.test', (url, options) => {
    sent = { url, options };
    return Promise.resolve({ ok: true });
  });
  notify({
    hospital: '[Hospital](https://evil.test)',
    department: '<@all> **department**',
    name: '`@all`',
    phone: '+86 13812345678',
    note: '[open](https://evil.test) <@all>',
  });

  assert.equal(sent.url, 'https://webhook.test');
  const message = JSON.parse(sent.options.body).markdown.content;
  assert.doesNotMatch(message, /\[Hospital\]\(https:\/\/evil\.test\)|<@all>|\*\*department\*\*|`@all`/);
  assert.match(message, /［Hospital］（https：／／evil．test）/);
  assert.match(message, /＜＠all＞ ＊＊department＊＊/);
  assert.match(message, /｀＠all｀/);
  assert.match(message, /＋86 13812345678/);
  assert.match(message, /［open］（https：／／evil．test）/);
});
