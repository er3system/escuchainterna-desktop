const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { loadSecrets, encodeBackup, decodeBackup, restoreBackup, rollbackRestoration, writeAtomicFile, archivePath, KEY_FILE } = require('../storage.cjs');
// Deterministic stand-in for DPAPI. Real safeStorage is exercised by packaged smoke.
const protection = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from('protected:' + value), decryptString: value => value.toString().slice(10) };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ei-storage-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, 'workspace');
}
function database(workspace) {
  const db = new DatabaseSync(path.join(workspace, 'escuchainterna.db'));
  db.exec('CREATE TABLE users(id TEXT); CREATE TABLE patients(content TEXT); CREATE TABLE platform_settings(value TEXT);');
  return db;
}
function verifyDatabase(file) {
  const db = new DatabaseSync(file);
  try { assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok'); db.prepare('SELECT count(*) FROM patients').get(); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }
  finally { db.close(); }
}
function readClinical(workspace) {
  const db = new DatabaseSync(path.join(workspace, 'escuchainterna.db'));
  try { return db.prepare('SELECT content FROM patients').get().content; } finally { db.close(); }
}
test('keys persist and are never regenerated for an orphaned encrypted database', t => {
  const workspace = fixture(t), keys = loadSecrets(workspace, protection);
  assert.deepEqual(loadSecrets(workspace, protection), keys);
  database(workspace).close();
  fs.unlinkSync(path.join(workspace, KEY_FILE));
  assert.throws(() => loadSecrets(workspace, protection), /sin sus claves/);
});
test('portable backup authenticates and restores committed WAL, uploads and exact encryption keys', t => {
  const workspace = fixture(t), keys = loadSecrets(workspace, protection);
  fs.mkdirSync(path.join(workspace, 'uploads', 'patient'), { recursive: true });
  const db = database(workspace);
  db.exec("PRAGMA journal_mode=WAL; INSERT INTO patients VALUES ('clinical database');");
  fs.writeFileSync(path.join(workspace, 'uploads', 'patient', 'document.pdf'), 'private upload');
  const buffer = encodeBackup(workspace, keys, 'a portable backup password');
  assert.equal(buffer.includes(Buffer.from('clinical database')), false);
  assert.equal(buffer.includes(Buffer.from(keys.DATA_ENCRYPTION_KEY)), false);
  assert.throws(() => decodeBackup(buffer, 'a different backup password'), /incorrecta/);
  const changed = Buffer.from(buffer); changed[changed.length - 1] ^= 1;
  assert.throws(() => decodeBackup(changed, 'a portable backup password'), /dañado/);
  const payload = decodeBackup(buffer, 'a portable backup password');
  assert.ok(payload.files.some(file => file.path === 'escuchainterna.db-wal'));
  db.exec("UPDATE patients SET content='previous database'"); db.close();
  const previous = restoreBackup(workspace, payload, protection, verifyDatabase);
  assert.equal(readClinical(workspace), 'clinical database');
  assert.equal(fs.readFileSync(path.join(workspace, 'uploads', 'patient', 'document.pdf'), 'utf8'), 'private upload');
  assert.equal(readClinical(previous), 'previous database');
  assert.deepEqual(loadSecrets(workspace, protection), keys);
  rollbackRestoration(workspace, previous);
  assert.equal(readClinical(workspace), 'previous database');
});
test('archive paths reject traversal, Windows streams, devices, private key files and unrecognized files', () => {
  for (const name of ['../escuchainterna.db', '/escuchainterna.db', 'uploads/../../outside', 'uploads/file:secret', 'uploads/CON.txt', 'uploads/thing.', 'uploads\\thing', KEY_FILE, 'random.env']) assert.throws(() => archivePath(name));
  assert.equal(archivePath('uploads/patient/report.pdf'), 'uploads/patient/report.pdf');
});
test('invalid paths, missing DB and corrupt SQLite leave the current consultation untouched', t => {
  const workspace = fixture(t), keys = loadSecrets(workspace, protection);
  const db = database(workspace); db.exec("INSERT INTO patients VALUES ('untouched')"); db.close();
  for (const files of [[{ path: '../outside', content: '' }, { path: 'escuchainterna.db', content: '' }], [], [{ path: 'escuchainterna.db', content: Buffer.from('corrupt database').toString('base64') }]]) {
    assert.throws(() => restoreBackup(workspace, { secrets: keys, files }, protection, verifyDatabase));
    assert.equal(readClinical(workspace), 'untouched');
  }
  assert.throws(() => loadSecrets(path.join(path.dirname(workspace), 'unprotected'), { isEncryptionAvailable: () => false }), /proteger/);
});
test('atomic replacement retains an earlier backup if rename fails and leaves no temporary cleartext', t => {
  const workspace = fixture(t); fs.mkdirSync(workspace);
  const destination = path.join(workspace, 'backup.eibackup');
  fs.writeFileSync(destination, 'earlier backup');
  const failingFilesystem = { ...fs, renameSync: () => { throw new Error('disk failure'); } };
  assert.throws(() => writeAtomicFile(destination, Buffer.from('new backup'), failingFilesystem), /disk failure/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'earlier backup');
  assert.deepEqual(fs.readdirSync(workspace), ['backup.eibackup']);
  writeAtomicFile(destination, Buffer.from('complete new backup'));
  assert.equal(fs.readFileSync(destination, 'utf8'), 'complete new backup');
});
