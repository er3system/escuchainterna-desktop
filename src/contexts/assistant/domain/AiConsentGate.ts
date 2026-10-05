/**
 * Puerto que decide si el asistente puede PROCESAR los datos de un paciente por IA. Requiere un
 * consentimiento informado OTORGADO, vigente (no revocado) y con la cláusula de finalidad-IA
 * (Ley 1581: el procesamiento por un tercero de IA exige consentimiento de finalidad explícita).
 *
 * fail-closed: ante la duda o sin consentimiento, NO autoriza. Solo lee el ESTADO (un flag), nunca
 * contenido clínico. El retriever lo consulta ANTES de descifrar/recuperar el contexto del paciente.
 */
export interface AiConsentGate {
  isAuthorized(patientId: string): Promise<boolean>;
}
