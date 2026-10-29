'use strict';

const ADMIN_STYLES = `
  body { font-family: sans-serif; margin: 0; color: #1f2329; background: #f7f8fa; }
  .admin-wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 14px; }
  .tabs { display: flex; gap: 4px; border-bottom: 2px solid #e5e6eb; margin-bottom: 18px; }
  .tab { padding: 9px 16px; color: #4e5969; text-decoration: none; font-size: 14px;
    border-bottom: 2px solid transparent; margin-bottom: -2px; }
  .tab:hover { color: #007a52; }
  .tab.active { color: #007a52; border-bottom-color: #008a52; font-weight: 600; }
  .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin: 16px 0; }
  .filters label { display: grid; gap: 4px; font-size: 13px; }
  input, button { padding: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; background: #fff; }
  th, td { border: 1px solid #e5e6eb; padding: 8px 10px; text-align: left; word-break: break-word; }
  th { background: #f7f8fa; }
  .actions, .pages { margin: 14px 0; display: flex; gap: 16px; align-items: center; }
  .button-link { display: inline-block; padding: 9px 14px; border: 1px solid #007a52;
    border-radius: 5px; background: #008a52; color: #fff; text-decoration: none; }
  .button-link:hover { background: #006f43; }
  .empty { padding: 32px; text-align: center; color: #8f959e; }
  .settings-form { display: grid; gap: 14px; margin: 18px 0; max-width: 760px; }
  .settings-form label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
  .settings-form textarea { width: 100%; padding: 10px; border: 1px solid #c9cdd4;
    border-radius: 5px; font: inherit; font-size: 14px; font-weight: 400; resize: vertical; }
  .settings-form textarea:focus { outline: 2px solid #008a52; outline-offset: 1px; }
  .settings-form button { justify-self: start; padding: 10px 18px; border: 0; border-radius: 5px;
    background: #008a52; color: #fff; font-size: 15px; cursor: pointer; }
  .settings-form button:hover { background: #006f43; }
  .hint { margin: -6px 0 0; font-size: 12px; color: #6b7280; line-height: 1.6; }
  .notice { padding: 10px 12px; border-radius: 5px; background: #e8f7ef; color: #006f43; }
  .error { padding: 10px 12px; border-radius: 5px; background: #fef1f1; color: #b42318; }
`;

function renderTabs(activeTab) {
  // Relative links keep working when the app is mounted under a reverse-proxy
  // subpath such as /trialreserve/.
  const settingsTab = activeTab === 'settings';
  const reservationsHref = settingsTab ? '../admin' : 'admin';
  const settingsHref = settingsTab ? 'settings' : 'admin/settings';
  const tab = (active, href, label) =>
    `<a class="tab${active ? ' active' : ''}" href="${href}"` +
    `${active ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="tabs" aria-label="Admin sections">
  ${tab(!settingsTab, reservationsHref, 'Reservations')}
  ${tab(settingsTab, settingsHref, 'Settings')}
</nav>`;
}

function renderAdminLayout({ title, activeTab, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${ADMIN_STYLES}</style>
</head>
<body>
<div class="admin-wrap">
<h1>${title}</h1>
${renderTabs(activeTab)}
${body}
</div>
</body>
</html>`;
}

module.exports = { renderAdminLayout };
