/**
 * Respaldo fechado de la base de datos local.
 * Uso: npm run db:backup  → data/backups/escuchainterna-AAAA-MM-DD-HHmm.db
 */
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/escuchainterna.db');
if (!fs.existsSync(dbPath)) {
  console.error('No existe la base de datos:', dbPath);
  process.exit(1);
}
const dir = path.resolve(process.cwd(), './data/backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
const dest = path.join(dir, `escuchainterna-${stamp}.db`);
fs.copyFileSync(dbPath, dest);
// WAL pendiente de checkpoint también se respalda si existe.
for (const suffix of ['-wal', '-shm']) {
  if (fs.existsSync(dbPath + suffix)) fs.copyFileSync(dbPath + suffix, dest + suffix);
}
console.log('Respaldo creado:', dest);
