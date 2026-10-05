/**
 * Puerto para crear el perfil profesional inicial al registrar una cuenta.
 * La implementación escribe en practitioner_profile (contexto practitioner)
 * sin acoplar identity a sus clases.
 */
export interface InitialProfileInput {
  userId: string;
  fullName: string;
  phone: string;
  phoneCountryCode: string;
}

export interface ProfileProvisioner {
  createInitialProfile(input: InitialProfileInput): Promise<void>;
  /** Actualiza el nombre mostrado del perfil (edición de cuenta desde /admin). No-op si no hay perfil. */
  updateFullName(userId: string, fullName: string): Promise<void>;
}
