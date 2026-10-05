/**
 * Personalizaciones del profesional sobre las plantillas integradas de
 * mensajes (tabla message_templates con su owner_user_id). La clave y el
 * nombre de la plantilla son fijos: solo se personaliza asunto y contenido.
 */
export interface MessageTemplateOverride {
  templateKey: string;
  subject: string;
  body: string;
  updatedAt: string; // ISO
}

export interface MessageTemplateOverrideRepository {
  findByKey(templateKey: string): Promise<MessageTemplateOverride | null>;
  listAll(): Promise<MessageTemplateOverride[]>;
  /** Crea o actualiza la personalización del owner para esa clave. */
  save(input: { templateKey: string; name: string; channel: string; subject: string; body: string }): Promise<void>;
  /** "Restaurar original": borra la fila personalizada (vuelve a la integrada). */
  deleteByKey(templateKey: string): Promise<void>;
}
