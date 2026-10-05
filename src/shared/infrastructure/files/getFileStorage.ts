import type { FileStorage } from './FileStorage';
import { LocalFileStorage } from './LocalFileStorage';
import { SupabaseFileStorage } from './SupabaseFileStorage';

/**
 * Almacenamiento genérico (fotos/logos) según el entorno: con las tres variables
 * de Storage presentes → Supabase; si no → disco local (dev). Mismas variables
 * que el storage clínico (`getPatientFileStorage`) y espejo de `getDatabaseAdapter`.
 */
export function getFileStorage(): FileStorage {
  const baseUrl = process.env.SUPABASE_STORAGE_URL;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (baseUrl && bucket && serviceKey) {
    return new SupabaseFileStorage(baseUrl, bucket, serviceKey);
  }
  return new LocalFileStorage();
}
