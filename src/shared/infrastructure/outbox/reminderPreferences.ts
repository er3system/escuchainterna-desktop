import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface ReminderChannels {
  whatsapp: boolean;
  email: boolean;
}

/**
 * Preferencia de recordatorios del paciente por canal (Ajustes del paciente, v23).
 * Solo aplica a RECORDATORIOS (sesión y pago), no a confirmaciones/cancelaciones.
 * Falla ABIERTO: si no se puede leer o el paciente no existe para ese dueño, se
 * asume que sí recibe por ambos canales (comportamiento histórico, default 1).
 */
export async function patientReminderChannels(
  ownerUserId: string,
  patientId: string,
): Promise<ReminderChannels> {
  try {
    const row = await getDatabaseAdapter().queryRow<{ reminders_whatsapp: number; reminders_email: number }>(
      'SELECT reminders_whatsapp, reminders_email FROM patients WHERE id = ? AND owner_user_id = ?',
      [patientId, ownerUserId],
    );
    if (!row) return { whatsapp: true, email: true };
    return { whatsapp: row.reminders_whatsapp !== 0, email: row.reminders_email !== 0 };
  } catch {
    return { whatsapp: true, email: true };
  }
}
