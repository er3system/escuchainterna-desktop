/**
 * Genera los iconos PWA (public/icons/icon-192.png e icon-512.png) a partir de
 * public/logo.svg, rasterizando con Chromium (playwright).
 * Se usa solo la marca (la espiral + el punto) recortada a un lienzo cuadrado,
 * centrada sobre fondo blanco con margen de seguridad para máscaras (maskable).
 * Uso: node scripts/generar-iconos.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const LOGO_PATH = path.resolve(process.cwd(), 'public/logo.svg');
const OUT_DIR = path.resolve(process.cwd(), 'public/icons');
const SIZES = [192, 512];

const logoSvg = fs.readFileSync(LOGO_PATH, 'utf-8');

// Recorta la marca del logo: quita el texto y encuadra la espiral
// (paths centrados alrededor de x≈44, y≈44 en el viewBox original 0 0 360 88).
const markSvg = logoSvg
  .replace(/<text[\s\S]*?<\/text>/, '')
  .replace(/viewBox="[^"]*"/, 'viewBox="8 8 72 72"')
  .replace(/width="[^"]*"/, 'width="100%"')
  .replace(/height="[^"]*"/, 'height="100%"');

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { margin: 0; padding: 0; }
      body { background: #ffffff; }
      /* 72% del lienzo: deja la marca dentro de la zona segura maskable (80%). */
      .lienzo {
        width: 100vw;
        height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
      }
      .marca { width: 72%; height: 72%; }
    </style>
  </head>
  <body>
    <div class="lienzo"><div class="marca">${markSvg}</div></div>
  </body>
</html>`;

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
for (const size of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const outPath = path.join(OUT_DIR, `icon-${size}.png`);
  await page.screenshot({ path: outPath, type: 'png' });
  await page.close();
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`OK icon-${size}.png (${kb} KB)`);
}
await browser.close();

console.log(`\nIconos PWA generados en ${OUT_DIR}`);
