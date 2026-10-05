import { Mail } from 'lucide-react';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { SqliteRecipientDirectory } from '@/contexts/marketing/infrastructure/persistence/SqliteRecipientDirectory';
import { SqliteOutboxMessageLog } from '@/contexts/marketing/infrastructure/persistence/SqliteOutboxMessageLog';
import { EmptyState } from '@/components/ui';
import { MessageList } from '../../../mensajes/MessageList';
import { isDesktopEdition, locallyRecordedMessageChannels } from '@/shared/infrastructure/config/desktopEdition';

/**
 * Pestaña "Mensajes" del paciente: las comunicaciones por CORREO enviadas a este
 * paciente (recordatorios, confirmaciones, campañas), para revisarlas de un vistazo
 * sin ir al registro global. Reusa el registro del outbox filtrado por destinatario
 * EXACTO (el correo del paciente) y la misma lista expandible de Mensajes.
 */
export default async function PatientMensajesPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerUserId = await requireDataOwnerUserId();
  const { id } = await params;

  const [recipient] = await new SqliteRecipientDirectory(ownerUserId).findByIds([id]);
  const email = (recipient?.email ?? '').trim();
  const entries = email
    ? await new SqliteOutboxMessageLog(ownerUserId).search({ recipient: email, limit: 100 })
    : [];

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Mail size={15} className="shrink-0 text-primary" />
        {email ? (
          <span>
            {isDesktopEdition() ? 'Registro de correos para ' : 'Correos enviados a '}<span className="font-medium text-ink">{email}</span>
          </span>
        ) : (
          <span>Este paciente no tiene un correo registrado.</span>
        )}
      </p>

      {entries.length === 0 ? (
        <EmptyState
          title="Sin mensajes"
          description={
            email
              ? 'Aún no hay correos registrados. Los recordatorios, confirmaciones y campañas aparecerán aquí.'
              : 'Añade un correo en la ficha del paciente para poder enviarle recordatorios y campañas, y verlos aquí.'
          }
        />
      ) : (
        <MessageList entries={entries} locallyRecordedChannels={locallyRecordedMessageChannels()} />
      )}
    </div>
  );
}
