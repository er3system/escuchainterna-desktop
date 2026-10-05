'use server';

import { revalidatePath } from 'next/cache';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import { CreateReminderMessage } from '@/contexts/notifications/application/create-reminder/CreateReminderMessage';
import type { NotificationItem } from '@/contexts/notifications/domain/Notification';
import {
  requireActiveAppSessionUserId,
  resolveDataOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

export interface NotificationFeedPayload {
  items: NotificationItem[];
  unread: number;
}

/**
 * Abre la campana: materializa novedades pendientes (fan-out perezoso) y
 * devuelve las notificaciones visibles recientes + contador de no leídas.
 */
export async function openNotificationsAction(): Promise<NotificationFeedPayload> {
  const userId = await requireActiveAppSessionUserId();
  return createNotificationUseCases().listNotifications.list(userId, 12);
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await requireActiveAppSessionUserId();
  await createNotificationUseCases().markAllNotificationsRead.markAll(userId);
  revalidatePath('/notificaciones');
}

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const userId = await requireActiveAppSessionUserId();
  await createNotificationUseCases().markNotificationRead.mark(userId, notificationId);
  revalidatePath('/notificaciones');
}

export interface ReminderFormState {
  ok?: string;
  error?: string;
}

/**
 * Recordatorio propio (v3 §12). Si quien lo crea es un asistente, el
 * recordatorio se duplica al titular: ambos lo ven en su campana.
 */
export async function createReminderAction(
  _prev: ReminderFormState,
  formData: FormData,
): Promise<ReminderFormState> {
  const sessionUserId = await requireActiveAppSessionUserId();
  const ownerUserId = await resolveDataOwnerUserId(sessionUserId);
  try {
    const patientId = String(formData.get('paciente') ?? '').trim();
    if (patientId) {
      // El paciente opcional debe ser del consultorio (scoping por dueño).
      const owned = await getDatabaseAdapter().queryRow(
        'SELECT 1 AS x FROM patients WHERE id = ? AND owner_user_id = ?',
        [patientId, ownerUserId],
      );
      if (!owned) return { error: 'El paciente seleccionado no es válido.' };
    }

    const message = new CreateReminderMessage({
      createdByUserId: sessionUserId,
      recipientUserIds: [sessionUserId, ownerUserId],
      title: String(formData.get('titulo') ?? ''),
      body: String(formData.get('nota') ?? ''),
      remindAt: String(formData.get('fecha') ?? ''),
      patientId,
    });
    await createNotificationUseCases().createReminder.create(message);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo crear el recordatorio.' };
  }
  revalidatePath('/notificaciones');
  return { ok: 'Recordatorio creado. Lo verás en tu campana en la fecha indicada.' };
}
