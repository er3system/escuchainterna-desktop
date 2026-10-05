'use server';
import { revalidatePath } from 'next/cache';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { CalendarOwnerMessage, ConnectGoogleCalendarMessage, PublishCalendarMessage } from '@/contexts/practitioner/application/google-calendar/GoogleCalendarMessages';
import { createGoogleCalendarConsultation, withCalendarOwner } from '@/contexts/practitioner/infrastructure/google-calendar/createGoogleCalendarConsultation';
import { GoogleCalendarAccessError } from '@/contexts/practitioner/domain/errors/GoogleCalendarAccessError';
export interface GoogleCalendarActionState { url?: string; ok?: string; error?: string; conflicts?: Array<{ start: string; end: string }> }
export async function googleCalendarAction(_previous: GoogleCalendarActionState, form: FormData): Promise<GoogleCalendarActionState> {
  if (!isDesktopEdition()) return { error: 'Esta conexión está disponible en la aplicación de PC.' };
  const ownerUserId = await requireClinicalConfigAccess();
  try {
    const useCase = createGoogleCalendarConsultation(); const ownerMessage = new CalendarOwnerMessage(ownerUserId);
    const result = await withCalendarOwner(ownerMessage.owner, async (): Promise<GoogleCalendarActionState> => {
      const intent = String(form.get('intent') ?? 'connect');
      if (intent === 'disconnect') { await useCase.disconnect(ownerMessage); return { ok: 'Acceso eliminado de esta consulta. El calendario y los eventos siguen en Google; puedes revocar los permisos desde tu cuenta de Google.' }; }
      if (intent === 'connect') return { url: useCase.connect(new ConnectGoogleCalendarMessage(ownerUserId, String(form.get('client_id') ?? ''), String(form.get('client_secret') ?? ''), process.env.APP_URL ?? '', form.get('authorized') === 'on')) };
      const message = new PublishCalendarMessage(ownerUserId, String(form.get('start') ?? ''), String(form.get('end') ?? ''), form.get('authorized') === 'on');
      if (intent === 'availability') {
        const availability = await useCase.availability(message);
        return { ok: `Consulta completada: ${availability.conflicts.length} de ${availability.sessions} sesiones coinciden con horarios ocupados de tu calendario principal.`, conflicts: availability.conflicts };
      }
      if (intent !== 'publish') throw new GoogleCalendarAccessError('Operación de Calendar no reconocida.');
      const publication = await useCase.publish(message);
      return { ok: `${publication.published} horarios publicados o actualizados y ${publication.removed} horarios retirados del intervalo elegido. Repite la publicación después de cambiar tu agenda.` };
    });
    for (const path of ['/agenda', '/configuracion/google-calendar', '/configuracion/integraciones']) revalidatePath(path);
    return result;
  } catch (error) { return { error: error instanceof GoogleCalendarAccessError ? error.message : 'No se pudo completar la operación. Revisa tu configuración y vuelve a intentar.' }; }
}
