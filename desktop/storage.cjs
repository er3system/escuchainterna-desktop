const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, scryptSync, createCipheriv, createDecipheriv } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');

const KEY_FILE = 'installation-keys.bin';
const MAGIC = Buffer.from('EIBACKUP1');
const MAX_CLEAR_BYTES = 512 * 1024 * 1024;

function writeAtomicFile(destination, bytes, fileSystem = fs) {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    const descriptor = fileSystem.openSync(temporary, 'wx', 0o600);
    try { fileSystem.writeFileSync(descriptor, bytes); fileSystem.fsyncSync(descriptor); }
    finally { fileSystem.closeSync(descriptor); }
    fileSystem.renameSync(temporary, destination);
  } catch (error) {
    try { fileSystem.unlinkSync(temporary); } catch { /* A failed open created no file. */ }
    throw error;
  }
}

function validateSecrets(secrets) {
  if (!secrets || !/^[a-f0-9]{64}$/.test(secrets.SESSION_SECRET) || !/^[a-f0-9]{64}$/.test(secrets.DATA_ENCRYPTION_KEY)) {
    throw new Error('Las claves de esta instalación no son válidas. Restaura un respaldo completo.');
  }
  return { SESSION_SECRET: secrets.SESSION_SECRET, DATA_ENCRYPTION_KEY: secrets.DATA_ENCRYPTION_KEY };
}

function saveSecrets(workspace, secrets, safeStorage) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows no pudo proteger las claves de la consulta.');
  fs.mkdirSync(workspace, { recursive: true });
  const sealed = safeStorage.encryptString(JSON.stringify(validateSecrets(secrets)));
  const destination = path.join(workspace, KEY_FILE);
  writeAtomicFile(destination, sealed);
}

function loadSecrets(workspace, safeStorage) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows no pudo proteger las claves de la consulta.');
  const file = path.join(workspace, KEY_FILE);
  if (fs.existsSync(file)) {
    try { return validateSecrets(JSON.parse(safeStorage.decryptString(fs.readFileSync(file)))); }
    catch { throw new Error('No se pueden abrir las claves de esta instalación. Usa el mismo usuario de Windows o restaura un respaldo completo.'); }
  }
  // Never silently generate another key for existing encrypted records.
  if (fs.existsSync(path.join(workspace, 'escuchainterna.db'))) throw new Error('La base de datos existe sin sus claves. Restaura un respaldo completo.');
  const secrets = { SESSION_SECRET: randomBytes(32).toString('hex'), DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex') };
  saveSecrets(workspace, secrets, safeStorage);
  return secrets;
}

function archivePath(relative) {
  if (typeof relative !== 'string' || relative.length > 4096 || relative.includes('\\') || relative.includes(':') || relative.includes('\0')) throw new Error('Ruta inválida en el respaldo.');
  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) throw new Error('Ruta inválida en el respaldo.');
  if (relative === KEY_FILE || (relative !== 'escuchainterna.db' && relative !== 'escuchainterna.db-wal' && relative !== 'escuchainterna.db-shm' && !relative.startsWith('uploads/') && !relative.startsWith('biblioteca/'))) throw new Error('Archivo no permitido en el respaldo.');
  return relative;
}

function encodeBackup(workspace, secrets, password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('Usa una contraseña de al menos 12 caracteres.');
  const files = [];
  let bytes = 0;
  function visit(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (relative === KEY_FILE) continue;
      if (entry.isSymbolicLink()) throw new Error('El respaldo no admite enlaces simbólicos.');
      if (entry.isDirectory()) visit(path.join(directory, entry.name), relative + '/');
      else if (entry.isFile()) {
        archivePath(relative);
        const absolute = path.join(directory, entry.name);
        bytes += fs.statSync(absolute).size;
        if (bytes > MAX_CLEAR_BYTES / 2) throw new Error('La consulta supera el límite de respaldo portátil de 256 MB. Una copia manual de la carpeta completa, con la aplicación cerrada, solo funciona bajo el mismo usuario de Windows.');
        files.push({ path: relative, content: fs.readFileSync(absolute).toString('base64') });
      } else throw new Error('Tipo de archivo no permitido en el respaldo.');
    }
  }
  visit(workspace);
  const payload = gzipSync(Buffer.from(JSON.stringify({ format: 1, createdAt: new Date().toISOString(), secrets: validateSecrets(secrets), files })));
  const salt = randomBytes(32), iv = randomBytes(12);
  const key = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), encrypted]);
}

