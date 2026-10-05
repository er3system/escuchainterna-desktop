/** Verifica la portada pública contra el build web, sin cuentas ni datos clínicos. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const output = path.resolve('.desktop-build/showcase');
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3117'], { windowsHide: true, env: { ...process.env, NEXT_DIST_DIR: '.next-build', ESCUCHAINTERNA_DESKTOP: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
let browser;
const checks = [];
try {
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('El servidor no quedó listo.')), 30000);
    const ready = chunk => { if (String(chunk).includes('Ready')) { clearTimeout(deadline); resolve(); } };
    server.stdout.on('data', ready);
    server.once('exit', code => { clearTimeout(deadline); reject(new Error(`El servidor terminó con ${code}.`)); });
  });
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, channel: 'msedge' }); }
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 } });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:3117') && !request.url().startsWith('data:')) externalRequests.push(new URL(request.url()).hostname); });
  const response = await page.goto('http://127.0.0.1:3117', { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200);
  assert.match(await page.title(), /Libre y abierta/);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('a[href="https://ko-fi.com/laroc"]').count(), 3);
  assert(await page.locator('[aria-labelledby="hero-title"]').getByRole('link', { name: 'Descargar para Windows', exact: true }).getAttribute('href').then(href => href.includes('releases/tag/v0.7.1')));
  assert(!/Prueba gratis|7 días gratis|Cancela cuando quieras/.test(await page.locator('body').innerText()));
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://escuchainterna.com');
  const social = await context.request.get('http://127.0.0.1:3117/showcase/social.png');
  assert.equal(social.status(), 200);
  assert.match(social.headers()['content-type'], /image\/png/);
  checks.push('Portada, enlaces de descarga, Ko-fi, metadata y tarjeta social');
  await page.screenshot({ path: path.join(output, 'desktop.png') });
  await page.screenshot({ path: path.join(output, 'full-page.png'), fullPage: true });
  await page.locator('summary').filter({ hasText: 'Ver una captura real del programa' }).click();
  const realImage = page.getByRole('img', { name: /Pantalla de inicio de EscuchaInterna para PC/ });
  assert(await realImage.isVisible());
  await realImage.evaluate(image => image.decode());
  assert(await realImage.evaluate(image => image.complete && image.naturalWidth > 0));
  checks.push('Captura real con datos de una instalación de prueba');
  const appearance = page.locator('#apariencia');
  for (const palette of ['Bosque', 'Salvia', 'Jardín', 'Océano', 'Lavanda', 'Terracota']) {
    await appearance.getByRole('button', { name: palette, exact: true }).click();
    assert.equal(await appearance.getByRole('button', { name: palette, exact: true }).getAttribute('aria-pressed'), 'true');
  }
  await appearance.getByRole('button', { name: 'Noche', exact: true }).click();
  assert.equal(await appearance.locator('[data-preview-dark]').getAttribute('data-preview-dark'), 'true');
  await appearance.getByRole('button', { name: 'Pagos', exact: true }).click();
  assert(await appearance.getByRole('heading', { name: 'Pagos con perspectiva.' }).isVisible());
  await appearance.screenshot({ path: path.join(output, 'themes.png'), animations: 'disabled' });
  assert.equal(await appearance.locator('[data-preview-dark]').evaluate(element => getComputedStyle(element).color), 'rgb(229, 239, 228)');
  checks.push('Seis paletas, día/noche y navegación de la demostración');
  await page.locator('#preguntas summary').filter({ hasText: '¿Es gratis de verdad?' }).click();
  assert(await page.getByText('El apoyo en Ko-fi es voluntario.', { exact: false }).isVisible());
  await page.getByRole('button', { name: 'Pausar animaciones' }).click();
  assert.equal(await page.getByRole('button', { name: 'Activar animaciones' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-motion-paused]').getAttribute('data-motion-paused'), 'true');
  checks.push('Preguntas desplegables y pausa de animaciones');
  for (const width of [360, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Desbordamiento a ${width}px`);
    if (width === 390) {
      await page.getByRole('button', { name: 'Abrir menú' }).click();
      assert.equal(await page.getByRole('button', { name: 'Cerrar menú' }).getAttribute('aria-expanded'), 'true');
      await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'La aplicación' }).click();
      assert.equal(await page.getByRole('button', { name: 'Abrir menú' }).getAttribute('aria-expanded'), 'false');
      await page.goto('http://127.0.0.1:3117', { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(output, 'mobile.png') });
    }
  }
  checks.push('Menú móvil y sin desbordamientos a 360, 390, 768 y 1024px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('[class*="heroGlow"]').evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.keyboard.press('Tab');
  checks.push('Preferencia de movimiento reducido');
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 850 } });
  const staticPage = await noJs.newPage();
  await staticPage.goto('http://127.0.0.1:3117');
  assert(await staticPage.getByRole('heading', { level: 1 }).isVisible());
  assert(await staticPage.locator('[aria-labelledby="hero-title"]').getByRole('link', { name: 'Descargar para Windows', exact: true }).isVisible());
  await staticPage.locator('#preguntas summary').filter({ hasText: '¿Puedo trabajar sin internet?' }).click();
  assert(await staticPage.getByText('Sí: agenda, pacientes', { exact: false }).isVisible());
  checks.push('Contenido, descarga y preguntas disponibles sin JavaScript');
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ok: true, checks, errors, externalRequests }, null, 2));
  console.log(JSON.stringify({ ok: true, checks, output }, null, 2));
} catch (error) {
  console.error(error);
  fs.writeFileSync(path.join(output, 'failure.log'), logs);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
