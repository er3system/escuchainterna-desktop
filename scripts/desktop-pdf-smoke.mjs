import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = path.join(root, '.desktop-build');
fs.mkdirSync(build, { recursive: true });
const directory = fs.mkdtempSync(path.join(build, 'pdf-reader-'));
const env = {};
for (const key of ['PATH', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE']) if (process.env[key]) env[key] = process.env[key];
const child = spawn(createRequire(import.meta.url)('electron'), [path.join(root, 'desktop/tests/PdfReaderSmoke.cjs'), `--report-dir=${directory}`], { env, windowsHide: true, stdio: 'inherit' });
const code = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error('Native PDF check exceeded 30 seconds.')); }, 30000);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', value => { clearTimeout(timer); resolve(value); });
});
console.log(`PDF fixture evidence: ${directory}`);
process.exit(code ?? 1);
