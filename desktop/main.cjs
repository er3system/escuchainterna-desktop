const { app, BrowserWindow, Menu, dialog, shell, safeStorage, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { startServer, stopServer, validateDatabase, databaseFingerprint } = require('./runtime.cjs');
const { isLocalUrl, isAllowedRendererRequest, externalWebsite, isSynchronizationSender } = require('./security.cjs');
const { loadSecrets, encodeBackup, decodeBackup, restoreBackup, rollbackRestoration, writeAtomicFile } = require('./storage.cjs');
const { FolderSynchronization, workspaceFingerprint } = require('./synchronization.cjs');
const { driveFolders } = require('./drive.cjs');
const { randomUUID } = require('node:crypto');
const { isConsentFolderSender, signConsentFolderSelection } = require('./consent-folder.cjs');
const { isAccountRecoverySender, requestAccountRecovery } = require('./account-recovery.cjs');
const { isPdfExportSender, savePagePdf } = require('./pdf-export.cjs');

const exportSmoke = process.argv.includes('--desktop-export-smoke');
const smoke = process.argv.includes('--desktop-smoke') || exportSmoke;
const smokeArgument = process.argv.find(value => value.startsWith('--desktop-smoke-dir='));
if (smoke) {
  if (!smokeArgument) throw new Error('La verificación necesita una carpeta temporal vacía.');
  const directory = smokeArgument.slice('--desktop-smoke-dir='.length);
  if (!path.isAbsolute(directory) || !fs.existsSync(directory) || fs.readdirSync(directory).length) throw new Error('La carpeta de verificación debe estar vacía.');
  app.setPath('userData', directory);
}
app.enableSandbox();
let window, server, workspace, resources, secrets, synchronization, receptionDeviceId;
let quitting = false, busy = false;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting) return;
  if (busy) { event.preventDefault(); return; }
  event.preventDefault(); quitting = true;
  const flush = window && !window.isDestroyed() ? window.webContents.session.cookies.flushStore() : Promise.resolve();
  flush.catch(() => {}).then(() => stopServer(server?.child)).finally(() => app.quit());
});

async function openWebsite(value) {
  const url = externalWebsite(value);
  if (!url || smoke) return;
  const answer = await dialog.showMessageBox(window, { type: 'question', title: 'Abrir enlace externo', message: `Abrir ${new URL(url).hostname} en tu navegador`, detail: url, buttons: ['Cancelar', 'Abrir navegador'], defaultId: 0, cancelId: 0 });
  if (answer.response === 1) await shell.openExternal(url);
}

function passwordDialog(restoring, synchronizing = false) {
  return new Promise(resolve => {
    const prompt = new BrowserWindow({ parent: window, modal: true, show: false, width: 530, height: 420, resizable: false, minimizable: false, maximizable: false, title: restoring ? 'Restaurar respaldo' : 'Crear respaldo', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'password-preload.cjs'), sandbox: true, nodeIntegration: false, contextIsolation: true, partition: 'backup-password', webviewTag: false } });
    prompt.setMenu(null);
    const expected = pathToFileURL(path.join(__dirname, 'password.html')).href + (synchronizing ? '?purpose=sync' : '');
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
    prompt.loadFile(path.join(__dirname, 'password.html'), synchronizing ? { query: { purpose: 'sync' } } : {});
  });
}

async function restart() {
  secrets = loadSecrets(workspace, safeStorage);
  server = await startServer({ resources, workspace, secrets, receptionDeviceId });
  await window.loadURL(`${server.origin}/`);
}

function consultationFingerprint() {
  return workspaceFingerprint(workspace, databaseFingerprint(resources, path.join(workspace, 'escuchainterna.db')));
}

