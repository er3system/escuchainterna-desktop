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
  const denied = await second.goto(`${server.origin}/pacientes/${patient.id}`);
  assert.equal(denied.status(), 404, 'Una segunda cuenta no puede leer el expediente ajeno');
  await runtime.stopServer(server.child);
  server = await runtime.startServer(options);
  await first.goto(`${server.origin}/pacientes/${patient.id}`, { waitUntil: 'networkidle' });
  await first.getByText('Texto ficticio para comprobar el cifrado', { exact: true }).waitFor();
  assert.equal(errors.length, 0, 'No debe haber errores de JavaScript en el navegador');
  const result = { ok: true, registration: true, noSubscription: true, patientCreation: true, clinicalEncryption: true, anonymousDenied: true, ownerIsolation: true, persistedAfterRestart: true, browserErrors: errors };
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, evidence }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ ok: false, error: error.message, browserErrors: errors }, null, 2));
  console.error(`E2E falló: ${error.message}. Evidencia: ${evidence}`);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await runtime.stopServer(server.child);
}
