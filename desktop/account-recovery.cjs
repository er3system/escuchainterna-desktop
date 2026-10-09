const { createHmac, randomUUID } = require('node:crypto');
const { isLocalUrl } = require('./security.cjs');

function isAccountRecoverySender(event, contents, origin) {
  if (event.sender !== contents || event.senderFrame !== contents.mainFrame) return false;
  try { return isLocalUrl(event.senderFrame.url, origin) && new URL(event.senderFrame.url).pathname === '/login'; }
  catch { return false; }
}

function signAccountRecovery(email, origin, secret) {
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Escribe el correo de tu cuenta local.');
  const encoded = Buffer.from(JSON.stringify({ email, origin, issuedAt: Date.now(), nonce: randomUUID() })).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(`desktop-account-recovery:${encoded}`).digest('base64url')}`;
}

async function requestAccountRecovery(origin, email, secret) {
  const response = await fetch(`${origin}/api/desktop/account-recovery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Desktop-Recovery': signAccountRecovery(email, origin, secret) },
    body: JSON.stringify({ email }), signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  if (!response.ok) throw new Error(response.status === 404 ? 'No hay una cuenta local con ese correo en esta PC.' : 'No se pudo preparar la recuperación local. Inténtalo de nuevo.');
  const { resetUrl } = await response.json();
  if (!isLocalUrl(resetUrl, origin) || !/^\/recuperar\/[a-f0-9]{48}$/.test(new URL(resetUrl).pathname)) throw new Error('Enlace de recuperación inválido.');
  return resetUrl;
}

module.exports = { isAccountRecoverySender, signAccountRecovery, requestAccountRecovery };
