'use server';

import { revalidatePath } from 'next/cache';
import { ChooseEmailTheme } from '@/contexts/marketing/application/choose-email-theme/ChooseEmailTheme';
import { RestoreMessageTemplate } from '@/contexts/marketing/application/restore-message-template/RestoreMessageTemplate';
import { UpdateMessageTemplate } from '@/contexts/marketing/application/update-message-template/UpdateMessageTemplate';
import { UpdateMessageTemplateMessage } from '@/contexts/marketing/application/update-message-template/UpdateMessageTemplateMessage';
import { SqliteEmailThemeStore } from '@/contexts/marketing/infrastructure/persistence/SqliteEmailThemeStore';
import { SqliteMessageTemplateOverrideRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMessageTemplateOverrideRepository';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';

export interface MensajesActionState {
  ok?: string;
  error?: string;
}

export async function chooseEmailThemeAction(
  _prev: MensajesActionState,
  formData: FormData,
): Promise<MensajesActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    await new ChooseEmailTheme(new SqliteEmailThemeStore(ownerUserId)).choose(String(formData.get('tema') ?? ''));
    revalidatePath('/mensajes');
    return { ok: 'Tema de correo guardado. Tus próximos correos usarán este diseño.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar el tema de correo.' };
  }
}

export async function updateTemplateAction(
  _prev: MensajesActionState,
  formData: FormData,
): Promise<MensajesActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    const message = new UpdateMessageTemplateMessage({
      templateKey: String(formData.get('clave') ?? ''),
      subject: String(formData.get('asunto') ?? ''),
      body: String(formData.get('contenido') ?? ''),
    });
    await new UpdateMessageTemplate(new SqliteMessageTemplateOverrideRepository(ownerUserId)).update(message);
    revalidatePath('/mensajes');
    revalidatePath('/marketing');
    return { ok: 'Plantilla personalizada guardada.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la plantilla.' };
  }
}

export async function restoreTemplateAction(
  _prev: MensajesActionState,
  formData: FormData,
): Promise<MensajesActionState> {
  const ownerUserId = await requireDataOwnerUserId();
  try {
    await new RestoreMessageTemplate(new SqliteMessageTemplateOverrideRepository(ownerUserId)).restore(
      String(formData.get('clave') ?? ''),
    );
    revalidatePath('/mensajes');
    revalidatePath('/marketing');
    return { ok: 'Se restauró la plantilla original.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo restaurar la plantilla.' };
  }
}
