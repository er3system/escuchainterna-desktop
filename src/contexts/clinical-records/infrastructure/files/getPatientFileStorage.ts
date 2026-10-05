import type { PatientFileStorage } from '../../domain/PatientFileStorage';
import { LocalPatientFileStorage } from './LocalPatientFileStorage';
import { SupabasePatientFileStorage } from './SupabasePatientFileStorage';

/**
 * Devuelve el almacenamiento de archivos del paciente según el entorno: con las
 * tres variables de Storage presentes → Supabase (producción/escala); si no →
 * disco local (dev/tests). Punto único de cambio de backend, espejo de
 * `getDatabaseAdapter()`.
 */
export function getPatientFileStorage(): PatientFileStorage {
  const baseUrl = process.env.SUPABASE_STORAGE_URL;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (baseUrl && bucket && serviceKey) {
    return new SupabasePatientFileStorage(baseUrl, bucket, serviceKey);
  }
  return new LocalPatientFileStorage();
}
