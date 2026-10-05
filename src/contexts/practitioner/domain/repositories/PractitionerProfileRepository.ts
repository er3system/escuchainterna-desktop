export interface PractitionerProfilePrimitives {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  /** Indicativo del país del celular (p. ej. «+52»). */
  phoneCountryCode: string;
  description: string;
  photoPath: string | null;
  publicSlug: string;
  modality: string;
  address: string;
  mapsUrl: string;
  currency: string;
  defaultPrice: number;
  paymentMode: string;
  showPrice: boolean;
  paymentPolicies: string;
  availability: Array<{ day: number; ranges: Array<{ from: string; to: string }> }>;
  sessionReminderHours: number;
  cancellationMinHours: number;
  autoPaymentReminders: boolean;
  onboardingCompleted: boolean;
  /** Cédula / tarjeta profesional (aparece en exportables y reportes firmados). */
  professionalLicense: string;
  /** Dirección de contacto profesional (encabezados de exportables). */
  contactAddress: string;
  /** Teléfono de contacto (con indicativo embebido, p. ej. «+52 2221234567»). */
  contactPhone: string;
  /** Tarifa por inasistencia (6.3). */
  noShowFeeEnabled: boolean;
  noShowFeeAmount: number;
  /** Tarifa por cancelación tardía (6.3). */
  lateCancelFeeEnabled: boolean;
  lateCancelFeeAmount: number;
  /** Tema visual de los correos del profesional (calido | profesional | minimal). */
  emailTheme: string;
}

export interface PractitionerProfileRepository {
  createEmptyProfileFor(userId: string): Promise<void>;
  findByUserId(userId: string): Promise<PractitionerProfilePrimitives | null>;
  update(profile: PractitionerProfilePrimitives): Promise<void>;
}
