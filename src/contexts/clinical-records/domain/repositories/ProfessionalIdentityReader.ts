/**
 * Read model del profesional en sesión para los encabezados de exportables y
 * reportes firmados (spec v2 §6.8): nombre, cédula, contacto y logo de su
 * organización (si pertenece a una).
 */
export interface ProfessionalIdentity {
  fullName: string;
  /** Cédula / tarjeta profesional. */
  professionalLicense: string;
  email: string;
  /** Teléfono de contacto con lada, listo para mostrar. */
  contactPhone: string;
  contactAddress: string;
  organizationName: string | null;
  /** Logo de la organización embebido como data URI (apto para imprimir). */
  organizationLogoDataUri: string | null;
}

export interface ProfessionalIdentityReader {
  read(): Promise<ProfessionalIdentity | null>;
}
