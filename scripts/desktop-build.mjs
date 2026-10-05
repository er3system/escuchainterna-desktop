/** Build an isolated desktop snapshot. No SaaS environment or private data is read. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(root, '.desktop-build');
const source = path.join(buildRoot, 'source');
const resources = path.join(buildRoot, 'resources');
const NODE_VERSION = '24.21.0';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('El instalador actual se construye en Windows x64.');
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Usa Node.js 24 LTS para construir EscuchaInterna.');

function cleanGenerated(directory) {
  const relative = path.relative(buildRoot, path.resolve(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Directorio de build fuera del espacio generado.');
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}

function copyAllowed(relative) {
  const from = path.join(root, relative);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(source, relative), { recursive: true, dereference: false, filter: file => !path.basename(file).startsWith('.env') });
}

function copyDependencies(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.cache' || entry.name === 'electron' || entry.name === 'electron-builder') continue;
    const origin = path.join(from, entry.name), destination = path.join(to, entry.name);
    if (entry.isDirectory()) copyDependencies(origin, destination);
    else if (entry.isFile()) {
      try { fs.linkSync(origin, destination); } catch { fs.copyFileSync(origin, destination); }
    } else if (entry.isSymbolicLink()) fs.cpSync(origin, destination, { recursive: true, dereference: true });
  }
}

async function downloadNode() {
  const target = path.join(resources, 'node');
  const archiveName = `node-v${NODE_VERSION}-win-x64.zip`;
  const cache = path.join(buildRoot, 'cache'); fs.mkdirSync(cache, { recursive: true });
  const archive = path.join(cache, archiveName);
  const response = await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`);
  if (!response.ok) throw new Error('No se pudo verificar el runtime Node oficial.');
  const checksum = (await response.text()).split('\n').find(line => line.trim().endsWith('  ' + archiveName))?.split(/\s+/)[0];
  if (!checksum || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('El runtime no tiene checksum oficial.');
  if (!fs.existsSync(archive)) {
    console.log(`Descargando Node.js ${NODE_VERSION} LTS oficial…`);
    const download = await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/${archiveName}`);
    if (!download.ok) throw new Error('No se pudo descargar Node oficial.');
    fs.writeFileSync(archive, Buffer.from(await download.arrayBuffer()));
  }
  if (createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== checksum) throw new Error('El checksum de Node no coincide. Borra únicamente .desktop-build/cache y vuelve a construir.');
  const expanded = path.join(cache, `node-v${NODE_VERSION}-win-x64`);
  const unpack = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $env:ESCUCHAINTERNA_NODE_ARCHIVE -DestinationPath $env:ESCUCHAINTERNA_NODE_CACHE -Force'], { windowsHide: true, encoding: 'utf8', env: { ...process.env, ESCUCHAINTERNA_NODE_ARCHIVE: archive, ESCUCHAINTERNA_NODE_CACHE: cache } });
  if (unpack.status !== 0) throw new Error('No se pudo extraer Node oficial.');
  fs.mkdirSync(target, { recursive: true });
  for (const file of ['node.exe', 'LICENSE']) fs.copyFileSync(path.join(expanded, file), path.join(target, file));
  const probe = spawnSync(path.join(target, 'node.exe'), ['-e', "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync(':memory:'); db.exec('SELECT 1'); db.close(); console.log(process.version)"], { windowsHide: true, encoding: 'utf8' });
  if (probe.status !== 0 || probe.stdout.trim() !== `v${NODE_VERSION}`) throw new Error('El runtime empacado no ofrece node:sqlite.');
  return { version: NODE_VERSION, archive: archiveName, sha256: checksum };
}

cleanGenerated(resources);
const reuseBuild = process.argv.includes('--reuse-build');
if (!reuseBuild) {
cleanGenerated(source);
console.log('Preparando snapshot sin .env, cuentas demo, base de datos ni catálogo de terceros…');
for (const file of ['src', 'package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs', 'eslint.config.mjs']) copyAllowed(file);
function anonymizePublicFixtures(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) anonymizePublicFixtures(file);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('admin@demo.test')) fs.writeFileSync(file, content.replaceAll('admin@demo.test', 'admin@demo.test'));
    }
  }
}
anonymizePublicFixtures(path.join(source, 'src'));
for (const file of ['public/icons', 'public/logo.svg', 'public/manifest.webmanifest', 'public/offline.html', 'public/sw.js']) copyAllowed(file);
// Original datasets are deliberately outside the distribution. Empty catalogs let
// contributors add independently licensed data without an application dependency.
fs.mkdirSync(path.join(source, 'data', 'cie11'), { recursive: true });
fs.writeFileSync(path.join(source, 'data', 'cie11', 'cie11.json'), '{"entries":[]}\n');
fs.mkdirSync(path.join(source, 'data', 'publicaciones'), { recursive: true });
fs.writeFileSync(path.join(source, 'data', 'publicaciones', 'manifest.json'), '[]\n');
console.log('Preparando dependencias del snapshot…');
copyDependencies(path.join(root, 'node_modules'), path.join(source, 'node_modules'));
const buildEnv = {};
for (const key of ['PATH', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH']) if (process.env[key]) buildEnv[key] = process.env[key];
Object.assign(buildEnv, { NODE_ENV: 'production', NEXT_DIST_DIR: '.next-desktop', NEXT_TELEMETRY_DISABLED: '1', ESCUCHAINTERNA_DESKTOP_BUILD: '1', ESCUCHAINTERNA_DESKTOP: '1', SESSION_SECRET: randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex') });
const next = spawnSync(process.execPath, [path.join(source, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { cwd: source, stdio: 'inherit', windowsHide: true, env: buildEnv });
if (next.status !== 0) process.exit(next.status ?? 1);
}
const standalone = path.join(source, '.next-desktop', 'standalone');
if (!fs.existsSync(path.join(standalone, 'server.js'))) throw new Error('Next no produjo un servidor standalone en la raíz del snapshot.');
const server = path.join(resources, 'server');
fs.cpSync(standalone, server, { recursive: true, filter: file => {
  const relative = path.relative(standalone, file).split(path.sep).join('/');
  return !relative.split('/').some(segment => segment.startsWith('.env') || segment === 'uploads') && !/\.db(?:-(?:wal|shm|journal))?$/.test(relative);
} });
fs.cpSync(path.join(source, '.next-desktop', 'static'), path.join(server, '.next-desktop', 'static'), { recursive: true });
fs.cpSync(path.join(source, 'public'), path.join(server, 'public'), { recursive: true });
fs.cpSync(path.join(source, 'data'), path.join(server, 'data'), { recursive: true, filter: file => !/\.db(?:-(?:wal|shm|journal))?$/.test(file) });
const runtime = await downloadNode();
const metadata = { app: 'EscuchaInterna', version: JSON.parse(fs.readFileSync(path.join(root, 'desktop', 'package.json'))).version, builtAt: new Date().toISOString(), runtime, privateDataIncluded: false, catalogsIncluded: false };
fs.writeFileSync(path.join(resources, 'build-info.json'), JSON.stringify(metadata, null, 2));
console.log(`Servidor standalone y Node.js ${NODE_VERSION} listos. Ejecuta npm run desktop:package.`);
