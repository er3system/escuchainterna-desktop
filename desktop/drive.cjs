const fs = require('node:fs');
const path = require('node:path');
/** Solo puntos de montaje conocidos; no lee cuentas, cookies, tokens ni preferencias de Google. */
function driveFolders(platform = process.platform) {
  if (platform !== 'win32') return [];
  const found = [];
  for (let code = 65; code <= 90; code++) for (const name of ['My Drive', 'Mi unidad']) {
    const folder = path.join(`${String.fromCharCode(code)}:\\`, name);
    try { if (fs.statSync(folder).isDirectory()) found.push(folder); } catch { /* unidad ausente */ }
  }
  return found;
}
module.exports = { driveFolders };
