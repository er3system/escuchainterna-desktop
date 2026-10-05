import type { FileStorage } from './FileStorage';

/**
 * Almacenamiento genérico (no clínico) en object storage vía la API REST de
 * Supabase Storage. Sube el contenido TAL CUAL (sin cifrado app-level: son
 * imágenes públicas dentro de la app; el bucket aporta su cifrado at-rest). La
 * `key` la provee el llamador (`perfil/...`, `orgs/<id>/...`).
 */
export class SupabaseFileStorage implements FileStorage {
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
    return { Authorization: `Bearer ${this.serviceKey}`, apikey: this.serviceKey };
  }

  public async save(key: string, data: Uint8Array): Promise<void> {
    const response = await fetch(this.objectUrl(key), {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
      body: data as unknown as BodyInit,
    });
    if (!response.ok) {
      throw new Error(`No se pudo subir el archivo a Storage (HTTP ${response.status}).`);
    }
  }

  public async read(key: string): Promise<Uint8Array | null> {
    const response = await fetch(this.objectUrl(key), { method: 'GET', headers: this.authHeaders() });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`No se pudo leer el archivo de Storage (HTTP ${response.status}).`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  public async delete(key: string): Promise<void> {
    const response = await fetch(this.objectUrl(key), { method: 'DELETE', headers: this.authHeaders() });
    if (!response.ok && response.status !== 404) {
      throw new Error(`No se pudo borrar el archivo de Storage (HTTP ${response.status}).`);
    }
  }
}
