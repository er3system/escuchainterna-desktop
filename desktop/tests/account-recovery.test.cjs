const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isAccountRecoverySender, signAccountRecovery, requestAccountRecovery } = require('../account-recovery.cjs');

test('recovery IPC accepts only the application main frame on login', () => {
  const origin = 'http://127.0.0.1:12345';
  const mainFrame = { url: `${origin}/login` };
  const contents = { mainFrame };
  assert.equal(isAccountRecoverySender({ sender: contents, senderFrame: mainFrame }, contents, origin), true);
  for (const url of [`${origin}/inicio`, 'http://127.0.0.1:12346/login', 'https://external.example.test/login']) {
    mainFrame.url = url;
    assert.equal(isAccountRecoverySender({ sender: contents, senderFrame: mainFrame }, contents, origin), false);
  }
  mainFrame.url = `${origin}/login`;
  assert.equal(isAccountRecoverySender({ sender: {}, senderFrame: mainFrame }, contents, origin), false);
  assert.equal(isAccountRecoverySender({ sender: contents, senderFrame: { url: mainFrame.url } }, contents, origin), false);
});

test('recovery validates email without putting a password into its proof', () => {
  for (const email of ['', 'invalid', 'a\nb@example.test', 'x'.repeat(255)]) assert.throws(() => signAccountRecovery(email, 'http://127.0.0.1:12345', 'synthetic-secret'));
  const [encoded] = signAccountRecovery('persona@example.test', 'http://127.0.0.1:12345', 'synthetic-secret').split('.');
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(encoded, 'base64url'))).sort(), ['email', 'issuedAt', 'nonce', 'origin']);
});

test('native recovery rejects a server redirect or malformed destination', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ resetUrl: 'https://external.example.test/recuperar/a' }) }));
  await assert.rejects(requestAccountRecovery('http://127.0.0.1:12345', 'persona@example.test', 'synthetic-secret'), /inválido/);
});
