import { randomUUID } from 'node:crypto';
import { decryptBytes, encryptBytes } from '@/shared/infrastructure/crypto/FieldEncryption';
import type { PatientFileStorage } from '../../domain/PatientFileStorage';

/**
 * Almacenamiento de archivos del paciente en **object storage** vía la API REST
 * de Supabase Storage. Es el impl de producción/escala del puerto
 * {@link PatientFileStorage}: se selecciona cuando hay credenciales de Storage
 * (ver `getPatientFileStorage`). En dev/tests se usa `LocalPatientFileStorage`.
 *
 * El cifrado at-rest se mantiene IDÉNTICO al local: se cifra ANTES de subir
 * (`encryptBytes`) y se descifra al leer (`decryptBytes`), de modo que el dato
 * clínico nunca toca el bucket en claro (defensa en profundidad sobre el cifrado
 * de Storage del propio Supabase).
 *
 * La key que devuelve `save` (`{patientId}/{uuid}-{nombre}`) es la que se guarda
 * en BD (columna stored_path/file_path) — opaca, sin colisiones, sin sobre-escritura.
 */
export class SupabasePatientFileStorage implements PatientFileStorage {
  public constructor(
    private readonly baseUrl: string,
    private readonly bucket: string,
    private readonly serviceKey: string,
  ) {}

  private objectUrl(key: string): string {
    const encoded = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${this.baseUrl}/storage/v1/object/${this.bucket}/${encoded}`;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      apikey: this.serviceKey,
    };
  }

  public async save(patientId: string, sanitizedName: string, data: Uint8Array): Promise<string> {
    // Key única (sin sobre-escritura ni chequeo de existencia, a diferencia del disco).
    const key = `${patientId}/${randomUUID().slice(0, 8)}-${sanitizedName}`;
    const encrypted = encryptBytes(data);
    const response = await fetch(this.objectUrl(key), {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: encrypted as unknown as BodyInit,
    });
    if (!response.ok) {
      throw new Error(`No se pudo subir el archivo a Storage (HTTP ${response.status}).`);
    }
    return key;
  }

  public async read(storedPath: string): Promise<Uint8Array | null> {
    const response = await fetch(this.objectUrl(storedPath), {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`No se pudo leer el archivo de Storage (HTTP ${response.status}).`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    // decryptBytes es retrocompatible: contenido previo al cifrado se devuelve tal cual.
    return decryptBytes(bytes);
  }

  public async delete(storedPath: string): Promise<void> {
    const response = await fetch(this.objectUrl(storedPath), {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    // Borrado best-effort (como el local): un 404 no es error.
    if (!response.ok && response.status !== 404) {
      throw new Error(`No se pudo borrar el archivo de Storage (HTTP ${response.status}).`);
    }
  }
}
