const { isIP } = require('node:net');

function isLocalUrl(value, origin) {
  try {
    const url = new URL(value);
    return url.origin === origin && url.username === '' && url.password === '';
  } catch { return false; }
}

// Chromium ships this PDF viewer inside Electron. Its resources are internal;
// allowing this exact extension does not allow websites or other extensions.
const PDF_VIEWER_ID = 'mhjfbmdgcfjbbpaeojofohoefgiehjai';
function isAllowedRendererRequest(value, origin, initiatorOrigin) {
  if (isLocalUrl(value, origin) || value === 'about:blank') return true;
  try {
    const url = new URL(value);
    if (url.port || url.username || url.password) return false;
    return (url.protocol === 'chrome-extension:' && url.hostname === PDF_VIEWER_ID)
      || (url.protocol === 'chrome:' && url.hostname === 'resources' && initiatorOrigin === `chrome-extension://${PDF_VIEWER_ID}`);
  } catch { return false; }
}

// Only ordinary HTTPS websites can leave the application, after a native prompt.
// Credentials, local addresses and OS/custom protocols are never forwarded.
function externalWebsite(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || isIP(host)) return null;
    if (!host.includes('.') || host === 'localhost' || /\.(localhost|local|internal|test|invalid)$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}

function isSynchronizationSender(event, webContents, origin) {
  if (event.sender !== webContents || event.senderFrame !== webContents.mainFrame) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return isLocalUrl(url.href, origin) && ['/sincronizacion', '/configuracion/sincronizacion'].includes(url.pathname);
  } catch { return false; }
}

module.exports = { isLocalUrl, isAllowedRendererRequest, externalWebsite, isSynchronizationSender };
