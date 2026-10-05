/**
 * Puerto de almacenamiento físico de archivos del paciente. ASÍNCRONO para
 * soportar object storage (Supabase Storage) además del disco local. La key que
 * devuelve `save` es la que se guarda en BD (ruta relativa con Local, key de
 * objeto con Supabase). El contenido se cifra at-rest antes de guardar.
 */
export interface PatientFileStorage {
  /** Guarda el contenido (cifrado at-rest) y devuelve la key/ruta almacenada. */
  save(patientId: string, sanitizedName: string, data: Uint8Array): Promise<string>;
  /** Lee y DESCIFRA el contenido; null si no existe o la key es inválida. */
  read(storedPath: string): Promise<Uint8Array | null>;
  delete(storedPath: string): Promise<void>;
}