function decodeBackup(buffer, password) {
  if (buffer.length < MAGIC.length + 60 || buffer.length > MAX_CLEAR_BYTES || !buffer.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Este archivo no es un respaldo válido de EscuchaInterna.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('Usa la contraseña completa del respaldo.');
  try {
    const offset = MAGIC.length;
    const key = scryptSync(password, buffer.subarray(offset, offset + 32), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(offset + 32, offset + 44));
    decipher.setAuthTag(buffer.subarray(offset + 44, offset + 60));
    const compressed = Buffer.concat([decipher.update(buffer.subarray(offset + 60)), decipher.final()]);
    const payload = JSON.parse(gunzipSync(compressed, { maxOutputLength: MAX_CLEAR_BYTES }).toString('utf8'));
    if (payload.format !== 1 || !Array.isArray(payload.files) || payload.files.length > 100_000) throw new Error('Formato inválido.');
    validateSecrets(payload.secrets);
    const seen = new Set();
    let bytes = 0;
    for (const file of payload.files) {
      archivePath(file.path);
      const identity = file.path.toLowerCase();
      if (seen.has(identity) || typeof file.content !== 'string') throw new Error('Archivo inválido.');
      const decoded = Buffer.from(file.content, 'base64');
      bytes += decoded.length;
      if (decoded.toString('base64') !== file.content || bytes > MAX_CLEAR_BYTES / 2) throw new Error('Archivo inválido.');
      seen.add(identity);
    }
    if (!seen.has('escuchainterna.db')) throw new Error('Falta la base de datos.');
    return payload;
  } catch { throw new Error('Contraseña incorrecta o respaldo dañado. La consulta actual se conserva.'); }
}

// Call only after the local server has stopped. The previous workspace is retained
// beside the new one, including its protected encryption keys, for recovery.
function restoreBackup(workspace, payload, safeStorage, validateDatabase) {
  validateSecrets(payload.secrets);
  if (typeof validateDatabase !== 'function') throw new Error('La restauración necesita verificar la integridad de SQLite.');
  if (!payload.files.some(file => file.path === 'escuchainterna.db')) throw new Error('El respaldo no contiene una base de datos.');
  const staged = `${workspace}.restore-${randomUUID()}`;
  const previous = `${workspace}.previous-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.mkdirSync(staged);
  try {
    for (const file of payload.files) {
      const relative = archivePath(file.path);
      const destination = path.join(staged, ...relative.split('/'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, Buffer.from(file.content, 'base64'), { flag: 'wx', mode: 0o600 });
    }
    validateDatabase(path.join(staged, 'escuchainterna.db'));
    saveSecrets(staged, payload.secrets, safeStorage);
    if (fs.existsSync(workspace)) fs.renameSync(workspace, previous);
    try { fs.renameSync(staged, workspace); }
    catch (error) { if (fs.existsSync(previous)) fs.renameSync(previous, workspace); throw error; }
    return previous;
  } catch (error) {
    fs.rmSync(staged, { recursive: true, force: true });
    throw error;
  }
}

function rollbackRestoration(workspace, previous) {
  if (path.dirname(previous) !== path.dirname(workspace) || !path.basename(previous).startsWith(path.basename(workspace) + '.previous-') || !fs.existsSync(previous)) throw new Error('No se pudo recuperar la consulta anterior.');
  const failed = `${workspace}.failed-${randomUUID()}`;
  fs.renameSync(workspace, failed);
  try { fs.renameSync(previous, workspace); }
  catch (error) { fs.renameSync(failed, workspace); throw error; }
  return failed;
}

module.exports = { loadSecrets, saveSecrets, encodeBackup, decodeBackup, restoreBackup, rollbackRestoration, writeAtomicFile, archivePath, KEY_FILE };
