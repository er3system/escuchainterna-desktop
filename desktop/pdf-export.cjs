const path = require('node:path');
const { isLocalUrl } = require('./security.cjs');
const { writeAtomicFile } = require('./storage.cjs');

function isPdfExportSender(event, contents, origin) {
  return event.sender === contents && event.senderFrame === contents.mainFrame
    && isLocalUrl(event.senderFrame.url, origin);
}

function pdfFileName(value) {
  const name = (typeof value === 'string' ? value : 'EscuchaInterna')
    .normalize('NFC').replace(/\.pdf$/i, '').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-')
    .replace(/^[. ]+|[. ]+$/g, '').slice(0, 140).replace(/[. ]+$/g, '') || 'EscuchaInterna';
  return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? 'Documento-' : ''}${name}.pdf`;
}

async function savePagePdf({ window, origin, dialog, defaultDirectory, suggestedName, writeFile = writeAtomicFile }) {
  const contents = window.webContents;
  const source = contents.getURL();
  if (!isLocalUrl(source, origin)) throw new Error('Abre el documento en EscuchaInterna antes de guardarlo.');
  // Capture only the page selected by the user, even if navigation occurs while
  // the system selector or Chromium's asynchronous PDF renderer is running.
  let changed = false;
  const navigating = (_event, _url, _inPlace, mainFrame) => { if (mainFrame !== false) changed = true; };
  contents.on('did-start-navigation', navigating);
  const assertCurrent = () => {
    if (changed || contents.isDestroyed() || contents.getURL() !== source) {
      throw new Error('La página cambió. Vuelve al documento y pulsa Guardar PDF.');
    }
  };
  try {
    const selected = await dialog.showSaveDialog(window, {
      title: 'Guardar PDF', buttonLabel: 'Guardar PDF',
      defaultPath: path.join(defaultDirectory, pdfFileName(suggestedName)),
      filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
      properties: ['dontAddToRecent', 'showOverwriteConfirmation'],
    });
    if (selected.canceled || !selected.filePath) return { canceled: true };
    if (path.extname(selected.filePath).toLowerCase() !== '.pdf') {
      throw new Error('Guarda el documento con la extensión .pdf.');
    }
    assertCurrent();
    await contents.executeJavaScript('document.fonts.ready.then(() => true)');
    assertCurrent();
    const bytes = await contents.printToPDF({
      pageSize: 'A4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: false, generateTaggedPDF: true,
    });
    assertCurrent();
    writeFile(selected.filePath, bytes);
    return { canceled: false, fileName: path.basename(selected.filePath) };
  } finally { contents.removeListener('did-start-navigation', navigating); }
}

module.exports = { isPdfExportSender, pdfFileName, savePagePdf };
