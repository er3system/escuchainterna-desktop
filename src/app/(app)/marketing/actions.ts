'use server';

import { revalidatePath } from 'next/cache';
import { SendMassEmail } from '@/contexts/marketing/application/send-mass-email/SendMassEmail';
import { SendMassEmailMessage } from '@/contexts/marketing/application/send-mass-email/SendMassEmailMessage';
import { UpdateAutomation } from '@/contexts/marketing/application/update-automation/UpdateAutomation';
import { UpdateAutomationMessage } from '@/contexts/marketing/application/update-automation/UpdateAutomationMessage';
import { SqliteMarketingAutomationRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMarketingAutomationRepository';
import { SqliteMarketingCampaignRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMarketingCampaignRepository';
import { SqliteRecipientDirectory } from '@/contexts/marketing/infrastructure/persistence/SqliteRecipientDirectory';
import { OutboxEmailDispatcher } from '@/contexts/marketing/infrastructure/outbox/OutboxEmailDispatcher';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { forbidAssistantRole, forbidProfessorRole } from '@/shared/infrastructure/auth/dataOwner';

export interface MarketingActionState {
  ok?: string;
  error?: string;
}

/** Mismo gate de /marketing, aplicado también a invocaciones directas de server actions. */
async function requireMarketingOwner(): Promise<string> {
  const ownerUserId = await forbidProfessorRole();
  await forbidAssistantRole();
  return ownerUserId;
}

async function senderInfo(ownerUserId: string): Promise<{ senderName: string; scheduleLink: string }> {
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  return {
    senderName: profile?.fullName || 'Tu profesional',
    scheduleLink: `${baseUrl}/reservar/${profile?.publicSlug ?? ''}`,
  };
}

export async function sendMassEmailAction(
  _prev: MarketingActionState,
  formData: FormData,
): Promise<MarketingActionState> {
  const ownerUserId = await requireMarketingOwner();
  try {
    const toAll = formData.get('todos') === '1';
    const recipientIds = formData.getAll('destinatario').map(String);
    const message = new SendMassEmailMessage({
      subject: String(formData.get('asunto') ?? ''),
      body: String(formData.get('mensaje') ?? ''),
      recipientIds: toAll ? 'todos' : recipientIds,
      ...(await senderInfo(ownerUserId)),
    });
    const result = await new SendMassEmail(
      new SqliteRecipientDirectory(ownerUserId),
      new SqliteMarketingCampaignRepository(ownerUserId),
      new OutboxEmailDispatcher(ownerUserId),
    ).send(message);
    revalidatePath('/marketing');
    revalidatePath('/mensajes');
    const skipped =
      result.skippedWithoutEmail > 0
        ? ` Se omitieron ${result.skippedWithoutEmail} pacientes sin correo registrado.`
        : '';
    return { ok: `Se registraron ${result.sent} correos en el outbox.${skipped}` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo enviar el correo masivo.' };
  }
}

export async function updateAutomationAction(
  _prev: MarketingActionState,
  formData: FormData,
): Promise<MarketingActionState> {
  const ownerUserId = await requireMarketingOwner();
  try {
    const rawInterval = String(formData.get('intervalo') ?? '');
    const message = new UpdateAutomationMessage({
      kind: String(formData.get('tipo') ?? ''),
      enabled: formData.get('activa') === '1',
      subject: String(formData.get('asunto') ?? ''),
      body: String(formData.get('mensaje') ?? ''),
      intervalMonths: rawInterval === '' ? null : Number(rawInterval),
    });
    await new UpdateAutomation(new SqliteMarketingAutomationRepository(ownerUserId)).update(message);
    revalidatePath('/marketing');
    return { ok: 'Se guardó la automatización.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la automatización.' };
  }
}