async function connectSynchronization() {
  if (busy) throw new Error('Hay otra operación de datos en curso.');
  busy = true;
  try {
    const roots = driveFolders();
    const selected = await dialog.showOpenDialog(window, { title: 'Crea o selecciona EscuchaInterna en Mi unidad · disponible sin conexión', ...(roots.length === 1 ? { defaultPath: roots[0] } : {}), properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'] });
    if (selected.canceled || !selected.filePaths[0]) return synchronization.status();
    const password = await passwordDialog(false, true);
    if (!password) return synchronization.status();
    return synchronization.connect(selected.filePaths[0], password);
  } finally { busy = false; }
}

async function useDriveFolder() {
  if (busy) return;
  const roots = driveFolders();
  if (roots.length !== 1) {
    await dialog.showMessageBox(window, { type: 'info', message: 'No se encontró una única Mi unidad.', detail: 'Inicia sesión en Drive para escritorio. Si usas una carpeta reflejada o varias cuentas, selecciónala desde Sincronización con Google Drive.' });
    return;
  }
  let configured;
  try { configured = synchronization.config(); }
  catch {
    await dialog.showMessageBox(window, { type: 'info', message: 'Vuelve a conectar la carpeta desde Sincronización con Google Drive.', detail: 'Windows no pudo leer la configuración guardada. Tu consulta se conserva.' });
    return;
  }
  if (!configured) {
    await window.loadURL(`${server.origin}/sincronizacion`);
    await connectSynchronization();
    return;
  }
  busy = true;
  try {
    const destination = path.join(roots[0], 'EscuchaInterna');
    const answer = await dialog.showMessageBox(window, { type: 'question', title: 'Usar Mi unidad', message: '¿Preparar tu carpeta de sincronización en Google Drive?', detail: `Se copiarán solo las versiones cifradas a:\n${destination}\n\nLa carpeta original se conserva y se reutiliza tu contraseña guardada. Marca la carpeta nueva disponible sin conexión en Drive. Después publica los cambios guardados de la consulta.`, buttons: ['Cancelar', 'Usar Mi unidad'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return;
    fs.mkdirSync(destination, { recursive: true });
    synchronization.copyTo(destination);
    await window.loadURL(`${server.origin}/sincronizacion`);
  } catch (error) {
    await dialog.showMessageBox(window, { type: 'error', title: 'Preparar Drive', message: error.message || 'No se pudo preparar la carpeta. La consulta se conserva.' });
  } finally { busy = false; }
}

async function synchronize(receiving, id) {
  if (busy) throw new Error('Hay otra operación de datos en curso.');
  busy = true;
  let stopped = false, previous;
  try {
    const incoming = receiving ? synchronization.incoming(id) : null;
    const config = synchronization.config();
    if (!config) throw new Error('Conecta primero una carpeta de sincronización.');
    const localChanged = config.baseline !== consultationFingerprint();
    const answer = await dialog.showMessageBox(window, {
      type: receiving ? 'warning' : 'question', title: 'Sincronización cifrada',
      message: receiving ? '¿Usar en esta PC la versión seleccionada de Drive?' : '¿Publicar tu consulta completa en la carpeta de Drive?',
      detail: receiving
        ? `${localChanged ? 'Este equipo contiene cambios propios. ' : ''}Se reemplazará el espacio completo, incluidas todas las cuentas, expedientes y archivos. La consulta actual se conservará íntegra en una carpeta anterior. Las versiones de Drive se conservan; no se combinan expedientes automáticamente. Guarda cualquier formulario antes de continuar.`
        : 'Se copiarán todas las cuentas, expedientes, archivos y claves dentro de un archivo cifrado. Guarda primero tus formularios. Espera a que Google Drive termine de subirlo antes de continuar en otra PC.',
      buttons: ['Cancelar', receiving ? 'Conservar copia y recibir' : 'Publicar versión cifrada'], defaultId: 0, cancelId: 0,
    });
    if (answer.response !== 1) return synchronization.status();
    window.setEnabled(false);
    window.webContents.stop();
    await stopServer(server.child); stopped = true;
    validateDatabase(resources, path.join(workspace, 'escuchainterna.db'));
    let result;
    if (receiving) previous = restoreBackup(workspace, incoming.payload, safeStorage, database => validateDatabase(resources, database));
    else result = synchronization.publish(secrets, consultationFingerprint());
    const baseline = consultationFingerprint();
    await restart(); stopped = false;
    if (receiving) synchronization.acknowledge(incoming, baseline);
    window.setEnabled(true);
    await dialog.showMessageBox(window, { type: 'info', title: 'Sincronización cifrada',
      message: receiving ? 'La consulta recibida está lista.' : result.unchanged ? 'No hay cambios nuevos que publicar.' : 'Versión cifrada guardada en la carpeta.',
      detail: receiving ? `La consulta anterior se conserva en:\n${previous}\n\nUsa la cuenta de la consulta recibida para iniciar sesión.` : 'Google Drive realiza la subida. Comprueba su estado y espera a que termine; EscuchaInterna no confirma la entrega a la nube.',
    });
    return synchronization.status();
  } catch (error) {
    if (stopped) {
      try { await stopServer(server?.child); if (previous) rollbackRestoration(workspace, previous); await restart(); }
      catch { /* Preserve every workspace for manual recovery. */ }
    }
    if (!window.isDestroyed()) window.setEnabled(true);
    await dialog.showMessageBox(window, { type: 'error', title: 'No se pudo sincronizar', message: error.message || 'Los datos de la consulta se conservan.' });
    throw error;
  } finally { busy = false; }
}

function configureSynchronizationIPC() {
  ipcMain.handle('desktop:consent-folder', async (event, owner) => {
    if (!isConsentFolderSender(event, window.webContents, server.origin)) throw new Error('Selecciona la carpeta desde Consentimientos.');
    if (busy) throw new Error('Hay otra operación de datos en curso.');
    busy = true;
    try {
      const roots = driveFolders();
      const selection = await dialog.showOpenDialog(window, { title: 'Carpeta privada de recepción de consentimientos · distinta de los respaldos', ...(roots.length === 1 ? { defaultPath: roots[0] } : {}), properties: ['openDirectory', 'createDirectory', 'dontAddToRecent'] });
      if (selection.canceled || !selection.filePaths[0]) return null;
      return signConsentFolderSelection(selection.filePaths[0], owner, secrets.SESSION_SECRET, receptionDeviceId);
    } finally { busy = false; }
  });
  const operations = {
    'desktop:drive-status': () => ({ folders: driveFolders() }),
    'desktop:sync-status': () => synchronization.status(),
    'desktop:sync-connect': () => connectSynchronization(),
    'desktop:sync-publish': () => synchronize(false),
    'desktop:sync-receive': id => synchronize(true, id),
    'desktop:sync-disconnect': async () => {
      if (busy) throw new Error('Hay otra operación de datos en curso.');
      busy = true;
      try {
        const answer = await dialog.showMessageBox(window, { type: 'question', title: 'Desconectar sincronización', message: '¿Desconectar esta PC de la carpeta?', detail: 'La consulta local y las versiones cifradas en Drive se conservan.', buttons: ['Cancelar', 'Desconectar'], defaultId: 0, cancelId: 0 });
        return answer.response === 1 ? synchronization.disconnect() : synchronization.status();
      } finally { busy = false; }
    },
  };
  for (const [channel, operation] of Object.entries(operations)) ipcMain.handle(channel, (event, value) => {
    if (!isSynchronizationSender(event, window.webContents, server.origin)) throw new Error('Esta operación solo está disponible en la pantalla de sincronización del programa.');
    return operation(value);
  });
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
      { label: 'Abrir carpeta de datos', click: () => { if (!busy) void shell.openPath(app.getPath('userData')); } },
      { label: 'Abrir carpeta de catálogos', click: () => { if (!busy) { const folder = path.join(app.getPath('userData'), 'catalogos'); fs.mkdirSync(folder, { recursive: true }); void shell.openPath(folder); } } },
      { label: 'Sincronización con Google Drive…', click: () => { if (!busy) void window.loadURL(`${server.origin}/sincronizacion`); } },
      { label: 'Preparar carpeta en Mi unidad…', click: () => { void useDriveFolder(); } },
      { type: 'separator' },
      { label: 'Crear respaldo cifrado…', click: () => backup(false) },
      { label: 'Restaurar respaldo…', click: () => backup(true) },
      { type: 'separator' },
      { label: 'Guardar PDF…', accelerator: 'Ctrl+Shift+S', click: async () => {
        try { await exportPdf(); }
        catch (error) { await dialog.showMessageBox(window, { type: 'error', title: 'Guardar PDF', message: error.message || 'No se pudo guardar el PDF. Inténtalo de nuevo.' }); }
      } },
      { label: 'Imprimir…', accelerator: 'Ctrl+P', click: () => { if (!busy) window.webContents.print({ silent: false, printBackground: true }); } },
      { type: 'separator' }, { label: 'Salir', role: 'quit' },
    ] },
    { label: 'Edición', submenu: [{ role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }] },
    { label: 'Vista', submenu: [{ role: 'reload', label: 'Recargar' }, { role: 'resetZoom', label: 'Tamaño original' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, { role: 'togglefullscreen', label: 'Pantalla completa' }] },
    { label: 'Ayuda', submenu: [
      { label: 'Guía de uso en PC', accelerator: 'F1', click: () => { if (!busy) void window.loadURL(`${server.origin}/ayuda`); } },
      { label: 'Apoyar a Laroc en Ko-fi', click: () => openWebsite('https://ko-fi.com/laroc') },
      { label: 'Código y contribuciones en GitHub', click: () => openWebsite('https://github.com/er3system/escuchainterna-desktop') },
      { type: 'separator' },
      { label: 'Acerca de EscuchaInterna', click: () => dialog.showMessageBox(window, { type: 'info', title: 'EscuchaInterna', message: `EscuchaInterna ${app.getVersion()}`, detail: `Aplicación local de código abierto. Los datos de la consulta se guardan en esta PC.\n\nCarpeta de datos: ${workspace}` }) },
    ] },
  ]));
}

async function exportPdf(suggestedName) {
  if (busy) throw new Error('Hay otra operación en curso. Espera a que termine.');
  busy = true;
  try {
    return await savePagePdf({ window, origin: server.origin, dialog,
      defaultDirectory: app.getPath('documents'), suggestedName: suggestedName ?? `EscuchaInterna-${new Date().toISOString().slice(0, 10)}` });
  } finally { busy = false; }
}

async function recoverLocalAccount(email) {
  if (busy) throw new Error('Hay otra operación de datos en curso.');
  busy = true;
  try {
    const resetUrl = await requestAccountRecovery(server.origin, email, secrets.SESSION_SECRET);
    await window.loadURL(resetUrl);
  } finally { busy = false; }
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
  const deniedOutsideSync = await window.webContents.executeJavaScript("window.escuchaDesktop.synchronizationStatus().then(()=>false,()=>true)");
  await window.loadURL(`${server.origin}/registro`);
  const deniedRecoveryOutsideLogin = await window.webContents.executeJavaScript("window.escuchaDesktop.recoverLocalAccount('nobody@example.test').then(()=>false,()=>true)");
  await window.loadURL(`${server.origin}/login`);
  const recoveryBridge = await window.webContents.executeJavaScript("({ available: typeof window.escuchaDesktop.recoverLocalAccount === 'function', remember: !!document.querySelector('input[name=rememberAccount]') })");
  const sharedFolder = `${app.getPath('userData')}.drive`; fs.mkdirSync(sharedFolder);
  synchronization.connect(sharedFolder, 'smoke-sync-password-2026');
  await stopServer(server.child);
  validateDatabase(resources, path.join(workspace, 'escuchainterna.db'));
  const published = synchronization.publish(secrets, consultationFingerprint());
  const incoming = synchronization.incoming(published.id);
  fs.writeFileSync(upload, 'cambio local de prueba');
  restoreBackup(workspace, incoming.payload, safeStorage, database => validateDatabase(resources, database));
  synchronization.acknowledge(incoming, consultationFingerprint());
  const syncRestored = fs.readFileSync(upload, 'utf8') === 'respaldo local';
  const passwordProtected = !fs.readFileSync(path.join(app.getPath('userData'), 'synchronization.bin')).includes(Buffer.from('smoke-sync-password-2026'));
  await restart();
  await window.loadURL(`${server.origin}/sincronizacion`);
  const syncBridge = await window.webContents.executeJavaScript('window.escuchaDesktop.synchronizationStatus()');
  const result = { ok: preferences.sandbox && !preferences.nodeIntegration && preferences.contextIsolation && renderer.require === 'undefined' && renderer.process === 'undefined' && health.engine === 'sqlite' && counts.users === 0 && counts.patients === 0 && deniedOutsideSync && syncRestored && passwordProtected && syncBridge.connected && !syncBridge.pending && deniedRecoveryOutsideLogin && recoveryBridge.available && recoveryBridge.remember,
    electron: process.versions.electron, electronNode: process.versions.node, health, counts, renderer, security: { sandbox: preferences.sandbox, nodeIntegration: preferences.nodeIntegration, contextIsolation: preferences.contextIsolation }, backupRestored: true, accountRecovery: { nativeBridge: recoveryBridge.available, rememberAccount: recoveryBridge.remember, rejectedOtherScreen: deniedRecoveryOutsideLogin }, synchronization: { encryptedRoundTrip: syncRestored, dpapiProtectedPassword: passwordProtected, nativeBridge: syncBridge.connected, rejectedOtherScreen: deniedOutsideSync } };
  fs.writeFileSync(path.join(app.getPath('userData'), 'desktop-smoke.json'), JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error('La verificación empaquetada no pasó.');
  app.quit();
}

if (lock) app.whenReady().then(async () => {
  resources = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '.desktop-build', 'resources');
  workspace = path.join(app.getPath('userData'), 'workspace');
  secrets = loadSecrets(workspace, safeStorage);
  synchronization = new FolderSynchronization({ configFile: path.join(app.getPath('userData'), 'synchronization.bin'), workspace, safeStorage });
  const receptionDeviceFile = path.join(app.getPath('userData'), 'consent-reception-device-id');
  if (!fs.existsSync(receptionDeviceFile)) writeAtomicFile(receptionDeviceFile, Buffer.from(randomUUID()));
  receptionDeviceId = fs.readFileSync(receptionDeviceFile, 'utf8');
  server = await startServer({ resources, workspace, secrets, receptionDeviceId });
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 1000, minHeight: 700, title: 'EscuchaInterna', backgroundColor: '#ffffff', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, nodeIntegration: false, contextIsolation: true, webviewTag: false, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: !smoke } });
  window.on('close', event => { if (busy) event.preventDefault(); });
  const session = window.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isAllowedRendererRequest(details.url, server.origin, details.initiatorOrigin) }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => { if (!isLocalUrl(url, server.origin)) { event.preventDefault(); void openWebsite(url); } });
  window.webContents.on('will-redirect', (event, url) => { if (!isLocalUrl(url, server.origin)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocalUrl(url, server.origin)) void window.loadURL(url);
    else void openWebsite(url);
    return { action: 'deny' };
  });
  configureMenu();
  configureSynchronizationIPC();
  ipcMain.handle('desktop:save-pdf', async (event, suggestedName) => {
    if (!isPdfExportSender(event, window.webContents, server.origin)) throw new Error('Guarda el PDF desde la ventana principal de EscuchaInterna.');
    if (suggestedName !== undefined && (typeof suggestedName !== 'string' || suggestedName.length > 240)) throw new Error('Nombre de documento inválido.');
    return exportPdf(suggestedName);
  });
  ipcMain.handle('desktop:recover-account', async (event, email) => {
    if (!isAccountRecoverySender(event, window.webContents, server.origin)) throw new Error('La recuperación solo está disponible desde el inicio de sesión del programa.');
    await recoverLocalAccount(email);
  });
  window.once('ready-to-show', () => { if (!smoke) window.show(); });
  await window.loadURL(`${server.origin}/`);
  const recoveryArgument = !smoke && process.argv.find(value => value.startsWith('--recover-local-account='));
  if (recoveryArgument) await recoverLocalAccount(recoveryArgument.slice('--recover-local-account='.length));
  if (smoke && !exportSmoke) await smokeCheck();
}).catch(async error => {
  if (smoke) fs.writeFileSync(path.join(app.getPath('userData'), 'desktop-smoke.json'), JSON.stringify({ ok: false, error: error.message }));
  else dialog.showErrorBox('No se pudo iniciar EscuchaInterna', error.message);
  await stopServer(server?.child);
  quitting = true; app.exit(1);
});
