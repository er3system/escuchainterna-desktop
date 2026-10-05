'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { CreateAgendaMessage } from '@/contexts/scheduling/application/create-agenda/CreateAgendaMessage';
import type { CreateAgendaInput } from '@/contexts/scheduling/application/create-agenda/CreateAgendaMessage';
import { UpdateAgendaMessage } from '@/contexts/scheduling/application/update-agenda/UpdateAgendaMessage';
import { ActivateAgenda } from '@/contexts/scheduling/application/activate-agenda/ActivateAgenda';
import { SqliteAgendaRepository } from '@/contexts/scheduling/infrastructure/persistence/SqliteAgendaRepository';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import {
  requireClinicalConfigAccess,
  sessionCanConfigurePayments,
} from '@/shared/infrastructure/auth/dataOwner';

export interface AgendaConfigActionState {
  ok: boolean;
  error?: string;
}

function refresh(): void {
  revalidatePath('/agenda');
  revalidatePath('/agenda/configuracion');
}

export async function createAgendaAction(input: CreateAgendaInput): Promise<AgendaConfigActionState> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const canConfigurePayments = await sessionCanConfigurePayments();
    const message = new CreateAgendaMessage({
      ...input,
      paymentOverride: canConfigurePayments ? input.paymentOverride : null,
    });
    await createSchedulingUseCases(ownerUserId).createAgenda.create(message);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo crear la agenda.' };
  }
  refresh();
  redirect('/agenda/configuracion');
}

export async function updateAgendaAction(
  input: CreateAgendaInput & { id: string },
): Promise<AgendaConfigActionState> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const canConfigurePayments = await sessionCanConfigurePayments();
    const agendaRepository = new SqliteAgendaRepository(ownerUserId);
    const storedPaymentOverride = canConfigurePayments
      ? input.paymentOverride
      : (await agendaRepository.findById(input.id))?.toPrimitives().paymentOverride ?? null;
    const message = new UpdateAgendaMessage({ ...input, paymentOverride: storedPaymentOverride });
    await createSchedulingUseCases(ownerUserId).updateAgenda.update(message);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la agenda.' };
  }
  refresh();
  redirect('/agenda/configuracion');
}

export async function deactivateAgendaAction(agendaId: string): Promise<AgendaConfigActionState> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    await createSchedulingUseCases(ownerUserId).deactivateAgenda.deactivate(agendaId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo desactivar la agenda.' };
  }
  refresh();
  return { ok: true };
}

export async function activateAgendaAction(agendaId: string): Promise<AgendaConfigActionState> {
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    await new ActivateAgenda(new SqliteAgendaRepository(ownerUserId)).activate(agendaId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo activar la agenda.' };
  }
  refresh();
  return { ok: true };
}
