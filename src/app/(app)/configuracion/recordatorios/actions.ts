'use server';

import { revalidatePath } from 'next/cache';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';

export interface RecordatoriosFormState {
  ok?: string;
  error?: string;
}

const REMINDER_HOURS = [12, 24, 36, 48];
const CANCELLATION_HOURS = [0, 6, 12, 24, 48];

export async function updateRemindersAction(
  _prev: RecordatoriosFormState,
  formData: FormData,
): Promise<RecordatoriosFormState> {
  const repository = new SqlitePractitionerProfileRepository();
  const userId = await requireClinicalConfigAccess();
  const profile = await repository.findByUserId(userId);
  if (!profile) return { error: 'No se encontró el perfil del profesional.' };

  try {
    const reminderHours = Number(formData.get('anticipacion'));
    const cancellationHours = Number(formData.get('cancelacion'));
    await repository.update({
      ...profile,
      sessionReminderHours: REMINDER_HOURS.includes(reminderHours) ? reminderHours : profile.sessionReminderHours,
      cancellationMinHours: CANCELLATION_HOURS.includes(cancellationHours)
        ? cancellationHours
        : profile.cancellationMinHours,
      autoPaymentReminders: formData.get('recordatorios_pago') === '1',
    });
    revalidatePath('/configuracion/recordatorios');
    return { ok: '¡Se ha guardado exitosamente!' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la configuración.' };
  }
}
