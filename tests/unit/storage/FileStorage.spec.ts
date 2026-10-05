import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { LocalFileStorage } from '@/shared/infrastructure/files/LocalFileStorage';
import { SupabaseFileStorage } from '@/shared/infrastructure/files/SupabaseFileStorage';

/**
 * Puerto genérico FileStorage (fotos/logos, NO clínico, sin cifrado app-level):
 * Local (disco, con normalización de keys legadas y guard de traversal) y
 * Supabase (REST, validado contra un stub local).
 */

describe('LocalFileStorage', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'escucha-files-'));
  let prev: string | undefined;
  const storage = new LocalFileStorage();
  const bytes = new Uint8Array([10, 20, 30, 200]);

  beforeAll(() => {
    prev = process.env.UPLOADS_PATH;
    process.env.UPLOADS_PATH = tmp;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.UPLOADS_PATH;
    else process.env.UPLOADS_PATH = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('round-trip save/read/delete bajo la key', async () => {
    await storage.save('perfil/foto-1.png', bytes);
    const got = await storage.read('perfil/foto-1.png');
    expect(got && Buffer.from(got).equals(Buffer.from(bytes))).toBe(true);
    await storage.delete('perfil/foto-1.png');
    expect(await storage.read('perfil/foto-1.png')).toBeNull();
  });

  it('normaliza keys LEGADAS con prefijo data/uploads/', async () => {
    await storage.save('orgs/o1/logo.png', bytes); // key limpia (nueva)
    const got = await storage.read('data/uploads/orgs/o1/logo.png'); // key legada
    expect(got && Buffer.from(got).equals(Buffer.from(bytes))).toBe(true);
  });

  it('rechaza path traversal (read null, save lanza)', async () => {
    expect(await storage.read('../../etc/passwd')).toBeNull();
    await expect(storage.save('../escape.bin', bytes)).rejects.toThrow();
  });
});

describe('SupabaseFileStorage · contra stub de Supabase Storage', () => {
  const BUCKET = 'publicos';
  const objects = new Map<string, Buffer>();
  let server: http.Server;
  let storage: SupabaseFileStorage;
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const key = req.url ?? '';
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', () => {
        if (req.method === 'POST' || req.method === 'PUT') {
          objects.set(key, Buffer.concat(chunks));
          res.statusCode = 200;
          return res.end('{}');
        }
        if (req.method === 'GET') {
          const stored = objects.get(key);
          if (!stored) {
            res.statusCode = 404;
            return res.end('no');
          }
          res.statusCode = 200;
          return res.end(stored);
        }
        if (req.method === 'DELETE') {
          objects.delete(key);
          res.statusCode = 200;
          return res.end('{}');
        }
        res.statusCode = 405;
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    storage = new SupabaseFileStorage(`http://127.0.0.1:${port}`, BUCKET, 'k');
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sube en CLARO (no clínico), round-trip y 404→null', async () => {
    await storage.save('perfil/foto.png', bytes);
    // El servidor recibió los bytes TAL CUAL (sin cifrar, a diferencia del clínico).
    expect([...objects.values()].at(-1)!.equals(Buffer.from(bytes))).toBe(true);
    const got = await storage.read('perfil/foto.png');
    expect(got && Buffer.from(got).equals(Buffer.from(bytes))).toBe(true);
    expect(await storage.read('perfil/no-existe.png')).toBeNull();
    await storage.delete('perfil/foto.png');
    expect(await storage.read('perfil/foto.png')).toBeNull();
  });
});
