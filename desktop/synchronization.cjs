// Infrastructure transport: immutable encrypted revisions in a user-selected folder.
// Drive handles delivery. No live SQLite database, session key or cleartext enters it.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID, scryptSync, createHash, createHmac, timingSafeEqual, createCipheriv, createDecipheriv } = require('node:crypto');
const { encodeBackup, decodeBackup, writeAtomicFile, archivePath, KEY_FILE } = require('./storage.cjs');

const CHANNEL_MAGIC = Buffer.from('EICHANNEL1');
const REVISION_MAGIC = Buffer.from('EISYNC1');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MAX_REVISION = 512 * 1024 * 1024;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const revisionError = () => new Error('La carpeta contiene una versión incompleta, dañada o incompatible. Espera a que Drive termine de sincronizar. No se han reemplazado tus datos.');

function within(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function workspaceFingerprint(workspace, databaseDigest) {
  const hash = createHash('sha256').update(databaseDigest);
  function visit(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix + entry.name;
      if (relative === KEY_FILE || /^escuchainterna\.db(?:-(?:wal|shm))?$/.test(relative)) continue;
      if (entry.isSymbolicLink()) throw new Error('La consulta no admite enlaces simbólicos al sincronizar.');
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute, relative + '/');
      else if (entry.isFile()) {
        archivePath(relative);
        hash.update(relative).update('\0').update(digest(fs.readFileSync(absolute))).update('\0');
      } else throw new Error('Archivo no admitido en la consulta.');
    }
  }
  visit(workspace);
  return hash.digest('hex');
}

class FolderSynchronization {
  constructor({ configFile, workspace, safeStorage }) {
    this.configFile = configFile;
    this.workspace = workspace;
    this.safeStorage = safeStorage;
  }

  config() {
    if (!fs.existsSync(this.configFile)) return null;
    try {
      const config = JSON.parse(this.safeStorage.decryptString(fs.readFileSync(this.configFile)));
      if (config.format !== 1 || !path.isAbsolute(config.folder) || !UUID.test(config.channel) || !UUID.test(config.device) || !/^[a-f0-9]{64}$/.test(config.key) || typeof config.password !== 'string' || config.password.length < 12 || (config.base !== null && !UUID.test(config.base)) || (config.baseline !== null && !/^[a-f0-9]{64}$/.test(config.baseline))) throw Error();
      return config;
    } catch { throw new Error('Windows no pudo abrir la configuración de sincronización. Vuelve a conectar la carpeta; tu consulta se conserva.'); }
  }

  save(config) {
    if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Windows no pudo proteger la contraseña de sincronización.');
    writeAtomicFile(this.configFile, this.safeStorage.encryptString(JSON.stringify(config)));
  }

  validatedFolder(folder) {
    folder = fs.realpathSync(folder);
    if (!fs.statSync(folder).isDirectory()) throw new Error('Selecciona una carpeta disponible en este equipo.');
    const local = fs.realpathSync(this.workspace);
    const installation = fs.realpathSync(path.dirname(this.configFile));
    if (within(local, folder) || within(folder, local) || within(installation, folder) || within(folder, installation)) throw new Error('Selecciona una carpeta de Drive separada de los datos y la configuración del programa.');
    return folder;
  }

  /** Copia exclusivamente la historia cifrada y conserva la contraseña ya protegida por Windows. */
  copyTo(folder) {
    const config = this.config();
    if (!config) throw new Error('Conecta primero una carpeta de sincronización.');
    folder = this.validatedFolder(folder);
    if (folder === config.folder) return this.status();
    if (within(folder, config.folder) || within(config.folder, folder)) throw new Error('Usa una carpeta independiente de la original.');
    const { revisions } = this.inspect(config);
    const files = [`${config.channel}.eichannel`, ...revisions.map(meta => `${meta.id}.eisync`)];
    if (fs.readdirSync(folder).some(name => !files.includes(name))) throw new Error('La carpeta destino contiene otros archivos. Usa una carpeta vacía para esta consulta.');
    // Valida todos los destinos antes de copiar. Nunca sobrescribe una versión existente.
    for (const name of files) {
      const source = path.join(config.folder, name), target = path.join(folder, name);
      if (!fs.lstatSync(source).isFile() || fs.lstatSync(source).isSymbolicLink()) throw revisionError();
      if (fs.existsSync(target) && (fs.lstatSync(target).isSymbolicLink() || !fs.lstatSync(target).isFile() || digest(fs.readFileSync(source)) !== digest(fs.readFileSync(target)))) throw revisionError();
    }
    for (const name of files) {
      const target = path.join(folder, name);
      if (!fs.existsSync(target)) fs.copyFileSync(path.join(config.folder, name), target, fs.constants.COPYFILE_EXCL);
    }
    return this.connect(folder, config.password);
  }

