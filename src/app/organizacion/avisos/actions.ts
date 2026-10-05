'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { createNotificationUseCases } from '@/contexts/notifications/infrastructure/createNotificationUseCases';
import { SendOrgNoticeMessage } from '@/contexts/notifications/application/send-org-notice/SendOrgNoticeMessage';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { listOrganizationMembers } from '../orgData';
import { listSupervised } from '@/app/supervision/supervisionData';

export interface OrgNoticeFormState {
  ok?: string;
  error?: string;
}

/**
 * Destinatarios PERMITIDOS para avisos (v3 §12): el org_master puede avisar a
 * todos los miembros de SU organización; el profesor SOLO a sus supervisados.
 */
async function allowedRecipientIds(userId: string): Promise<string[]> {
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context) return [];
  if (context.role === 'org_master' && context.organization) {
    return (await listOrganizationMembers(context.organization.id))
      .filter((member) => member.userId !== userId && member.status === 'activo')
      .map((member) => member.userId);
  }
  if (context.role === 'professor') {
    return (await listSupervised(userId)).map((supervised) => supervised.userId);
  }
  return [];
}

export async function sendOrgNoticeAction(
  _prev: OrgNoticeFormState,
  formData: FormData,
): Promise<OrgNoticeFormState> {
  const userId = await requireActiveAppSessionUserId();
  const allowed = await allowedRecipientIds(userId);
  if (allowed.length === 0) redirect('/inicio');

  try {
    const toAll = formData.get('todos') === 'on';
    const requested = formData.getAll('destinatarios').map((value) => String(value));
    const recipients = toAll ? allowed : requested.filter((id) => allowed.includes(id));

    const message = new SendOrgNoticeMessage({
      senderUserId: userId,
      recipientUserIds: recipients,
      title: String(formData.get('titulo') ?? ''),
      body: String(formData.get('cuerpo') ?? ''),
    });
    const sent = await createNotificationUseCases().sendOrgNotice.send(message);
    revalidatePath('/organizacion/avisos');
    return { ok: `Aviso enviado a ${sent} ${sent === 1 ? 'persona' : 'personas'}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo enviar el aviso.' };
  }
}
