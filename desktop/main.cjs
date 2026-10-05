const { app, BrowserWindow, Menu, dialog, shell, safeStorage, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { startServer, stopServer, validateDatabase } = require('./runtime.cjs');
const { isLocalUrl, externalWebsite } = require('./security.cjs');
const { loadSecrets, encodeBackup, decodeBackup, restoreBackup, rollbackRestoration, writeAtomicFile } = require('./storage.cjs');

const smoke = process.argv.includes('--desktop-smoke');
const smokeArgument = process.argv.find(value => value.startsWith('--desktop-smoke-dir='));
if (smoke) {
  if (!smokeArgument) throw new Error('La verificación necesita una carpeta temporal vacía.');
  const directory = smokeArgument.slice('--desktop-smoke-dir='.length);
  if (!path.isAbsolute(directory) || !fs.existsSync(directory) || fs.readdirSync(directory).length) throw new Error('La carpeta de verificación debe estar vacía.');
  app.setPath('userData', directory);
}
app.enableSandbox();
let window, server, workspace, resources, secrets;
let quitting = false, busy = false;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault(); quitting = true;
  stopServer(server?.child).finally(() => app.quit());
});

async function openWebsite(value) {
  const url = externalWebsite(value);
  if (!url || smoke) return;
  const answer = await dialog.showMessageBox(window, { type: 'question', title: 'Abrir enlace externo', message: `Abrir ${new URL(url).hostname} en tu navegador`, detail: url, buttons: ['Cancelar', 'Abrir navegador'], defaultId: 0, cancelId: 0 });
  if (answer.response === 1) await shell.openExternal(url);
}

function passwordDialog(restoring) {
  return new Promise(resolve => {
    const prompt = new BrowserWindow({ parent: window, modal: true, show: false, width: 530, height: 420, resizable: false, minimizable: false, maximizable: false, title: restoring ? 'Restaurar respaldo' : 'Crear respaldo', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'password-preload.cjs'), sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'backup-password', webviewTag: false } });
    prompt.setMenu(null);
    const expected = pathToFileURL(path.join(__dirname, 'password.html')).href;
    const receive = (event, value) => {
      if (event.sender !== prompt.webContents || event.senderFrame !== prompt.webContents.mainFrame || event.senderFrame.url !== expected) return;
      if (value !== null && (typeof value !== 'string' || value.length < 12 || value.length > 1024)) return;
      resolve(value); prompt.close();
    };
    ipcMain.on('desktop:backup-password', receive);
    prompt.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    prompt.webContents.on('will-navigate', event => event.preventDefault());
    prompt.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    prompt.once('closed', () => { ipcMain.removeListener('desktop:backup-password', receive); resolve(null); });
    prompt.once('ready-to-show', () => prompt.show());
    prompt.loadFile(path.join(__dirname, 'password.html'));
  });
}

async function restart() {
  secrets = loadSecrets(workspace, safeStorage);
  server = await startServer({ resources, workspace, secrets });
  await window.loadURL(`${server.origin}/`);
}

async function backup(restoring) {
  if (busy) return;
  busy = true;
  let stopped = false;
  let previous;
  try {
    const selection = restoring
      ? await dialog.showOpenDialog(window, { title: 'Restaurar consulta', properties: ['openFile', 'dontAddToRecent'], filters: [{ name: 'Respaldo cifrado EscuchaInterna', extensions: ['eibackup'] }] })
      : await dialog.showSaveDialog(window, { title: 'Guardar respaldo cifrado', defaultPath: `EscuchaInterna-${new Date().toISOString().slice(0, 10)}.eibackup`, filters: [{ name: 'Respaldo cifrado EscuchaInterna', extensions: ['eibackup'] }] });
    const selected = restoring ? selection.filePaths[0] : selection.filePath;
    if (selection.canceled || !selected) return;
    const relative = path.relative(workspace, selected);
    if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('Guarda y abre respaldos fuera de la carpeta de datos de la aplicación.');
    const password = await passwordDialog(restoring);
    if (!password) return;
    let payload;
    if (restoring) {
      if (fs.statSync(selected).size > 512 * 1024 * 1024) throw new Error('El archivo supera el tamaño máximo de respaldo.');
      payload = decodeBackup(fs.readFileSync(selected), password);
      const answer = await dialog.showMessageBox(window, { type: 'warning', title: 'Restaurar consulta', message: 'Se reemplazará tu consulta por el respaldo seleccionado.', detail: 'La consulta actual se conservará completa en una carpeta anterior. Cierra los formularios sin guardar antes de continuar.', buttons: ['Cancelar', 'Restaurar consulta'], defaultId: 0, cancelId: 0 });
      if (answer.response !== 1) return;
    } else {
      const answer = await dialog.showMessageBox(window, { type: 'question', title: 'Crear respaldo completo', message: 'La consulta se cerrará brevemente para copiarla completa.', detail: 'Guarda primero los formularios que tengas abiertos.', buttons: ['Cancelar', 'Crear respaldo'], defaultId: 0, cancelId: 0 });
      if (answer.response !== 1) return;
    }
    window.webContents.stop();
    // Prevent edits while a closed SQLite database and its WAL are copied.
    await window.loadURL('about:blank');
    await stopServer(server.child); stopped = true;
    if (restoring) previous = restoreBackup(workspace, payload, safeStorage, database => validateDatabase(resources, database));
    else {
      const encrypted = encodeBackup(workspace, secrets, password);
      writeAtomicFile(selected, encrypted);
    }
    await restart(); stopped = false;
    await dialog.showMessageBox(window, { type: 'info', title: restoring ? 'Consulta restaurada' : 'Respaldo guardado', message: restoring ? 'El respaldo se restauró completo.' : 'El respaldo cifrado está listo.', detail: restoring ? `La consulta anterior se conserva en: ${previous}` : 'Guarda este archivo y su contraseña por separado. Incluye tus archivos y claves para poder restaurar en otra PC.' });
  } catch (error) {
    if (stopped) {
      try {
        await stopServer(server?.child);
        if (previous) rollbackRestoration(workspace, previous);
        await restart();
      } catch { /* Preserve both workspaces for recovery. */ }
    }
    await dialog.showMessageBox(window, { type: 'error', title: 'Respaldo de la consulta', message: error.message || 'No se pudo completar la operación. Los datos se conservan.' });
  } finally { busy = false; }
}

function configureMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Archivo', submenu: [
      { label: 'Crear respaldo cifrado…', click: () => backup(false) },
      { label: 'Restaurar respaldo…', click: () => backup(true) },
      { type: 'separator' },
      { label: 'Imprimir / guardar PDF…', accelerator: 'Ctrl+P', click: () => window.webContents.print({ silent: false, printBackground: true }) },
      { type: 'separator' }, { label: 'Salir', role: 'quit' },
    ] },
    { label: 'Edición', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Vista', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'resetZoom', label: 'Tamaño original' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { label: 'Ayuda', submenu: [{ label: 'Acerca de EscuchaInterna', click: () => dialog.showMessageBox(window, { type: 'info', title: 'EscuchaInterna', message: `EscuchaInterna ${app.getVersion()}`, detail: `Aplicación local de código abierto. Los datos de la consulta se guardan en esta PC.\n\nCarpeta de datos: ${workspace}` }) }] },
  ]));
}

async function smokeCheck() {
  const preferences = window.webContents.getLastWebPreferences();
  const renderer = await window.webContents.executeJavaScript('({title: document.title, text: document.body.innerText.slice(0, 1000), require: typeof require, process: typeof process})');
  const health = await fetch(`${server.origin}/api/health`).then(response => response.json());
  fs.writeFileSync(path.join(app.getPath('userData'), 'desktop-smoke.png'), (await window.webContents.capturePage()).toPNG());
  const dbQuery = spawnSync(path.join(resources, 'node', 'node.exe'), ['-e', "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(process.argv[1]); console.log(JSON.stringify({users:db.prepare('SELECT COUNT(*) n FROM users').get().n,patients:db.prepare('SELECT COUNT(*) n FROM patients').get().n})); db.close()", path.join(workspace, 'escuchainterna.db')], { encoding: 'utf8', windowsHide: true });
  if (dbQuery.status !== 0) throw new Error('No se pudo inspeccionar la base temporal.');
  const counts = JSON.parse(dbQuery.stdout);
  await window.loadURL('about:blank');
  await stopServer(server.child);
  const upload = path.join(workspace, 'uploads', 'smoke', 'prueba.txt');
  fs.mkdirSync(path.dirname(upload), { recursive: true }); fs.writeFileSync(upload, 'respaldo local');
  const encrypted = encodeBackup(workspace, secrets, 'smoke-password-unique-2026');
  const payload = decodeBackup(encrypted, 'smoke-password-unique-2026');
  restoreBackup(workspace, payload, safeStorage, database => validateDatabase(resources, database));
  const restored = loadSecrets(workspace, safeStorage);
  if (restored.DATA_ENCRYPTION_KEY !== secrets.DATA_ENCRYPTION_KEY || fs.readFileSync(upload, 'utf8') !== 'respaldo local') throw new Error('El respaldo no recuperó claves y archivos.');
  await restart();
  const result = { ok: preferences.sandbox && !preferences.nodeIntegration && preferences.contextIsolation && renderer.require === 'undefined' && renderer.process === 'undefined' && health.engine === 'sqlite' && counts.users === 0 && counts.patients === 0,
    electron: process.versions.electron, electronNode: process.versions.node, health, counts, renderer, security: { sandbox: preferences.sandbox, nodeIntegration: preferences.nodeIntegration, contextIsolation: preferences.contextIsolation }, backupRestored: true };
  fs.writeFileSync(path.join(app.getPath('userData'), 'desktop-smoke.json'), JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error('La verificación empaquetada no pasó.');
  app.quit();
}

if (lock) app.whenReady().then(async () => {
  resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '.desktop-build', 'resources');
  workspace = path.join(app.getPath('userData'), 'workspace');
  secrets = loadSecrets(workspace, safeStorage);
  server = await startServer({ resources, workspace, secrets });
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 1000, minHeight: 700, title: 'EscuchaInterna', backgroundColor: '#f8faf9', show: false,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, webviewTag: false, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: !smoke } });
  const session = window.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isLocalUrl(details.url, server.origin) && details.url !== 'about:blank' }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => { if (!isLocalUrl(url, server.origin)) { event.preventDefault(); void openWebsite(url); } });
  window.webContents.on('will-redirect', (event, url) => { if (!isLocalUrl(url, server.origin)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocalUrl(url, server.origin)) void window.loadURL(url);
    else void openWebsite(url);
    return { action: 'deny' };
  });
  configureMenu();
  window.once('ready-to-show', () => { if (!smoke) window.show(); });
  await window.loadURL(`${server.origin}/`);
  if (smoke) await smokeCheck();
}).catch(async error => {
  if (smoke) fs.writeFileSync(path.join(app.getPath('userData'), 'desktop-smoke.json'), JSON.stringify({ ok: false, error: error.message }));
  else dialog.showErrorBox('No se pudo iniciar EscuchaInterna', error.message);
  await stopServer(server?.child);
  quitting = true; app.exit(1);
});
