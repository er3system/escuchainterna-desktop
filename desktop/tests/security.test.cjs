const { test } = require('node:test');
const assert = require('node:assert/strict');
const { externalWebsite, isLocalUrl, isAllowedRendererRequest } = require('../security.cjs');
const { runtimeEnvironment } = require('../runtime.cjs');
test('desktop navigation requires the exact loopback origin', () => {
  const origin = 'http://127.0.0.1:54321';
  assert.equal(isLocalUrl(origin + '/pacientes', origin), true);
  for (const url of ['http://127.0.0.1:54322/', 'http://127.0.0.1.evil.test:54321/', 'file:///C:/Windows/System32/cmd.exe', 'http://user:secret@127.0.0.1:54321/']) assert.equal(isLocalUrl(url, origin), false);
});
test('external opening rejects OS protocols, credentials and local addresses', () => {
  assert.equal(externalWebsite('https://github.com/er3system/escuchainterna-desktop'), 'https://github.com/er3system/escuchainterna-desktop');
  for (const url of ['file:///C:/Windows/System32/cmd.exe', 'javascript:alert(1)', 'http://example.com', 'https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://printer.local', 'https://user:password@example.com']) assert.equal(externalWebsite(url), null);
});

test('renderer can load only the bundled Chromium PDF viewer outside its loopback origin', () => {
  const origin = 'http://127.0.0.1:54321';
  for (const url of [origin + '/api/biblioteca/file', 'about:blank', 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html', 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/pdf_embedder.css']) assert.equal(isAllowedRendererRequest(url, origin), true);
  for (const url of ['https://example.com', 'http://127.0.0.1:54322/file', 'file:///C:/private.pdf', 'chrome-extension://anotherextension/index.html', 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai.evil.test/index.html', 'chrome-extension://user:password@mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html']) assert.equal(isAllowedRendererRequest(url, origin), false);
  const resource = 'chrome://resources/js/assert.js';
  assert.equal(isAllowedRendererRequest(resource, origin, 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai'), true);
  for (const initiator of [undefined, origin, 'chrome-extension://anotherextension']) assert.equal(isAllowedRendererRequest(resource, origin, initiator), false);
  assert.equal(isAllowedRendererRequest('chrome://settings', origin, 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai'), false);
});

test('PDF viewer resources never become application navigation or an external website', () => {
  const viewer = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html';
  assert.equal(isLocalUrl(viewer, 'http://127.0.0.1:54321'), false);
  assert.equal(externalWebsite(viewer), null);
});
test('desktop server inherits no web credentials or Node injection settings', () => {
  const env = runtimeEnvironment({ parent: { PATH: 'allowed', SYSTEMROOT: 'C:/Windows', DATABASE_URL: 'postgres://secret', ANTHROPIC_API_KEY: 'secret', ADMIN_BOOTSTRAP_EMAIL: 'demo@secret', NODE_OPTIONS: '--require evil.js', SESSION_SECRET: 'web-secret' }, resources: 'C:/resources', workspace: 'C:/userdata/workspace', port: 1234, secrets: { SESSION_SECRET: 'installation-session', DATA_ENCRYPTION_KEY: 'installation-encryption' } });
  assert.equal(env.PATH, 'allowed');
  assert.equal(env.HOSTNAME, '127.0.0.1');
  assert.equal(env.ESCUCHAINTERNA_DESKTOP, '1');
  assert.equal(env.SESSION_SECRET, 'installation-session');
  for (const key of ['DATABASE_URL', 'ANTHROPIC_API_KEY', 'ADMIN_BOOTSTRAP_EMAIL', 'NODE_OPTIONS']) assert.equal(env[key], undefined);
});
