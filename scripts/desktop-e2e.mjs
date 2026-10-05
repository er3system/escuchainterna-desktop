/** Verifica el servidor de escritorio con cuentas ficticias y datos aislados. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import runtime from '../desktop/runtime.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(root, '.desktop-build');
fs.mkdirSync(buildRoot, { recursive: true });
const evidence = fs.mkdtempSync(path.join(buildRoot, 'e2e-'));
const workspace = path.join(evidence, 'workspace');
fs.mkdirSync(workspace);
const options = {
  resources: path.join(buildRoot, 'resources'), workspace,
  secrets: { SESSION_SECRET: randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex') },
};
let server, browser;
const errors = [];

async function register(context, name, email) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.origin}/registro`, { waitUntil: 'networkidle' });
  await page.locator('#registro-nombre').fill(name);
  await page.locator('#registro-email').fill(email);
  await page.locator('#registro-password').fill('PruebaLocal2026!');
  await page.locator('input[name="terminos"]').check();
  await page.getByRole('button', { name: 'Crear cuenta y empezar' }).click();
  await page.waitForURL('**/onboarding', { timeout: 30000 });
  return page;
}

try {
  server = await runtime.startServer(options);
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }); }
  const firstContext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  const first = await register(firstContext, 'Profesional de prueba', 'primero@desktop.example.test');
  await first.goto(`${server.origin}/configuracion/apariencia`, { waitUntil: 'networkidle' });
  await first.getByRole('heading', { name: 'Apariencia', exact: true }).waitFor();
  const contrast = (a, b) => {
    const luminance = hex => {
      let value = hex.replace('#', '');
      if (value.length === 3) value = [...value].map(character => character + character).join('');
      assert.match(value, /^[a-f0-9]{6}$/i, `Color válido: ${hex}`);
      const rgb = value.match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  for (const mode of ['Día', 'Noche']) {
    await first.getByRole('button', { name: mode, exact: true }).click();
    for (const palette of [{ name: 'Bosque', id: 'bosque' }, { name: 'Océano', id: 'oceano' }, { name: 'Lavanda', id: 'lavanda' }, { name: 'Terracota', id: 'terracota' }]) {
      await first.getByRole('button', { name: new RegExp('^' + palette.name) }).click();
      await first.waitForFunction(id => document.documentElement.dataset.palette === id, palette.id);
      const colors = await first.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return { primary: style.getPropertyValue('--color-primary').trim(), ink: style.getPropertyValue('--color-ink').trim(), surface: style.getPropertyValue('--color-surface').trim(), soft: style.getPropertyValue('--color-ink-soft').trim() };
      });
      assert.ok(contrast(colors.primary, '#ffffff') >= 4.5, `${palette.name} ${mode}: acción legible`);
      assert.ok(contrast(colors.ink, colors.surface) >= 4.5, `${palette.name} ${mode}: texto legible`);
      assert.ok(contrast(colors.soft, colors.surface) >= 4.5, `${palette.name} ${mode}: texto secundario legible`);
    }
  }
  await first.reload({ waitUntil: 'networkidle' });
  assert.equal(await first.locator('html').getAttribute('data-palette'), 'terracota');
  assert.match(await first.locator('html').getAttribute('class'), /dark/);
  await first.getByRole('button', { name: 'Automático', exact: true }).click();
  await first.emulateMedia({ colorScheme: 'light' });
  await first.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  await first.emulateMedia({ colorScheme: 'dark' });
  await first.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await first.getByRole('switch', { name: 'Movimiento suave' }).click();
  await first.waitForFunction(() => document.documentElement.dataset.motion === 'reduced');
  assert.equal(await first.getByRole('switch', { name: 'Movimiento suave' }).getAttribute('aria-checked'), 'false');
  await first.screenshot({ path: path.join(evidence, 'apariencia-noche.png'), fullPage: true });
  await first.getByRole('button', { name: 'Día', exact: true }).click();
  await first.getByRole('button', { name: /^Bosque/ }).click();
  await first.screenshot({ path: path.join(evidence, 'apariencia-dia.png'), fullPage: true });
  await first.goto(`${server.origin}/configuracion/sincronizacion`, { waitUntil: 'networkidle' });
  await first.getByRole('heading', { name: 'Sincronización con Drive', exact: true }).waitFor();
  await first.getByText('Abre esta pantalla desde el programa de Windows instalado.', { exact: false }).waitFor();
  await first.goto(`${server.origin}/pacientes/nuevo`, { waitUntil: 'networkidle' });
  await first.locator('#nombre').fill('Paciente ficticio del smoke');
  await first.locator('#motivo_consulta').fill('Texto ficticio para comprobar el cifrado');
  await first.getByRole('button', { name: 'Crear paciente', exact: true }).click();
  await first.waitForURL('**/pacientes?creado=*');
  await first.getByRole('link', { name: 'Paciente ficticio del smoke', exact: true }).waitFor();
  await first.screenshot({ path: path.join(evidence, 'pacientes.png'), fullPage: true });
  let db = new DatabaseSync(path.join(workspace, 'escuchainterna.db'), { readOnly: true });
  const patient = db.prepare('SELECT id, owner_user_id, consultation_reason FROM patients').get();
  assert.ok(patient);
  assert.match(patient.consultation_reason, /^enc:v1:/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subscriptions').get().n, 0);
  db.close();
  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(`${server.origin}/pacientes/${patient.id}`);
  assert.match(anonymousPage.url(), /\/login/);
  const secondContext = await browser.newContext();
  const second = await register(secondContext, 'Otro profesional de prueba', 'segundo@desktop.example.test');
  await second.goto(`${server.origin}/pacientes/${patient.id}`, { waitUntil: 'networkidle' });
  // Next puede haber enviado HTTP 200 antes de completar una respuesta en streaming.
  // La frontera real es la pantalla not-found y la ausencia de cualquier dato ajeno.
  await second.getByRole('heading', { name: '404', exact: true }).waitFor();
  assert.equal(await second.getByText('Paciente ficticio del smoke', { exact: true }).count(), 0);
  assert.equal(await second.getByText('Texto ficticio para comprobar el cifrado', { exact: true }).count(), 0);
  await runtime.stopServer(server.child);
  server = await runtime.startServer(options);
  await first.goto(`${server.origin}/pacientes/${patient.id}`, { waitUntil: 'networkidle' });
  await first.getByText('Texto ficticio para comprobar el cifrado', { exact: true }).waitFor();
  assert.equal(errors.length, 0, 'No debe haber errores de JavaScript en el navegador');
  const result = { ok: true, appearancePalettes: 4, appearanceModes: 3, contrastAA: true, appearancePersistence: true, systemThemeUpdates: true, reducedMotion: true, registration: true, noSubscription: true, patientCreation: true, clinicalEncryption: true, anonymousDenied: true, ownerIsolation: true, persistedAfterRestart: true, browserErrors: errors };
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, evidence }, null, 2));
} catch (error) {
  try { await browser?.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(evidence, 'failure.png'), fullPage: true }); } catch { /* Preserve original error. */ }
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ ok: false, error: error.message, browserErrors: errors }, null, 2));
  console.error(`E2E falló: ${error.message}. Evidencia: ${evidence}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await runtime.stopServer(server.child);
}
