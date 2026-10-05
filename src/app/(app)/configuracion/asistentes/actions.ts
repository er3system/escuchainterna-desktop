'use server';

import { revalidatePath } from 'next/cache';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { CreateAssistantMessage } from '@/contexts/identity/application/create-assistant/CreateAssistantMessage';
import { SetAssistantActiveStatusMessage } from '@/contexts/identity/application/set-assistant-active-status/SetAssistantActiveStatusMessage';
import { DomainError } from '@/shared/domain/DomainError';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { bumpSessionEpoch } from '@/shared/infrastructure/auth/session';

export interface CreateAssistantState {
  ok?: boolean;
  error?: string;
  /** Se muestra UNA sola vez; el titular debe compartirla con el asistente. */
  temporaryPassword?: string;
  assistantEmail?: string;
  assistantName?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof DomainError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function createAssistantAction(
  _prev: CreateAssistantState,
  formData: FormData,
): Promise<CreateAssistantState> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const message = new CreateAssistantMessage({
      ownerUserId,
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? ''),
    });
    const created = await createIdentityUseCases().createAssistant.create(message);
    revalidatePath('/configuracion/asistentes');
    return {
      ok: true,
      temporaryPassword: created.temporaryPassword,
      assistantEmail: message.emailValue(),
      assistantName: message.fullName(),
    };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo crear la cuenta del asistente.') };
  }
}

export async function setAssistantStatusAction(formData: FormData): Promise<void> {
  const ownerUserId = await requireClinicalConfigAccess();
  const assistantUserId = String(formData.get('assistantUserId') ?? '');
  const active = String(formData.get('active') ?? '') === '1';
  if (!assistantUserId) return;

  await createIdentityUseCases().setAssistantActiveStatus.set(
    new SetAssistantActiveStatusMessage({ actorUserId: ownerUserId, assistantUserId, active }),
  );
  // SEG-4: al desactivar al asistente, sus sesiones vigentes dejan de valer de inmediato.
  if (!active) await bumpSessionEpoch(assistantUserId);
  revalidatePath('/configuracion/asistentes');
}
