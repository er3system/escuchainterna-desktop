export type OutboxLogChannel = 'whatsapp' | 'email';

/** 'omitido' = WhatsApp no enviado por límite del plan (el correo salió igual). */
export type OutboxLogStatus = 'pendiente' | 'enviado' | 'recibido' | 'leido' | 'fallido' | 'omitido';

export interface OutboxLogEntry {
  id: string;
  channel: OutboxLogChannel;
  recipient: string;
  recipientName: string;
  template: string;
  subject: string;
  body: string;
  status: OutboxLogStatus;
  createdAt: string;
  sentAt: string | null;
}

export interface OutboxLogCriteria {
  channel?: OutboxLogChannel;
  template?: string;
  search?: string;
  /** Destinatario EXACTO (correo/teléfono). A diferencia de `search` (LIKE), no
   *  produce falsos positivos por subcadena — úsalo para "mensajes de un paciente". */
  recipient?: string;
  /** Excluye una plantilla (template != ?). Para "Automáticos" = todo menos campañas. */
  excludeTemplate?: string;
  limit?: number;
  offset?: number;
}

/** Read model del outbox compartido (registro de mensajes WhatsApp/correo). */
export interface OutboxMessageLog {
  search(criteria: OutboxLogCriteria): Promise<OutboxLogEntry[]>;
  countMatching(criteria: OutboxLogCriteria): Promise<number>;
  listTemplates(): Promise<string[]>;
}
