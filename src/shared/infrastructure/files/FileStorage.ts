/**
 * Puerto genérico de almacenamiento de archivos NO clínicos (fotos de perfil,
 * logos de organización): el que los sube provee la `key`. ASÍNCRONO para
 * soportar object storage (Supabase Storage) además del disco local. A
 * diferencia del puerto clínico {@link PatientFileStorage}, NO cifra at-rest
 * (son imágenes públicas dentro de la app; el bucket aporta su propio cifrado).
 */
export interface FileStorage {
  /** Guarda el contenido bajo `key` (la calcula el llamador; sin sobre-escritura implícita). */
  save(key: string, data: Uint8Array): Promise<void>;
  /** Lee el contenido; null si no existe o la key es inválida. */
  read(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}
