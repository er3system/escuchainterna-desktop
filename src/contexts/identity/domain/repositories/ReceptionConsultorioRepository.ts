/** Alcance de una recepción: la organización y los consultorios que atiende. */
export interface ReceptionScope {
  organizationId: string;
  consultorioIds: string[];
}

/** Una recepción de una organización con el conjunto de consultorios que atiende. */
export interface ReceptionAssignment {
  assistantUserId: string;
  consultorioIds: string[];
}

/**
 * Vínculo recepción ↔ consultorios (consultorios-spec §5). La recepción es una cuenta
 * role='assistant' ligada a UNA organización y a N consultorios; a diferencia del
 * asistente 1:1 (tabla `assistants`), no resuelve un dueño único.
 */
export interface ReceptionConsultorioRepository {
  /** Reemplaza (transaccional) el conjunto de consultorios de una recepción en una org. */
  setConsultorios(assistantUserId: string, organizationId: string, consultorioIds: string[]): Promise<void>;

  /** Alcance (org + consultorios) de la recepción, o null si la cuenta no es recepción. */
  scopeFor(assistantUserId: string): Promise<ReceptionScope | null>;

  /** Recepciones de una organización con sus consultorios. */
  listByOrganization(organizationId: string): Promise<ReceptionAssignment[]>;
}
