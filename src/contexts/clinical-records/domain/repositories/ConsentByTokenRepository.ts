import type { PatientConsent } from '../PatientConsent';

/**
 * Acceso PÚBLICO a un consentimiento por su token único (página de firma,
 * sin sesión): el token impredecible ES la credencial, por eso este puerto
 * no filtra por owner. Solo permite leer y guardar la firma.
 */
export interface ConsentByTokenRepository {
  findByToken(token: string): Promise<PatientConsent | null>;
  save(consent: PatientConsent): Promise<void>;
}
