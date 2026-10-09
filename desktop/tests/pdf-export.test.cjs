const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { isPdfExportSender, pdfFileName, savePagePdf } = require('../pdf-export.cjs');

const origin = 'http://127.0.0.1:39123';
function fixture() {
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: { url: `${origin}/pacientes/fixture/consentimiento` },
    getURL() { return this.mainFrame.url; },
    isDestroyed: () => false,
    executeJavaScript: async () => true,
    printToPDF: async () => Buffer.from('%PDF-1.7\nfixture'),
  });
  const writes = [];
  const options = { window: { webContents: contents }, origin,
    defaultDirectory: process.cwd(), suggestedName: 'Consentimiento de prueba',
    dialog: { showSaveDialog: async () => ({ canceled: false, filePath: '/documento.pdf' }) },
    writeFile: (...args) => writes.push(args) };
  return { contents, writes, options };
}

test('solo la ventana principal local puede pedir un selector de PDF', () => {
  const { contents } = fixture();
  const event = { sender: contents, senderFrame: contents.mainFrame };
  assert.equal(isPdfExportSender(event, contents, origin), true);
  assert.equal(isPdfExportSender({ ...event, sender: {} }, contents, origin), false);
  assert.equal(isPdfExportSender({ ...event, senderFrame: { url: contents.getURL() } }, contents, origin), false);
  contents.mainFrame.url = 'https://example.com';
  assert.equal(isPdfExportSender(event, contents, origin), false);
});

test('el nombre sugerido nunca es una ruta, dispositivo ni archivo ejecutable', () => {
  assert.equal(pdfFileName('../NUL'), '-NUL.pdf');
  assert.equal(pdfFileName('CON'), 'Documento-CON.pdf');
  assert.equal(pdfFileName('Informe: revisión.pdf'), 'Informe- revisión.pdf');
  assert.equal(pdfFileName('C:\\datos\\salida.exe'), 'C--datos-salida.exe.pdf');
  assert.equal(pdfFileName('...'), 'EscuchaInterna.pdf');
  assert.equal(pdfFileName('a'.repeat(500)).length, 144);
});

test('cancelar no imprime ni crea archivos', async () => {
  const { options, contents, writes } = fixture();
  options.dialog.showSaveDialog = async () => ({ canceled: true });
  contents.printToPDF = () => { throw new Error('No debe imprimir'); };
  assert.deepEqual(await savePagePdf(options), { canceled: true });
  assert.deepEqual(writes, []);
  assert.equal(contents.listenerCount('did-start-navigation'), 0);
});

test('genera el documento con CSS de impresión y escribe solo en el destino elegido', async () => {
  const { options, contents, writes } = fixture();
  contents.printToPDF = async settings => {
    assert.equal(settings.preferCSSPageSize, true);
    assert.equal(settings.printBackground, true);
    assert.equal(settings.displayHeaderFooter, false);
    return Buffer.from('%PDF-1.7\nfixture');
  };
  assert.deepEqual(await savePagePdf(options), { canceled: false, fileName: 'documento.pdf' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], '/documento.pdf');
  assert.equal(writes[0][1].subarray(0, 5).toString(), '%PDF-');
});

test('si cambia de documento durante el selector o el render, no guarda otro expediente', async () => {
  for (const phase of ['selector', 'render']) {
    const { options, contents, writes } = fixture();
    const navigate = () => contents.emit('did-start-navigation', {}, contents.getURL(), false, true);
    if (phase === 'selector') options.dialog.showSaveDialog = async () => { navigate(); return { filePath: '/documento.pdf' }; };
    else contents.printToPDF = async () => { navigate(); return Buffer.from('%PDF-'); };
    await assert.rejects(savePagePdf(options), /página cambió/);
    assert.deepEqual(writes, []);
    assert.equal(contents.listenerCount('did-start-navigation'), 0);
  }
});

test('el error de Chromium conserva el destino y permite reintentar', async () => {
  const { options, contents, writes } = fixture();
  contents.printToPDF = async () => { throw new Error('renderer failed'); };
  await assert.rejects(savePagePdf(options), /renderer failed/);
  assert.deepEqual(writes, []);
  assert.equal(contents.listenerCount('did-start-navigation'), 0);
  contents.printToPDF = async () => Buffer.from('%PDF-');
  assert.equal((await savePagePdf(options)).canceled, false);
});

test('rechaza una página externa o un destino con otra extensión', async () => {
  const { options, contents, writes } = fixture();
  options.dialog.showSaveDialog = async () => ({ filePath: '/no-es-pdf.exe' });
  await assert.rejects(savePagePdf(options), /extensión/);
  contents.mainFrame.url = 'file:///privado.html';
  await assert.rejects(savePagePdf(options), /Abre el documento/);
  assert.deepEqual(writes, []);
});