  connect(folder, password) {
    if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('Usa una contraseña de al menos 12 caracteres.');
    folder = this.validatedFolder(folder);
    const channels = fs.readdirSync(folder).filter(name => name.endsWith('.eichannel'));
    if (channels.length > 1) throw new Error('Hay más de una consulta en esta carpeta. Usa una carpeta independiente para cada consulta.');
    let channel, salt, key;
    if (!channels.length) {
      if (fs.readdirSync(folder).some(name => name.endsWith('.eisync'))) throw revisionError();
      channel = randomUUID(); salt = randomBytes(32);
      key = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
      const proof = createHmac('sha256', key).update(channel).digest();
      fs.writeFileSync(path.join(folder, `${channel}.eichannel`), Buffer.concat([CHANNEL_MAGIC, salt, Buffer.from(channel), proof]), { flag: 'wx', mode: 0o600 });
    } else {
      const file = path.join(folder, channels[0]);
      if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size !== CHANNEL_MAGIC.length + 100) throw revisionError();
      const header = fs.readFileSync(file);
      if (!header.subarray(0, CHANNEL_MAGIC.length).equals(CHANNEL_MAGIC)) throw revisionError();
      salt = header.subarray(CHANNEL_MAGIC.length, CHANNEL_MAGIC.length + 32);
      channel = header.subarray(CHANNEL_MAGIC.length + 32, CHANNEL_MAGIC.length + 68).toString();
      if (!UUID.test(channel) || channels[0] !== `${channel}.eichannel`) throw revisionError();
      key = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
      const expected = createHmac('sha256', key).update(channel).digest();
      if (!timingSafeEqual(expected, header.subarray(CHANNEL_MAGIC.length + 68))) throw new Error('La contraseña de esta carpeta no coincide. La consulta actual se conserva.');
    }
    let earlier;
    try { earlier = this.config(); } catch { earlier = null; }
    const same = earlier?.channel === channel;
    const config = { format: 1, folder, password, key: key.toString('hex'), channel, device: earlier?.device ?? randomUUID(), base: same ? earlier.base : null, baseline: same ? earlier.baseline : null };
    this.inspect(config); // Validate downloaded graph before committing local configuration.
    this.save(config);
    return this.status();
  }

  metadata(file, config) {
    if (fs.lstatSync(file).isSymbolicLink()) throw revisionError();
    const size = fs.statSync(file).size;
    if (size < 100 || size > MAX_REVISION) throw revisionError();
    const descriptor = fs.openSync(file, 'r');
    try {
      const prefix = Buffer.alloc(REVISION_MAGIC.length + 4);
      if (fs.readSync(descriptor, prefix, 0, prefix.length, 0) !== prefix.length || !prefix.subarray(0, REVISION_MAGIC.length).equals(REVISION_MAGIC)) throw revisionError();
      const length = prefix.readUInt32BE(REVISION_MAGIC.length);
      if (length < 30 || length > 4096 || length + prefix.length >= size) throw revisionError();
      const encrypted = Buffer.alloc(length);
      if (fs.readSync(descriptor, encrypted, 0, length, prefix.length) !== length) throw revisionError();
      const cipher = createDecipheriv('aes-256-gcm', Buffer.from(config.key, 'hex'), encrypted.subarray(0, 12));
      cipher.setAuthTag(encrypted.subarray(12, 28));
      const meta = JSON.parse(Buffer.concat([cipher.update(encrypted.subarray(28)), cipher.final()]).toString());
      if (meta.format !== 1 || !UUID.test(meta.id) || meta.channel !== config.channel || !UUID.test(meta.device) || !Array.isArray(meta.parents) || meta.parents.length > 1000 || meta.parents.some(id => !UUID.test(id) || id === meta.id) || new Set(meta.parents).size !== meta.parents.length || !/^[a-f0-9]{64}$/.test(meta.backupHash) || !Number.isFinite(Date.parse(meta.createdAt)) || path.basename(file) !== `${meta.id}.eisync`) throw revisionError();
      return { ...meta, offset: prefix.length + length, file };
    } catch { throw revisionError(); }
    finally { fs.closeSync(descriptor); }
  }

  inspect(config = this.config()) {
    if (!config) return { revisions: [], heads: [] };
    const entries = fs.readdirSync(config.folder);
    if (entries.filter(name => name.endsWith('.eichannel')).length !== 1 || !entries.includes(`${config.channel}.eichannel`)) throw revisionError();
    const files = entries.filter(name => name.endsWith('.eisync'));
    if (files.length > 1000) throw new Error('Esta carpeta supera las 1.000 versiones. Conserva una copia completa y configura una carpeta nueva.');
    const revisions = files.map(name => this.metadata(path.join(config.folder, name), config));
    const byId = new Map(revisions.map(meta => [meta.id, meta]));
    if (byId.size !== revisions.length) throw revisionError();
    if (config.base && !byId.has(config.base)) throw revisionError();
    const visiting = new Set(), visited = new Set();
    function validate(meta) {
      if (visiting.has(meta.id)) throw revisionError();
      if (visited.has(meta.id)) return;
      visiting.add(meta.id);
      for (const id of meta.parents) { if (!byId.has(id)) throw revisionError(); validate(byId.get(id)); }
      visiting.delete(meta.id); visited.add(meta.id);
    }
    revisions.forEach(validate);
    const ancestors = new Set(revisions.flatMap(meta => meta.parents));
    return { revisions, heads: revisions.filter(meta => !ancestors.has(meta.id)) };
  }

  status() {
    const config = this.config();
    if (!config) return { connected: false, revisions: [], conflict: false, pending: false };
    const { heads } = this.inspect(config);
    return { connected: true, folder: config.folder, conflict: heads.length > 1, pending: heads.some(meta => meta.id !== config.base), base: config.base, revisions: heads.map(meta => ({ id: meta.id, createdAt: meta.createdAt, thisDevice: meta.device === config.device })) };
  }

  writeRevision(config, backup, parents) {
    const meta = { format: 1, id: randomUUID(), channel: config.channel, device: config.device, parents, backupHash: digest(backup), createdAt: new Date().toISOString() };
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(config.key, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(meta)), cipher.final()]);
    const header = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    const prefix = Buffer.alloc(REVISION_MAGIC.length + 4); REVISION_MAGIC.copy(prefix); prefix.writeUInt32BE(header.length, REVISION_MAGIC.length);
    writeAtomicFile(path.join(config.folder, `${meta.id}.eisync`), Buffer.concat([prefix, header, backup]));
    return meta.id;
  }

  publish(secrets, fingerprint) {
    const config = this.config();
    if (!config) throw new Error('Conecta primero una carpeta de sincronización.');
    const { heads } = this.inspect(config);
    if (heads.length > 1) throw new Error('Hay versiones divergentes. Recibe y elige la versión que quieres continuar; todas las versiones se conservarán.');
    if (heads.length && heads[0].id !== config.base) throw new Error('Hay cambios de otra PC pendientes. Recíbelos antes de publicar para conservar ambas consultas.');
    if (config.base && !heads.length) throw revisionError();
    if (fingerprint === config.baseline) return { unchanged: true };
    const backup = encodeBackup(this.workspace, secrets, config.password);
    const id = this.writeRevision(config, backup, heads.map(meta => meta.id));
    this.save({ ...config, base: id, baseline: fingerprint });
    return { unchanged: false, id };
  }

  incoming(id) {
    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('Selecciona una versión válida.');
    const config = this.config();
    if (!config) throw new Error('Conecta primero una carpeta de sincronización.');
    const graph = this.inspect(config);
    const meta = graph.heads.find(item => item.id === id);
    if (!meta) throw new Error('La versión ha cambiado. Actualiza el estado antes de recibir.');
    const bytes = fs.readFileSync(meta.file);
    const backup = bytes.subarray(meta.offset);
    if (digest(backup) !== meta.backupHash) throw revisionError();
    return { config, meta, heads: graph.heads.map(item => item.id), backup, payload: decodeBackup(backup, config.password) };
  }

  acknowledge(incoming, fingerprint) {
    // A resolution points to every inspected head; competing publications remain
    // visible as new branches on the next scan, never overwritten by a manifest.
    const base = incoming.heads.length > 1 ? this.writeRevision(incoming.config, incoming.backup, incoming.heads) : incoming.meta.id;
    this.save({ ...incoming.config, base, baseline: fingerprint });
  }

  disconnect() {
    if (fs.existsSync(this.configFile)) fs.unlinkSync(this.configFile);
    return this.status();
  }
}

module.exports = { FolderSynchronization, workspaceFingerprint };
