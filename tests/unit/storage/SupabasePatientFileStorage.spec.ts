import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { SupabasePatientFileStorage } from '@/contexts/clinical-records/infrastructure/files/SupabasePatientFileStorage';
import { isEncryptedBytes } from '@/shared/infrastructure/crypto/FieldEncryption';

/**
 * Valida el SupabasePatientFileStorage contra un servidor STUB local que emula
 * los endpoints de objeto de Supabase Storage (POST/GET/DELETE
 * /storage/v1/object/{bucket}/{key}). Sin infra externa ni credenciales: prueba
 * el contrato HTTP real + el cifrado at-rest (round-trip) y que el bucket NUNCA
 * ve el dato en claro.
 */

const BUCKET = 'archivos';
const SERVICE_KEY = 'service-role-test-key';

let server: http.Server;
let baseUrl: string;
let storage: SupabasePatientFileStorage;
const objects = new Map<string, Buffer>();
let lastAuth: string | undefined;

function bodyOf(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c as Buffer));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    lastAuth = req.headers['authorization'];
    const prefix = `/storage/v1/object/${BUCKET}/`;
    const url = req.url ?? '';
    if (!url.startsWith(prefix)) {
      res.statusCode = 400;
      return res.end('bad path');
    }
    const key = url; // clave = pathname completo (save/read/delete usan el mismo)
    if (req.method === 'POST' || req.method === 'PUT') {
      objects.set(key, await bodyOf(req));
      res.statusCode = 200;
      return res.end(JSON.stringify({ Key: key }));
    }
    if (req.method === 'GET') {
      const stored = objects.get(key);
      if (!stored) {
        res.statusCode = 404;
        return res.end('not found');
      }
      res.statusCode = 200;
      return res.end(stored);
    }
    if (req.method === 'DELETE') {
      objects.delete(key);
      res.statusCode = 200;
      return res.end(JSON.stringify({ message: 'Successfully deleted' }));
    }
    res.statusCode = 405;
    return res.end('method not allowed');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
  storage = new SupabasePatientFileStorage(baseUrl, BUCKET, SERVICE_KEY);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('SupabasePatientFileStorage · contra stub de Supabase Storage', () => {
  const plaintext = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);

  it('save sube el contenido CIFRADO y devuelve una key única bajo el paciente', async () => {
    const key = await storage.save('pac-1', 'escaneo.pdf', plaintext);
    expect(key.startsWith('pac-1/')).toBe(true);
    expect(key.endsWith('-escaneo.pdf')).toBe(true);

    // El servidor recibió el byte stream CIFRADO, nunca el claro.
    const storedOnServer = [...objects.values()].at(-1)!;
    expect(isEncryptedBytes(storedOnServer)).toBe(true);
    expect(storedOnServer.equals(Buffer.from(plaintext))).toBe(false);

    // Envió el bearer del service key.
    expect(lastAuth).toBe(`Bearer ${SERVICE_KEY}`);
  });

  it('read descifra y devuelve el contenido original (round-trip)', async () => {
    const key = await storage.save('pac-2', 'nota.txt', plaintext);
    const got = await storage.read(key);
    expect(got).not.toBeNull();
    expect(Buffer.from(got!).equals(Buffer.from(plaintext))).toBe(true);
  });

  it('read de una key inexistente devuelve null (404)', async () => {
    const got = await storage.read('pac-1/no-existe.bin');
    expect(got).toBeNull();
  });

  it('delete borra el objeto (luego read da null)', async () => {
    const key = await storage.save('pac-3', 'borrame.dat', plaintext);
    expect(await storage.read(key)).not.toBeNull();
    await storage.delete(key);
    expect(await storage.read(key)).toBeNull();
  });

  it('delete de algo inexistente no lanza (best-effort)', async () => {
    await expect(storage.delete('pac-9/fantasma.dat')).resolves.toBeUndefined();
  });
});
