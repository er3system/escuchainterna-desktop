'use server';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { processOutbox } from '@/shared/infrastructure/outbox/processOutbox';
import { revalidatePath } from 'next/cache';
export async function retryDesktopMail(): Promise<void> {
  const owner = await requireDataOwnerUserId();
  if (!isDesktopEdition()) return;
  await processOutbox(50, owner);
  revalidatePath('/mensajes');
}
