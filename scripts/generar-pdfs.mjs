/**
 * Convierte las publicaciones HTML de data/publicaciones-src/html/ a PDF
 * en data/publicaciones/pdf/, usando Chromium (playwright).
 * Uso: node scripts/generar-pdfs.mjs [archivo.html ...]   (sin args = todas)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'data/publicaciones-src/html');
const OUT_DIR = path.resolve(process.cwd(), 'data/publicaciones/pdf');

const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((file) => path.resolve(SRC_DIR, path.basename(file)))
  : fs.readdirSync(SRC_DIR).filter((file) => file.endsWith('.html')).map((file) => path.join(SRC_DIR, file));

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

for (const file of files) {
  const outName = path.basename(file, '.html') + '.pdf';
  const outPath = path.join(OUT_DIR, outName);
  await page.goto('file:///' + file.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '22mm', right: '20mm', bottom: '24mm', left: '20mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `
      <div style="width:100%; font-family:'Segoe UI',sans-serif; font-size:7.5pt; color:#5c6270;
                  display:flex; justify-content:space-between; padding:0 20mm;">
        <span>Colección EscuchaInterna</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
  });
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`OK ${outName} (${kb} KB)`);
}

await browser.close();
console.log(`\n${files.length} PDFs en ${OUT_DIR}`);
