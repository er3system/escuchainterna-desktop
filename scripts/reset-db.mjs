import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/escuchainterna.db');
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`Eliminado: ${file}`);
  }
}
console.log('Base de datos reiniciada. Se recreará al arrancar la app.');
