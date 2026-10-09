/** Recuperación y cuenta recordada con cuentas ficticias, sin acceder a datos del usuario. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';
import runtime from '../desktop/runtime.cjs';
import recovery from '../desktop/account-recovery.cjs';

const evidence = fs.mkdtempSync(path.resolve('.desktop-build/account-smoke-'));
const workspace = path.join(evidence, 'workspace');
fs.mkdirSync(workspace);
const secrets = { SESSION_SECRET: randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex') };
const options = { workspace, secrets, resources: path.resolve('.desktop-build/resources') };
const email = 'cuenta@desktop.example.test';
const oldPassword = 'InicialPrueba2026!';
const newPassword = 'NuevaPrueba2026!';
let server, browser;
const errors = [];

async function signIn(page, password, remember) {
  await page.goto(`${server.origin}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('checkbox', { name: /Recordar cuenta/ }).setChecked(remember);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
}

try {
  server = await runtime.startServer(options);
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }); }
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.origin}/registro`);
  await page.locator('#registro-nombre').fill('Cuenta de prueba');
  await page.locator('#registro-email').fill(email);
  await page.locator('#registro-password').fill(oldPassword);
  await page.locator('input[name="terminos"]').check();
  await page.getByRole('button', { name: 'Crear cuenta y empezar', exact: true }).click();
  await page.waitForURL('**/onboarding');
  const db = new DatabaseSync(path.join(workspace, 'escuchainterna.db'));
  const initialEpoch = db.prepare('SELECT session_epoch FROM users WHERE email = ?').get(email).session_epoch;
  db.close();
  const initialSession = (await context.cookies()).find(cookie => cookie.name === 'escuchainterna_session');

  const anonymous = await context.request.post(`${server.origin}/api/desktop/account-recovery`, { data: { email } });
  assert.equal(anonymous.status(), 403);
  const proof = recovery.signAccountRecovery(email, server.origin, secrets.SESSION_SECRET);
  const nativeHeaders = { 'X-Desktop-Recovery': proof };
  const browserRequest = await context.request.post(`${server.origin}/api/desktop/account-recovery`, { headers: { ...nativeHeaders, Origin: server.origin }, data: { email } });
  assert.equal(browserRequest.status(), 403);
  const valid = await context.request.post(`${server.origin}/api/desktop/account-recovery`, { headers: nativeHeaders, data: { email } });
  assert.equal(valid.status(), 200);
  const { resetUrl } = await valid.json();
  const replay = await context.request.post(`${server.origin}/api/desktop/account-recovery`, { headers: nativeHeaders, data: { email } });
  assert.equal(replay.status(), 403);

  await page.goto(resetUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
  await page.getByText('Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.', { exact: true }).waitFor();
  const inspected = new DatabaseSync(path.join(workspace, 'escuchainterna.db'), { readOnly: true });
  assert.equal(inspected.prepare('SELECT session_epoch FROM users WHERE email = ?').get(email).session_epoch, initialEpoch + 1);
  assert.equal(inspected.prepare("SELECT COUNT(*) n FROM outbox_messages WHERE template='recuperar_contrasena'").get().n, 0);
  inspected.close();
  const stale = await browser.newContext();
  await stale.addCookies([initialSession]);
  const stalePage = await stale.newPage();
  await stalePage.goto(`${server.origin}/inicio`);
  assert.match(stalePage.url(), /\/login$/);
  await stale.close();

  await signIn(page, oldPassword, true);
  await page.getByText('Correo o contraseña incorrectos.', { exact: true }).waitFor();
  assert.equal((await context.cookies()).some(cookie => cookie.name === 'escuchainterna_account'), false);
  await signIn(page, newPassword, true);
  await page.waitForURL('**/onboarding');
  const remembered = (await context.cookies()).find(cookie => cookie.name === 'escuchainterna_account');
  assert.equal(decodeURIComponent(remembered.value), email);
  assert.equal(remembered.httpOnly, true);
  assert.ok((await context.cookies()).find(cookie => cookie.name === 'escuchainterna_session').expires > Date.now() / 1000);
  await context.clearCookies({ name: 'escuchainterna_session' });
  await runtime.stopServer(server.child);
  server = await runtime.startServer(options);
  await page.goto(`${server.origin}/login`);
  assert.equal(await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).inputValue(), email);
  assert.equal(await page.getByRole('checkbox', { name: /Recordar cuenta/ }).isChecked(), true);
  await page.screenshot({ path: path.join(evidence, 'recordar-cuenta.png') });

  await signIn(page, newPassword, false);
  await page.waitForURL('**/onboarding');
  const cookies = await context.cookies();
  assert.equal(cookies.some(cookie => cookie.name === 'escuchainterna_account'), false);
  assert.equal(cookies.find(cookie => cookie.name === 'escuchainterna_session').expires, -1);
  await context.clearCookies({ name: 'escuchainterna_session' });
  await page.goto(`${server.origin}/login`);
  assert.equal(await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).inputValue(), '');
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.getByRole('alert').filter({ hasText: 'Escribe arriba el correo de tu cuenta local.' }).waitFor();
  assert.deepEqual(errors, []);
  const report = { ok: true, errors, checks: ['recuperación nativa de un solo uso', 'rechazo de navegador y peticiones anónimas', 'sin correo externo', 'clave anterior rechazada', 'sesiones anteriores invalidadas', 'correo conservado al cambiar de puerto', 'recordar y olvidar cuenta', 'sesión persistente opcional'], evidence };
  fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await runtime.stopServer(server?.child);
}
