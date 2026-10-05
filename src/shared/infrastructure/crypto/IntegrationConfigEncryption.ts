import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readRequiredSecret } from '../config/runtime';

const PREFIX = 'enc:cfg:v1:';
const DATA_KEY_ID = 'data-v1';
const KEY_ID_PATTERN = /^[A-Za-z0-9._-]{1,48}$/;
const MAX_CONFIG_BYTES = 64 * 1024;

export interface IntegrationConfigContext {
  id: string;
  provider: string;
  ownerUserId: string;
}

export class IntegrationConfigEncryptionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'IntegrationConfigEncryptionError';
  }
}

const globalForIntegrationKeys = globalThis as unknown as {
  __escuchainternaIntegrationKeys?: Map<string, Buffer>;
};

function activeKeyId(): string {
  const keyId = process.env.INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID?.trim() || DATA_KEY_ID;
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new IntegrationConfigEncryptionError(
      'INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID tiene un formato inválido.',
    );
  }
  return keyId;
}

function configuredKeyring(): Record<string, string> {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEYS_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    const result: Record<string, string> = {};
    for (const [keyId, value] of Object.entries(parsed)) {
      if (!KEY_ID_PATTERN.test(keyId) || typeof value !== 'string' || value.trim().length < 16) {
        throw new Error();
      }
      result[keyId] = value.trim();
    }
    return result;
  } catch {
    throw new IntegrationConfigEncryptionError(
      'INTEGRATION_ENCRYPTION_KEYS_JSON debe ser un objeto JSON de claves válidas.',
    );
  }
}

function secretForKey(keyId: string): string {
  if (keyId === DATA_KEY_ID) {
    const fallback =
      (process.env.SESSION_SECRET ?? 'escuchainterna-local-dev-secret') +
      ':integration-config-at-rest';
    return readRequiredSecret('DATA_ENCRYPTION_KEY', fallback, 16);
  }
  const secret = configuredKeyring()[keyId];
  if (!secret) {
    throw new IntegrationConfigEncryptionError(
      `No está configurada la clave de integraciones requerida (${keyId}).`,
    );
  }
  return secret;
}

function keyFor(keyId: string): Buffer {
  const cache =
    globalForIntegrationKeys.__escuchainternaIntegrationKeys ??
    (globalForIntegrationKeys.__escuchainternaIntegrationKeys = new Map());
  const cached = cache.get(keyId);
  if (cached) return cached;
  const key = scryptSync(
    secretForKey(keyId),
    `escuchainterna-integration-config:${keyId}:v1`,
    32,
  );
  cache.set(keyId, key);
  return key;
}

function additionalAuthenticatedData(context: IntegrationConfigContext): Buffer {
  return Buffer.from(
    JSON.stringify([
      'integration_connections',
      context.id,
      context.provider,
      context.ownerUserId,
      'config_json',
    ]),
    'utf8',
  );
}

function validatedConfig(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IntegrationConfigEncryptionError('La configuración de integración no es un objeto válido.');
  }
  const config: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      throw new IntegrationConfigEncryptionError(
        'La configuración de integración contiene un valor no permitido.',
      );
    }
    config[key] = entry;
  }
  return config;
}

function parsePlainConfig(serialized: string): Record<string, string> {
  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONFIG_BYTES) {
    throw new IntegrationConfigEncryptionError('La configuración de integración excede el tamaño permitido.');
  }
  try {
    return validatedConfig(JSON.parse(serialized || '{}'));
  } catch (error) {
    if (error instanceof IntegrationConfigEncryptionError) throw error;
    throw new IntegrationConfigEncryptionError('La configuración de integración está dañada.');
  }
}

export function isEncryptedIntegrationConfig(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function integrationConfigKeyId(stored: string): string | null {
  if (!isEncryptedIntegrationConfig(stored)) return null;
  const keyId = stored.slice(PREFIX.length).split(':', 1)[0] ?? '';
  return KEY_ID_PATTERN.test(keyId) ? keyId : null;
}

/**
 * Cifra el JSON completo. El AAD liga el envelope a su fila, proveedor y dueño:
 * copiarlo a otro tenant o proveedor invalida el tag GCM.
 */
export function encryptIntegrationConfig(
  config: Record<string, string>,
  context: IntegrationConfigContext,
): string {
  const normalized = validatedConfig(config);
  if (Object.keys(normalized).length === 0) return '{}';
  const plain = JSON.stringify(normalized);
  if (Buffer.byteLength(plain, 'utf8') > MAX_CONFIG_BYTES) {
    throw new IntegrationConfigEncryptionError('La configuración de integración excede el tamaño permitido.');
  }
  const keyId = activeKeyId();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(keyId), iv);
  cipher.setAAD(additionalAuthenticatedData(context));
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    PREFIX.slice(0, -1),
    keyId,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

/**
 * Lectura dual para el despliegue: acepta JSON legacy y el envelope nuevo. Un
 * envelope corrupto, de otra fila o con una clave desconocida SIEMPRE lanza;
 * nunca se convierte silenciosamente en una configuración vacía.
 */
export function decryptIntegrationConfig(
  stored: string,
  context: IntegrationConfigContext,
): Record<string, string> {
  if (!stored || stored === '{}') return {};
  if (!isEncryptedIntegrationConfig(stored)) {
    if (stored.startsWith('enc:')) {
      throw new IntegrationConfigEncryptionError('Formato de cifrado de integración desconocido.');
    }
    return parsePlainConfig(stored);
  }

  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 4) {
    throw new IntegrationConfigEncryptionError('Envelope de integración inválido.');
  }
  const [keyId, ivEncoded, tagEncoded, cipherEncoded] = parts;
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new IntegrationConfigEncryptionError('Identificador de clave de integración inválido.');
  }
  try {
    const iv = Buffer.from(ivEncoded, 'base64url');
    const tag = Buffer.from(tagEncoded, 'base64url');
    const ciphertext = Buffer.from(cipherEncoded, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', keyFor(keyId), iv);
    decipher.setAAD(additionalAuthenticatedData(context));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return parsePlainConfig(plain);
  } catch (error) {
    if (error instanceof IntegrationConfigEncryptionError) throw error;
    throw new IntegrationConfigEncryptionError(
      'No se pudo descifrar la configuración de integración; se bloqueó su uso para protegerla.',
    );
  }
}
