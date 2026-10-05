'use server';
import { revalidatePath } from 'next/cache';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { ConnectPersonalProvider } from '@/contexts/practitioner/application/connect-personal-provider/ConnectPersonalProvider';
import { ConnectPersonalProviderMessage } from '@/contexts/practitioner/application/connect-personal-provider/ConnectPersonalProviderMessage';
import { DisconnectPersonalProviderMessage } from '@/contexts/practitioner/application/connect-personal-provider/DisconnectPersonalProviderMessage';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';
export interface PersonalProviderState { ok?: string; error?: string }
export async function personalProviderAction(_prev: PersonalProviderState, form: FormData): Promise<PersonalProviderState> {
  if (!isDesktopEdition()) return { error: 'Disponible en la edición PC.' };
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const useCase = new ConnectPersonalProvider(new SqlitePersonalProviderRepository());
    const provider = String(form.get('provider') ?? '');
    if (form.get('intent') === 'disconnect') await useCase.disconnect(new DisconnectPersonalProviderMessage(ownerUserId, provider));
    else await useCase.connect(new ConnectPersonalProviderMessage({ ownerUserId, provider,
      apiKey: String(form.get('api_key') ?? ''), model: String(form.get('model') ?? ''), sender: String(form.get('sender') ?? ''), authorized: form.get('authorized') === 'on' }));
    revalidatePath('/configuracion/integraciones');
    revalidatePath('/asistente');
    revalidatePath('/mensajes');
    return { ok: form.get('intent') === 'disconnect' ? 'Clave eliminada. Se usará el modo local.' : 'Configuración guardada. La validez y el acceso se comprobarán al usar el servicio.' };
  } catch (error) { return { error: error instanceof Error ? error.message : 'No se pudo guardar la configuración.' }; }
}
