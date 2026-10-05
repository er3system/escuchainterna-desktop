const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runtimeEnvironment } = require('../runtime.cjs');

test('local catalogs live outside the clinical workspace and override only resource paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ei-runtime-catalog-'));
  try {
    const workspace = path.join(root, 'workspace'), catalogs = path.join(root, 'catalogos');
    fs.mkdirSync(path.join(catalogs, 'data/publicaciones'), { recursive: true });
    fs.mkdirSync(path.join(catalogs, 'biblioteca')); fs.writeFileSync(path.join(catalogs, 'data/publicaciones/manifest.json'), '[]');
    const env = runtimeEnvironment({ resources: path.join(root, 'resources'), workspace, port: 1234, secrets: { SESSION_SECRET: 'session', DATA_ENCRYPTION_KEY: 'encryption' } });
    assert.equal(env.PUBLICACIONES_ROOT_PATH, catalogs); assert.equal(env.BIBLIOTECA_PATH, path.join(catalogs, 'biblioteca'));
    assert.equal(env.DATABASE_PATH, path.join(workspace, 'escuchainterna.db'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('catalog installation is idempotent and preserves originals and conflicting destination files', async () => {
  const { installLocalCatalogs } = await import('../../scripts/install-local-catalogs.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ei-install-catalog-'));
  try {
    const source = path.join(root, 'original'), destination = path.join(root, 'installed'); fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'lectura.txt'), 'original'); fs.writeFileSync(path.join(source, 'ignored.exe'), 'not a book');
    const first = installLocalCatalogs({ books: source, destination }); assert.equal(first.books, 1); assert.equal(first.copied, 1);
    assert.equal(installLocalCatalogs({ books: source, destination }).copied, 0);
    fs.writeFileSync(path.join(destination, 'biblioteca/lectura.txt'), 'conservar');
    assert.throws(() => installLocalCatalogs({ books: source, destination }), /sobrescribir/);
    assert.equal(fs.readFileSync(path.join(source, 'lectura.txt'), 'utf8'), 'original'); assert.equal(fs.readFileSync(path.join(destination, 'biblioteca/lectura.txt'), 'utf8'), 'conservar');
    assert.throws(() => installLocalCatalogs({ books: source, destination: path.join(source, 'inside') }), /Separa/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
