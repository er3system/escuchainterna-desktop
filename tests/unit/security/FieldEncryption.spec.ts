import { describe, it, expect } from 'vitest';
import {
  decryptBytes,
  decryptField,
  encryptBytes,
  encryptField,
  isEncrypted,
  isEncryptedBytes,
} from '@/shared/infrastructure/crypto/FieldEncryption';

describe('FieldEncryption (AES-256-GCM, v3 §1.1)', () => {
  it('cifra y descifra ida y vuelta', () => {
    const plain = 'El paciente refiere mejoría del estado de ánimo. Ñandú, acentos: áéíóú.';
    const stored = encryptField(plain);
    expect(stored).not.toBe(plain);
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(decryptField(stored)).toBe(plain);
  });

  it('usa el formato enc:v1:<iv>:<tag>:<cipher> con IV aleatorio por llamada', () => {
    const a = encryptField('misma nota');
    const b = encryptField('misma nota');
    expect(a).not.toBe(b); // IV aleatorio → ciphertext distinto
    expect(a.split(':')).toHaveLength(5); // enc, v1, iv, tag, cipher
  });

  it('decryptField devuelve tal cual los valores en claro (retrocompatible)', () => {
    expect(decryptField('texto plano previo al cifrado')).toBe('texto plano previo al cifrado');
    expect(decryptField('')).toBe('');
  });

  it('encryptField no doble-cifra ni cifra vacíos', () => {
    const once = encryptField('contenido');
    expect(encryptField(once)).toBe(once);
    expect(encryptField('')).toBe('');
  });

  it('isEncrypted distingue valores cifrados', () => {
    expect(isEncrypted(encryptField('x'))).toBe(true);
    expect(isEncrypted('x')).toBe(false);
  });

  it('un blob corrupto no revienta: se devuelve el blob', () => {
    const stored = encryptField('nota');
    const corrupted = stored.slice(0, -4) + 'AAAA';
    expect(decryptField(corrupted)).toBe(corrupted);
  });
});

describe('FieldEncryption — bytes (adjuntos clínicos)', () => {
  it('cifra y descifra bytes ida y vuelta', () => {
    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 250, 0, 255]); // simula un PNG
    const stored = encryptBytes(original);
    expect(isEncryptedBytes(stored)).toBe(true);
    expect(Buffer.from(stored).equals(Buffer.from(original))).toBe(false);
    expect(Buffer.from(decryptBytes(stored)).equals(Buffer.from(original))).toBe(true);
  });

  it('decryptBytes es retrocompatible: un archivo sin cifrar se devuelve tal cual', () => {
    const legacy = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // '%PDF' sin cifrar
    expect(isEncryptedBytes(legacy)).toBe(false);
    expect(Buffer.from(decryptBytes(legacy)).equals(Buffer.from(legacy))).toBe(true);
  });
});
