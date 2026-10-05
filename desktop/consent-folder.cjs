const { createHmac } = require('node:crypto');
const { isLocalUrl } = require('./security.cjs');
function isConsentFolderSender(event, contents, origin) {
  if (event.sender !== contents || event.senderFrame !== contents.mainFrame) return false;
  try { const url = new URL(event.senderFrame.url); return isLocalUrl(url.href, origin) && url.pathname === '/consentimientos'; } catch { return false; }
}
function signConsentFolderSelection(folder, owner, secret, device) {
  if (typeof owner !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(owner)) throw new Error('Cuenta inválida.');
  const encoded = Buffer.from(JSON.stringify({ folder, owner, device, expires: Date.now() + 300000 })).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(`consent-folder:${encoded}`).digest('base64url')}`;
}
module.exports = { isConsentFolderSender, signConsentFolderSelection };
