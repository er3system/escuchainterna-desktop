/**
 * Puerto anticorrupción mínimo hacia el contexto de pacientes.
 * El agendamiento solo necesita identificar/crear pacientes por contacto.
 */
export interface PatientContact {
  id: string;
  fullName: string;
  phone: string;
  email: string;
}

export interface PatientDirectory {
  findById(id: string): Promise<PatientContact | null>;
  findOrCreateByContact(input: {
    fullName: string;
    email: string;
    phone: string;
    /** Indicativo del país del celular (v2 §6.1, p. ej. «+52»). */
    phoneCountryCode?: string;
  }): Promise<PatientContact>;
}
