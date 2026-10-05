/**
 * Consulta de idempotencia de las automatizaciones sobre el registro de envíos.
 */
export interface AutomationDeliveryLog {
  wasBirthdayGreetingSentThisYear(patientId: string, year: number): Promise<boolean>;
  wasReactivationSentSince(patientId: string, sinceIso: string): Promise<boolean>;
}
