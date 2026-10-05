'use server';

import { revalidatePath } from 'next/cache';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import { PublishAnnouncementMessage } from '@/contexts/notifications/application/publish-announcement/PublishAnnouncementMessage';
import { SqliteAdminAuditLogRepository } from '@/contexts/identity/infrastructure/persistence/SqliteAdminAuditLogRepository';
import { requireAdmin } from '../requireAdmin';

export interface AnnouncementFormState {
  ok?: string;
  error?: string;
}

/**
 * Publica una novedad de plataforma (v3 §12). El fan-out a las campanas es
 * perezoso: cada usuario la materializa al abrir sus notificaciones.
 */
export async function publishAnnouncementAction(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const admin = await requireAdmin();
  try {
    const message = new PublishAnnouncementMessage({
      title: String(formData.get('titulo') ?? ''),
      body: String(formData.get('cuerpo') ?? ''),
      audience: String(formData.get('audiencia') ?? 'todos'),
      createdBy: admin.userId,
    });
    const announcementId = await createNotificationUseCases().publishAnnouncement.publish(message);

    await new SqliteAdminAuditLogRepository().record({
      actorUserId: admin.userId,
      action: 'publicar_novedad',
      target: announcementId,
      details: { titulo: message.title(), audiencia: message.audience() },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo publicar la novedad.' };
  }
  revalidatePath('/admin/novedades');
  return { ok: 'Novedad publicada: llegará a la campana de cada usuario de la audiencia.' };
}

/** Borra una novedad y sus notificaciones materializadas. Solo admin; auditado. */
export async function deleteAnnouncementAction(announcementId: string): Promise<AnnouncementFormState> {
  const admin = await requireAdmin();
  try {
    await createNotificationUseCases().deleteAnnouncement(announcementId);
    await new SqliteAdminAuditLogRepository().record({
      actorUserId: admin.userId,
      action: 'eliminar_novedad',
      target: announcementId,
    });
    revalidatePath('/admin/novedades');
    return { ok: 'Novedad eliminada.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo eliminar la novedad.' };
  }
}
