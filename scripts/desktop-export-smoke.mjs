/** Native PDF regression: isolated packaged app, fictitious accounts only. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = fs.mkdtempSync(path.join(root, '.desktop-build', 'pdf-export-'));
const profile = path.join(evidence, 'profile'); fs.mkdirSync(profile);
const executablePath = path.resolve(process.argv[2] || path.join(root, 'release', 'win-unpacked', 'EscuchaInterna.exe'));
const env = {};
for (const key of ['PATH', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE']) if (process.env[key]) env[key] = process.env[key];
let app;
const errors = [];
try {
  app = await electron.launch({ executablePath, args: ['--desktop-export-smoke', `--desktop-smoke-dir=${profile}`], env, timeout: 60000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForURL(/^http:\/\/127\.0\.0\.1:\d+\//, { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await page.addInitScript(() => {
    window.pdfPrintCalls = 0;
    window.print = () => { window.pdfPrintCalls++; };
  });
  const origin = new URL(page.url()).origin;
  await app.evaluate(({ dialog, BrowserWindow }, destination) => {
    globalThis.pdfExportSmoke = { destination, canceled: false, selectors: 0, printed: 0 };
    dialog.showSaveDialog = async (_window, options) => {
      const state = globalThis.pdfExportSmoke;
      state.selectors++; state.options = options;
      return { canceled: state.canceled, filePath: state.canceled ? undefined : state.destination };
    };
    BrowserWindow.getAllWindows()[0].webContents.print = () => { globalThis.pdfExportSmoke.printed++; };
  }, path.join(evidence, 'consentimiento-dia.pdf'));
  await page.goto(`${origin}/registro`, { waitUntil: 'networkidle' });
  await page.locator('#registro-nombre').fill('Profesional ficticio PDF');
  await page.locator('#registro-email').fill('pdf-export@example.test');
  await page.locator('#registro-password').fill('PruebaExportacion2026!');
  await page.locator('input[name="terminos"]').check();
  await page.getByRole('button', { name: 'Crear cuenta y empezar', exact: true }).click();
  await page.waitForURL('**/onboarding');
  const db = new DatabaseSync(path.join(profile, 'workspace', 'escuchainterna.db'));
  db.prepare("UPDATE practitioner_profile SET onboarding_completed = 1 WHERE user_id = (SELECT id FROM users WHERE email = ?)").run('pdf-export@example.test');
  db.close();
  await page.goto(`${origin}/pacientes/nuevo`, { waitUntil: 'networkidle' });
  await page.locator('#nombre').fill('Paciente ficticio PDF');
  await page.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  await page.waitForURL('**/pacientes?creado=*');
  await page.getByRole('link', { name: 'Paciente ficticio PDF', exact: true }).click();
  await page.waitForURL(/\/pacientes\/[a-f0-9-]+$/);
  const patientUrl = page.url();
  await page.goto(`${patientUrl}/consentimiento`, { waitUntil: 'networkidle' });
  const save = page.getByRole('button', { name: 'Guardar PDF', exact: true });
  await save.click();
  await page.getByRole('status').filter({ hasText: 'PDF guardado.' }).waitFor();
  assert.equal(fs.readFileSync(path.join(evidence, 'consentimiento-dia.pdf')).subarray(0, 5).toString(), '%PDF-');
  await page.screenshot({ path: path.join(evidence, 'guardar-pdf.png'), fullPage: true });
  assert.equal(await app.evaluate(() => globalThis.pdfExportSmoke.printed), 0);
  assert.match(await app.evaluate(() => globalThis.pdfExportSmoke.options.defaultPath), /Consentimiento-Paciente ficticio PDF\.pdf$/);
  await page.getByRole('button', { name: 'Imprimir', exact: true }).click();
  assert.equal(await page.evaluate(() => window.pdfPrintCalls), 1);

  // Cancel, a failed filesystem destination, and retry must not report success.
  await app.evaluate(() => { globalThis.pdfExportSmoke.canceled = true; });
  await save.click(); await save.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('button:has(svg.lucide-file-down)')?.disabled);
  assert.equal(await page.getByText('PDF guardado.', { exact: true }).count(), 0);
  await app.evaluate((_electron, destination) => { globalThis.pdfExportSmoke.canceled = false; globalThis.pdfExportSmoke.destination = destination; }, path.join(evidence, 'missing-folder', 'failed.pdf'));
  await save.click();
  await page.getByRole('alert').filter({ hasText: 'No se pudo guardar el PDF.' }).waitFor();
  assert.equal(fs.existsSync(path.join(evidence, 'missing-folder', 'failed.pdf')), false);

  await page.goto(`${origin}/configuracion/apariencia`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Noche', exact: true }).click();
  await page.goto(`${patientUrl}/consentimiento`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('html').getAttribute('class'), /dark/);
  await page.locator('#consentimiento-imprimible .whitespace-pre-wrap').evaluate(element => {
    for (let i = 1; i <= 45; i++) {
      const p = document.createElement('p');
      p.textContent = `Bloque ficticio ${i}. Texto sintético para comprobar la paginación y la exportación local de documentos extensos. No contiene información clínica real.`;
      element.append(p);
    }
    const p = document.createElement('p'); p.textContent = 'FIN DEL DOCUMENTO FICTICIO'; element.append(p);
  });
  await app.evaluate((_electron, destination) => { globalThis.pdfExportSmoke.destination = destination; }, path.join(evidence, 'consentimiento-noche-largo.pdf'));
  await save.click();
  await page.getByRole('status').filter({ hasText: 'PDF guardado.' }).waitFor();
  const longPdf = fs.readFileSync(path.join(evidence, 'consentimiento-noche-largo.pdf')).toString('latin1');
  assert.ok((longPdf.match(/\/Type\s*\/Page\b/g) ?? []).length >= 2, 'The complete long document must span multiple pages.');
  await page.goto(`${patientUrl}/exportar/vista`, { waitUntil: 'networkidle' });
  await app.evaluate((_electron, destination) => { globalThis.pdfExportSmoke.destination = destination; }, path.join(evidence, 'expediente.pdf'));
  await save.click();
  await page.getByRole('status').filter({ hasText: 'PDF guardado.' }).waitFor();
  await app.evaluate(({ Menu }, destination) => {
    globalThis.pdfExportSmoke.destination = destination;
    const menu = Menu.getApplicationMenu().items.find(item => item.label === 'Archivo').submenu;
    menu.items.find(item => item.label === 'Guardar PDF…').click();
  }, path.join(evidence, 'desde-menu.pdf'));
  for (let attempt = 0; attempt < 40 && !fs.existsSync(path.join(evidence, 'desde-menu.pdf')); attempt++) await new Promise(resolve => setTimeout(resolve, 250));
  assert.ok(fs.existsSync(path.join(evidence, 'desde-menu.pdf')));
  assert.equal(await app.evaluate(() => globalThis.pdfExportSmoke.printed), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ ok: true, nativePdf: true, printerUsedOnlyForPrintButton: true, cancellation: true, errorAndRetry: true, darkTheme: true, multiPage: true, expediente: true, menu: true, privateDataIncluded: false, errors }, null, 2));
  console.log(`PDF export evidence: ${evidence}`);
} catch (error) {
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ ok: false, error: error.message, errors }, null, 2));
  console.error(`PDF export failed. Evidence: ${evidence}`); throw error;
} finally { if (app) await app.close(); }
