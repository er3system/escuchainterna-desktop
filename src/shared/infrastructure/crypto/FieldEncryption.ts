import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from 'node:crypto';
import { readRequiredSecret } from '../config/runtime';

/**
 * Cifrado at-rest de CAMPOS clínicos (AES-256-GCM).
 * Formato almacenado: enc:v1:<iv b64>:<authTag b64>:<cipher b64>
 *
 * La clave se deriva de DATA_ENCRYPTION_KEY (env). En local, si falta, se
 * deriva de SESSION_SECRET con una advertencia: suficiente para desarrollo,
 * NUNCA para producción (ahí la clave vive en un secret manager — ver
 * docs/proveedores-faltantes.md).
 *
 * decryptField es retrocompatible: un valor que no empieza con "enc:" se
 * devuelve tal cual (datos previos al cifrado o campos vacíos).
 */

const PREFIX = 'enc:v1:';
const globalForKey = globalThis as unknown as {
  __escuchainternaDek?: Buffer;
  __escuchainternaBlindKey?: Buffer;
  __decryptWarned?: boolean;
};

function key(): Buffer {
  if (globalForKey.__escuchainternaDek) return globalForKey.__escuchainternaDek;
  // En dev, si falta DATA_ENCRYPTION_KEY se deriva del secreto de sesión (con aviso);
  // en producción readRequiredSecret LANZA, para no cifrar datos clínicos con una clave débil.
  const devFallback = (process.env.SESSION_SECRET ?? 'escuchainterna-local-dev-secret') + ':data-at-rest';
  const secret = readRequiredSecret('DATA_ENCRYPTION_KEY', devFallback, 16);
  globalForKey.__escuchainternaDek = scryptSync(secret, 'escuchainterna-dek-v1', 32);
  return globalForKey.__escuchainternaDek;
}

export function encryptField(plain: string): string {
  if (plain === '' || plain.startsWith(PREFIX)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptField(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !dataB64) return stored;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Clave incorrecta o dato corrupto: devolver el blob (no romper la página), PERO avisar
    // una vez por proceso — un fallo silencioso oculta que la clave cambió y todos los campos
    // quedaron ilegibles. El monitoreo debe poder detectarlo (no depender de inspección visual).
    if (!globalForKey.__decryptWarned) {
      globalForKey.__decryptWarned = true;
      console.error(
        '[seguridad] Falló el descifrado de un campo clínico (clave incorrecta o dato corrupto). ' +
          '¿Cambió DATA_ENCRYPTION_KEY respecto a cuando se cifró? Los datos at-rest no se leerán hasta restaurar la clave correcta.',
      );
    }
    return stored;
  }
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

// ===================== Índice ciego (blind index) para búsqueda por igualdad =====================
// El cifrado de campos usa IV aleatorio → NO determinista → no se puede buscar por igualdad sobre
// el valor cifrado. Para mantener una búsqueda por IGUALDAD (p. ej. deduplicar por documento) sin
// guardar el valor en claro, se almacena aparte un HMAC-SHA256 determinista del valor normalizado.
// Solo sirve para igualdad (no subcadena ni orden). La clave se deriva de DATA_ENCRYPTION_KEY con
// una sal DISTINTA a la del cifrado, para que el hash no filtre material de la clave de cifrado.

function blindIndexKey(): Buffer {
  if (globalForKey.__escuchainternaBlindKey) return globalForKey.__escuchainternaBlindKey;
  const devFallback =
    (process.env.SESSION_SECRET ?? 'escuchainterna-local-dev-secret') + ':blind-index';
  const secret = readRequiredSecret('DATA_ENCRYPTION_KEY', devFallback, 16);
  globalForKey.__escuchainternaBlindKey = scryptSync(secret, 'escuchainterna-blind-index-v1', 32);
  return globalForKey.__escuchainternaBlindKey;
}

/**
 * Índice ciego de `value`: HMAC-SHA256 hex del valor con espacios recortados (trim). Determinista,
 * irreversible. Devuelve '' si el valor está vacío (no se indexan ausencias). Igualdad sensible a
 * mayúsculas (preserva la semántica de la deduplicación exacta previa por documento).
 */
export function blindIndex(value: string): string {
  const normalized = (value ?? '').trim();
  if (normalized === '') return '';
  return createHmac('sha256', blindIndexKey()).update(normalized).digest('hex');
}

// ===================== Cifrado de BYTES (adjuntos: fotos, escaneos, PDF) =====================
// Formato: <magic 'encb1:'><iv 12><authTag 16><ciphertext>. Reutiliza la misma DEK.
// Compatibilidad hacia atrás: un archivo sin el magic (subido antes del cifrado) se
// devuelve tal cual, así los adjuntos existentes siguen sirviéndose.

const BIN_MAGIC = Buffer.from('encb1:', 'utf8');

export function encryptBytes(plain: Uint8Array): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([BIN_MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBytes(stored: Uint8Array): Buffer {
  const buffer = Buffer.isBuffer(stored) ? stored : Buffer.from(stored);
  if (buffer.length < BIN_MAGIC.length || !buffer.subarray(0, BIN_MAGIC.length).equals(BIN_MAGIC)) {
    return buffer; // archivo sin cifrar (previo al cifrado) → tal cual
  }
  const iv = buffer.subarray(BIN_MAGIC.length, BIN_MAGIC.length + 12);
  const tag = buffer.subarray(BIN_MAGIC.length + 12, BIN_MAGIC.length + 28);
  const ciphertext = buffer.subarray(BIN_MAGIC.length + 28);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    if (!globalForKey.__decryptWarned) {
      globalForKey.__decryptWarned = true;
      console.error('[seguridad] Falló el descifrado de un adjunto (¿cambió DATA_ENCRYPTION_KEY?).');
    }
    return buffer; // no romper el servido; el visor mostrará un archivo ilegible
  }
}

export function isEncryptedBytes(stored: Uint8Array): boolean {
  const buffer = Buffer.isBuffer(stored) ? stored : Buffer.from(stored);
  return buffer.length >= BIN_MAGIC.length && buffer.subarray(0, BIN_MAGIC.length).equals(BIN_MAGIC);
}
