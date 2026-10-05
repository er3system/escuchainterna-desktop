/**
 * Read model de pacientes para marketing (CQRS): solo los datos que el
 * contexto necesita para seleccionar destinatarios y evaluar automatizaciones.
 */
export interface MarketingRecipient {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string | null; // YYYY-MM-DD
  lastSessionAt: string | null; // ISO
}

/**
 * Destinatario con los atributos que usan los filtros de segmentación al
 * componer un correo (etiquetas, estado, género, cumpleaños, última sesión).
 * Incluye también a los pacientes archivados (filtro "estado").
 */
export interface SegmentationRecipient extends MarketingRecipient {
  gender: string;
  archived: boolean;
  tags: string[];
}

export interface RecipientDirectory {
  listAll(): Promise<MarketingRecipient[]>;
  search(text: string): Promise<MarketingRecipient[]>;
  findByIds(ids: string[]): Promise<MarketingRecipient[]>;
  listWithBirthdayOn(month: number, day: number): Promise<MarketingRecipient[]>;
  /** Pacientes con al menos una sesión y cuya última sesión es anterior al corte. */
  listInactiveSince(cutoffIso: string): Promise<MarketingRecipient[]>;
  /** Todos los pacientes del owner (activos y archivados) con datos de segmentación. */
  listForSegmentation(): Promise<SegmentationRecipient[]>;
}
