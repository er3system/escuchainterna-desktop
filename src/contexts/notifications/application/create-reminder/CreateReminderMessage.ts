import { InvalidNotificationContentError } from '../../domain/errors/InvalidNotificationContentError';

/**
 * Recordatorio propio (v3 §12): título obligatorio, nota y paciente opcionales
 * y fecha/hora `remindAt` opcional (visible desde entonces). `recipientUserIds`
 * los resuelve la capa de rutas: el propio usuario y, si es un asistente,
 * TAMBIÉN su titular (los recordatorios del asistente se duplican).
 */
export class CreateReminderMessage {
  private readonly reminderTitle: string;
  private readonly note: string;
  private readonly remindAtIso: string | null;
  private readonly patient: string | null;
  private readonly creator: string;
  private readonly recipients: string[];

  public constructor(input: {
    createdByUserId: string;
    recipientUserIds: string[];
    title: string;
    body?: string;
    remindAt?: string | null;
    patientId?: string | null;
  }) {
    this.reminderTitle = input.title.trim();
    if (!this.reminderTitle) {
      throw new InvalidNotificationContentError('El título del recordatorio es obligatorio.');
    }
    this.note = (input.body ?? '').trim();
    this.creator = input.createdByUserId;

    const uniqueRecipients = [...new Set(input.recipientUserIds.filter((id) => id.trim() !== ''))];
    if (uniqueRecipients.length === 0) {
      throw new InvalidNotificationContentError('El recordatorio necesita al menos un destinatario.');
    }
    this.recipients = uniqueRecipients;

    const raw = (input.remindAt ?? '').trim();
    if (raw === '') {
      this.remindAtIso = null;
    } else {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw new InvalidNotificationContentError('La fecha del recordatorio no es válida.');
      }
      this.remindAtIso = date.toISOString();
    }
    const patient = (input.patientId ?? '').trim();
    this.patient = patient === '' ? null : patient;
  }

  public title(): string {
    return this.reminderTitle;
  }

  public body(): string {
    return this.note;
  }

  public remindAt(): string | null {
    return this.remindAtIso;
  }

  public patientId(): string | null {
    return this.patient;
  }

  public createdByUserId(): string {
    return this.creator;
  }

  public recipientUserIds(): string[] {
    return this.recipients;
  }
}
