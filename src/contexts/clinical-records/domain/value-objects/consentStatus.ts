/**
 * Estados del consentimiento informado (módulo PURO: lo importan client
 * components para mostrar badges, no debe depender de módulos de Node).
 *
 * - pendiente:      liga emitida, el paciente aún no firma.
 * - firmado:        firmado digitalmente desde la página pública.
 * - papel_adjunto:  firmado en papel; el profesional adjuntó foto/escaneo.
 * - revocado:       liga cancelada o autorización retirada por el titular (Ley 1581).
 */
export type ConsentStatus = 'pendiente' | 'firmado' | 'papel_adjunto' | 'revocado';

export type ConsentSignatureKind = '' | 'digital' | 'papel';

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  pendiente: 'Pendiente de firma',
  firmado: 'Firmado digitalmente',
  papel_adjunto: 'Firmado en papel',
  revocado: 'Revocado',
};

export function isConsentStatus(value: string): value is ConsentStatus {
  return value === 'pendiente' || value === 'firmado' || value === 'papel_adjunto' || value === 'revocado';
}

/** ¿El consentimiento cuenta como otorgado (firma digital o papel adjunto)? */
export function isConsentGranted(status: ConsentStatus | null | undefined): boolean {
  return status === 'firmado' || status === 'papel_adjunto';
}
