const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { spawnSync } = require('node:child_process');

function validateDatabase(resources, databasePath) {
  const script = "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);const checks=db.prepare('PRAGMA quick_check').all();if(!checks.length||checks.some(r=>r.quick_check!=='ok'))throw Error('integrity');for(const table of ['users','patients','platform_settings'])db.prepare('SELECT count(*) FROM '+table).get();db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();";
  const result = spawnSync(path.join(resources, 'node', 'node.exe'), ['-e', script, databasePath], { windowsHide: true, stdio: 'ignore', timeout: 30_000 });
  if (result.status !== 0) throw new Error('La base de datos del respaldo está dañada o no pertenece a EscuchaInterna. La consulta actual se conserva.');
}

function runtimeEnvironment({ parent = process.env, resources, workspace, port, secrets }) {
  const env = {};
  for (const key of ['PATH', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH']) {
    if (typeof parent[key] === 'string') env[key] = parent[key];
  }
  return Object.assign(env, {
    NODE_ENV: 'production', APP_ENV: 'desktop', NEXT_TELEMETRY_DISABLED: '1',
    ESCUCHAINTERNA_DESKTOP: '1', HOSTNAME: '127.0.0.1', PORT: String(port),
    APP_URL: `http://127.0.0.1:${port}`, NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${port}`,
    DATABASE_PATH: path.join(workspace, 'escuchainterna.db'),
    UPLOADS_PATH: path.join(workspace, 'uploads'),
    CIE11_DATASET_PATH: path.join(resources, 'server', 'data', 'cie11', 'cie11.json'),
    PUBLICACIONES_MANIFEST_PATH: path.join(resources, 'server', 'data', 'publicaciones', 'manifest.json'),
    BIBLIOTECA_PATH: path.join(workspace, 'biblioteca'),
    SESSION_SECRET: secrets.SESSION_SECRET, DATA_ENCRYPTION_KEY: secrets.DATA_ENCRYPTION_KEY,
  });
}

function unusedLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function startServer(options) {
  const port = await unusedLoopbackPort();
  const node = path.join(options.resources, 'node', 'node.exe');
  const cwd = path.join(options.resources, 'server');
  if (!fs.existsSync(node) || !fs.existsSync(path.join(cwd, 'server.js'))) {
    throw new Error('Faltan recursos del servidor. Ejecuta npm run desktop:build antes de iniciar.');
  }
  const child = spawn(node, ['server.js'], {
    cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: runtimeEnvironment({ ...options, port }),
  });
  // Drain without storing clinical data or credentials in persistent logs.
  child.stdout.resume(); child.stderr.resume();
  let exited = false;
  child.once('exit', () => { exited = true; });
  let spawnError;
  child.once('error', error => { spawnError = error; });
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (spawnError || exited) throw new Error('El servidor local no pudo iniciarse. Los datos de la consulta se conservan.');
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).status === 'ok') return { child, origin, port };
    } catch { /* Readiness polling while migrations initialize an empty workspace. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await stopServer(child);
  throw new Error('El servidor local tardó demasiado en iniciar. Los datos de la consulta se conservan.');
}

function stopServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

module.exports = { runtimeEnvironment, unusedLoopbackPort, startServer, stopServer, validateDatabase };
