/** Native Chromium PDF check with a generated one-page fixture, no user data. */
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { isAllowedRendererRequest } = require('../security.cjs');
const argument = process.argv.find(value => value.startsWith('--report-dir='));
const directory = argument?.slice('--report-dir='.length);
if (!directory || !path.isAbsolute(directory) || !fs.existsSync(directory) || fs.readdirSync(directory).length) throw new Error('Use an empty absolute fixture directory.');
app.setPath('userData', directory);
app.enableSandbox();

const content = 'BT /F1 14 Tf 40 240 Td (PDF ficticio local) Tj ET';
const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
let pdf = '%PDF-1.4\n';
const offsets = [];
for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const start = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
let server, window;
app.whenReady().then(async () => {
  server = http.createServer((request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; object-src 'none'");
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.url === '/document.pdf') { response.setHeader('Content-Type', 'application/pdf'); response.end(pdf); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe title="PDF ficticio" src="/document.pdf"></iframe>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  window = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false } });
  const denied = [], failures = [];
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const cancel = !isAllowedRendererRequest(details.url, origin, details.initiatorOrigin);
    if (cancel) denied.push(details.url);
    callback({ cancel });
  });
  window.webContents.on('did-fail-load', (_event, code, description) => failures.push({ code, description }));
  await window.loadURL(origin);
  let state;
  for (let attempt = 0; attempt < 40; attempt++) {
    const frames = frame => [frame, ...frame.frames.flatMap(frames)];
    const viewer = frames(window.webContents.mainFrame).find(frame => frame.url === 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html');
    if (viewer) state = await viewer.executeJavaScript("({hasViewer:!!document.querySelector('pdf-viewer'),pages:document.querySelector('pdf-viewer')?.shadowRoot?.querySelector('viewer-toolbar')?.docLength})");
    if (state?.pages === 1) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(state?.hasViewer, true);
  assert.equal(state?.pages, 1, 'The native viewer must finish loading the one-page fixture.');
  assert.deepEqual(denied, []);
  assert.deepEqual(failures, []);
  fs.writeFileSync(path.join(directory, 'pdf-reader-smoke.png'), (await window.webContents.capturePage()).toPNG());
  const report = { ok: true, nativePdfViewer: true, loadedPages: state.pages, blockedRequests: denied, failures, electron: process.versions.electron, privateDataIncluded: false };
  fs.writeFileSync(path.join(directory, 'pdf-reader-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  window.destroy(); await new Promise(resolve => server.close(resolve)); app.quit();
}).catch(error => { fs.writeFileSync(path.join(directory, 'pdf-reader-smoke.json'), JSON.stringify({ ok: false, error: error.message })); window?.destroy(); server?.close(); app.exit(1); });
