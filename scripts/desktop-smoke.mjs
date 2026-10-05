import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = path.resolve(process.argv[2] || path.join(root, 'release', 'win-unpacked', 'EscuchaInterna.exe'));
if (!fs.existsSync(executable)) throw new Error('Primero ejecuta desktop:build y desktop:dir o desktop:package.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-smoke-'));
const child = spawn(executable, ['--desktop-smoke', `--desktop-smoke-dir=${directory}`], {
  windowsHide: true, stdio: 'ignore',
  env: { ...process.env, DATABASE_URL: 'postgres://must-never-be-inherited.invalid/db', ADMIN_BOOTSTRAP_EMAIL: 'must-never-seed@example.invalid', ADMIN_BOOTSTRAP_PASSWORD: 'must-never-be-inherited', SESSION_SECRET: 'must-never-be-inherited', DATA_ENCRYPTION_KEY: 'must-never-be-inherited' },
});
const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`La verificación excedió 150 segundos. Evidencia en ${directory}`)); }, 150_000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', value => { clearTimeout(timer); resolve(value); });
});
const reportPath = path.join(directory, 'desktop-smoke.json');
if (!fs.existsSync(reportPath)) throw new Error(`La aplicación no generó evidencia de inicio. Carpeta temporal: ${directory}`);
const report = JSON.parse(fs.readFileSync(reportPath));
fs.mkdirSync(path.join(root, 'release'), { recursive: true });
fs.copyFileSync(reportPath, path.join(root, 'release', 'desktop-smoke.json'));
const screenshot = path.join(directory, 'desktop-smoke.png');
if (fs.existsSync(screenshot)) fs.copyFileSync(screenshot, path.join(root, 'release', 'desktop-smoke.png'));
console.log(JSON.stringify({ ...report, temporaryWorkspace: directory }, null, 2));
if (code !== 0 || !report.ok) process.exit(1);
