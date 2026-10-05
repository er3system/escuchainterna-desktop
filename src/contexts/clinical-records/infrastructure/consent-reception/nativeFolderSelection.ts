import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
export function verifyConsentFolderSelection(token: string, owner: string): string {
  if (typeof token !== 'string' || token.length > 12000 || !process.env.SESSION_SECRET || !process.env.CONSENT_RECEPTION_DEVICE_ID) throw new Error('Selecciona la carpeta desde el programa de escritorio.');
  const [encoded, signature, extra] = token.split('.');
  const expected = createHmac('sha256', process.env.SESSION_SECRET).update(`consent-folder:${encoded}`).digest();
  const actual = Buffer.from(signature ?? '', 'base64url');
  if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('La selección de carpeta no es válida.');
  const input = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { folder: string; owner: string; device: string; expires: number };
  if (input.owner !== owner || input.device !== process.env.CONSENT_RECEPTION_DEVICE_ID || !Number.isFinite(input.expires) || input.expires < Date.now() || input.expires > Date.now() + 310000 || typeof input.folder !== 'string' || !path.isAbsolute(input.folder)) throw new Error('Vuelve a seleccionar la carpeta de recepción.');
  return input.folder;
}
