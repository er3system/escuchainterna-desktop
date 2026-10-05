const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { FolderSynchronization, workspaceFingerprint } = require('../synchronization.cjs');
const { loadSecrets, restoreBackup } = require('../storage.cjs');
const { databaseFingerprint } = require('../runtime.cjs');
const { isSynchronizationSender } = require('../security.cjs');
const password = 'Una contraseña portable de prueba';
const protection = machine => ({ isEncryptionAvailable: () => true, encryptString: value => Buffer.from(`${machine}:${value}`), decryptString: value => { assert.ok(value.toString().startsWith(machine + ':')); return value.toString().slice(machine.length + 1); } });

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ei-sync-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, 'Drive'); fs.mkdirSync(folder);
  function computer(name) {
    const local = path.join(root, name), workspace = path.join(local, 'workspace'), safeStorage = protection(name);
    const secrets = loadSecrets(workspace, safeStorage);
    const db = new DatabaseSync(path.join(workspace, 'escuchainterna.db'));
    db.exec("CREATE TABLE users(id TEXT); CREATE TABLE patients(content TEXT); CREATE TABLE platform_settings(value TEXT); INSERT INTO patients VALUES ('expediente ficticio');"); db.close();
    const sync = new FolderSynchronization({ configFile: path.join(local, 'synchronization.bin'), workspace, safeStorage });
    return { sync, workspace, safeStorage, secrets };
  }
  return { root, folder, computer };
}
function clinical(computer, replacement) {
  const db = new DatabaseSync(path.join(computer.workspace, 'escuchainterna.db'));
  try {
    if (replacement) db.prepare('UPDATE patients SET content=?').run(replacement);
    return db.prepare('SELECT content FROM patients').get().content;
  } finally { db.close(); }
}
function fingerprint(computer) { return workspaceFingerprint(computer.workspace, createHash('sha256').update(clinical(computer)).digest('hex')); }
function verifyDatabase(file) {
  const db = new DatabaseSync(file);
  try { assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { db.close(); }
}
function receive(computer, id) {
  const incoming = computer.sync.incoming(id);
  const previous = restoreBackup(computer.workspace, incoming.payload, computer.safeStorage, verifyDatabase);
  computer.sync.acknowledge(incoming, fingerprint(computer));
  return previous;
}
function deliver(from, to) { for (const file of fs.readdirSync(from)) if (!fs.existsSync(path.join(to, file))) fs.copyFileSync(path.join(from, file), path.join(to, file)); }

test('encrypted folder transfers consultation, attachments and keys across separate Windows identities', t => {
  const { folder, computer } = fixture(t), first = computer('PC-A'), second = computer('PC-B');
  fs.mkdirSync(path.join(first.workspace, 'uploads', 'patient'), { recursive: true });
  fs.writeFileSync(path.join(first.workspace, 'uploads', 'patient', 'nota.txt'), 'adjunto clínico ficticio');
  first.sync.connect(folder, password);
  const publication = first.sync.publish(first.secrets, fingerprint(first));
  assert.equal(publication.unchanged, false);
  for (const name of fs.readdirSync(folder)) {
    const bytes = fs.readFileSync(path.join(folder, name));
    for (const secret of ['expediente ficticio', 'adjunto clínico ficticio', password, first.secrets.DATA_ENCRYPTION_KEY, first.secrets.SESSION_SECRET]) assert.equal(bytes.includes(Buffer.from(secret)), false);
  }
  assert.throws(() => second.sync.connect(folder, 'Otra contraseña equivocada'), /no coincide/);
  second.sync.connect(folder, password);
  assert.equal(second.sync.status().pending, true);
  receive(second, publication.id);
  assert.deepEqual(loadSecrets(second.workspace, second.safeStorage), first.secrets);
  assert.equal(fs.readFileSync(path.join(second.workspace, 'uploads', 'patient', 'nota.txt'), 'utf8'), 'adjunto clínico ficticio');
  assert.equal(second.sync.status().pending, false);
  assert.equal(second.sync.publish(first.secrets, fingerprint(second)).unchanged, true);
  second.sync.disconnect();
  assert.equal(clinical(second), 'expediente ficticio');
  assert.equal(fs.readdirSync(folder).filter(name => name.endsWith('.eisync')).length, 1);
});

test('offline publications retain both branches and explicitly resolve without deleting earlier versions', t => {
  const { root, folder, computer } = fixture(t), first = computer('PC-A'), second = computer('PC-B');
  first.sync.connect(folder, password);
  const original = first.sync.publish(first.secrets, fingerprint(first));
  const otherDrive = path.join(root, 'Drive-B'); fs.mkdirSync(otherDrive); deliver(folder, otherDrive);
  second.sync.connect(otherDrive, password); receive(second, original.id);
  clinical(first, 'cambios guardados en PC-A');
  clinical(second, 'cambios guardados en PC-B');
  const a = first.sync.publish(first.secrets, fingerprint(first));
  const b = second.sync.publish(first.secrets, fingerprint(second));
  deliver(folder, otherDrive); deliver(otherDrive, folder);
  assert.equal(first.sync.status().conflict, true);
  assert.equal(second.sync.status().conflict, true);
  assert.throws(() => first.sync.publish(first.secrets, fingerprint(first)), /divergentes/);
  const previous = receive(second, a.id);
  assert.equal(clinical(second), 'cambios guardados en PC-A');
  assert.equal(clinical({ workspace: previous }), 'cambios guardados en PC-B');
  assert.ok(fs.existsSync(path.join(otherDrive, `${b.id}.eisync`)));
  assert.equal(second.sync.status().conflict, false);
  deliver(otherDrive, folder);
  assert.equal(first.sync.status().conflict, false);
  assert.equal(first.sync.status().pending, true);
});

test('publishing refuses a newer remote version; damaged snapshots and missing ancestors preserve local records', t => {
  const { folder, computer } = fixture(t), first = computer('PC-A'), second = computer('PC-B');
  first.sync.connect(folder, password);
  const base = first.sync.publish(first.secrets, fingerprint(first));
  second.sync.connect(folder, password); receive(second, base.id);
  clinical(first, 'nuevo contenido PC-A');
  const next = first.sync.publish(first.secrets, fingerprint(first));
  clinical(second, 'contenido todavía local PC-B');
  assert.throws(() => second.sync.publish(first.secrets, fingerprint(second)), /pendientes/);
  const file = path.join(folder, `${next.id}.eisync`), earlier = fs.readFileSync(file), changed = Buffer.from(earlier); changed[changed.length - 1] ^= 1; fs.writeFileSync(file, changed);
  assert.throws(() => second.sync.incoming(next.id), /dañada/);
  assert.equal(clinical(second), 'contenido todavía local PC-B');
  fs.writeFileSync(file, earlier);
  fs.unlinkSync(path.join(folder, `${base.id}.eisync`));
  assert.throws(() => second.sync.status(), /incompleta/);
  assert.equal(clinical(second), 'contenido todavía local PC-B');
});

test('folder selection rejects the workspace, config folder and parent directories', t => {
  const { root, computer } = fixture(t), first = computer('PC-A');
  for (const folder of [root, first.workspace, path.dirname(first.workspace)]) assert.throws(() => first.sync.connect(folder, password), /separada/);
});

test('explicit reconnection repairs a damaged local configuration without touching consultation or Drive history', t => {
  const { folder, computer } = fixture(t), first = computer('PC-A');
  first.sync.connect(folder, password);
  const publication = first.sync.publish(first.secrets, fingerprint(first));
  fs.writeFileSync(first.sync.configFile, 'damaged protected configuration');
  assert.throws(() => first.sync.status(), /configuración/);
  assert.equal(first.sync.connect(folder, password).connected, true);
  assert.equal(clinical(first), 'expediente ficticio');
  assert.ok(fs.existsSync(path.join(folder, `${publication.id}.eisync`)));
});

test('logical database fingerprint ignores WAL checkpoint artifacts but detects record mutations', t => {
  const { root, computer } = fixture(t), first = computer('PC-A');
  const resources = path.join(root, 'resources'); fs.mkdirSync(path.join(resources, 'node'), { recursive: true });
  fs.copyFileSync(process.execPath, path.join(resources, 'node', 'node.exe'));
  const file = path.join(first.workspace, 'escuchainterna.db');
  const db = new DatabaseSync(file); db.exec('PRAGMA journal_mode=WAL;');
  const earlier = databaseFingerprint(resources, file);
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  assert.equal(databaseFingerprint(resources, file), earlier);
  db.prepare('UPDATE patients SET content=?').run('otra nota');
  assert.notEqual(databaseFingerprint(resources, file), earlier);
  db.close();
});

test('native synchronization bridge rejects foreign origins, subframes and unrelated app screens', () => {
  const mainFrame = { url: 'http://127.0.0.1:3000/configuracion/sincronizacion' }, sender = { mainFrame };
  const event = { sender, senderFrame: mainFrame }, origin = 'http://127.0.0.1:3000';
  assert.equal(isSynchronizationSender(event, sender, origin), true);
  mainFrame.url = origin + '/sincronizacion'; assert.equal(isSynchronizationSender(event, sender, origin), true);
  for (const url of [origin + '/', origin + '/pacientes', 'http://127.0.0.1:3001/sincronizacion', 'https://example.com/sincronizacion']) { mainFrame.url = url; assert.equal(isSynchronizationSender(event, sender, origin), false); }
  assert.equal(isSynchronizationSender({ sender, senderFrame: { url: origin + '/sincronizacion' } }, sender, origin), false);
});
