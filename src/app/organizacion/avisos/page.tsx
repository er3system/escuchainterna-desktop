import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Megaphone } from 'lucide-react';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { homePathForRole } from '@/contexts/identity/domain/value-objects/UserRole';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Card, PageHeader } from '@/components/ui';
import { listOrganizationMembers } from '../orgData';
import { listSupervised } from '@/app/supervision/supervisionData';
import { OrgNoticeForm, type NoticeRecipientOption } from './OrgNoticeForm';

export const metadata = { title: 'Avisos · Organización · EscuchaInterna' };

interface SentNoticeRow {
  title: string;
  body: string;
  created_at: string;
  recipients: number;
}

/** Avisos ya enviados por este remitente, agrupados por publicación. */
async function listSentNotices(senderUserId: string): Promise<SentNoticeRow[]> {
  return (await getDatabaseAdapter().query(
    `SELECT title, body, MAX(created_at) AS created_at, COUNT(*) AS recipients
         FROM notifications
        WHERE created_by = ? AND kind = 'aviso_org'
        GROUP BY title, body
        ORDER BY created_at DESC
        LIMIT 20`,
    [senderUserId],
  )) as unknown as SentNoticeRow[];
}

export default async function OrganizacionAvisosPage() {
  const userId = await requireSessionUserId();
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context) redirect('/login');

  // v3 §12: org_master → todos sus miembros; profesor → SOLO sus supervisados.
  let recipients: NoticeRecipientOption[] = [];
  let audienceLabel = '';
  if (context.role === 'org_master' && context.organization) {
    recipients = (await listOrganizationMembers(context.organization.id))
      .filter((member) => member.userId !== userId && member.status === 'activo')
      .map((member) => ({
        userId: member.userId,
        name: member.fullName || member.email,
        detail: member.email,
      }));
    audienceLabel = 'los miembros de tu organización';
  } else if (context.role === 'professor') {
    recipients = (await listSupervised(userId)).map((supervised) => ({
      userId: supervised.userId,
      name: supervised.fullName || supervised.email,
      detail: supervised.email,
    }));
    audienceLabel = 'tus supervisados';
  } else {
    redirect(homePathForRole(context.role, context.onboardingCompleted));
  }

  const sent = await listSentNotices(userId);

  return (
    <div>
      <PageHeader
        title="Avisos"
        subtitle={`Envía avisos a ${audienceLabel}: fechas de corte, entregas, indicaciones. Llegan a su campana de notificaciones.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-base font-bold text-ink">Nuevo aviso</h2>
          {recipients.length === 0 ? (
            <p className="text-sm text-ink-soft">
              {context.role === 'professor'
                ? 'Aún no tienes supervisados asignados; cuando los tengas podrás enviarles avisos.'
                : 'Tu organización aún no tiene miembros activos a quienes avisar.'}
            </p>
          ) : (
            <OrgNoticeForm recipients={recipients} />
          )}
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-bold text-ink">Avisos enviados</h2>
          {sent.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
              <p className="text-base font-semibold text-ink">Sin avisos enviados</p>
              <p className="mt-1 max-w-md text-sm text-ink-soft">
                Tu primer aviso aparecerá aquí con su fecha y número de destinatarios.
              </p>
            </div>
          ) : (
            sent.map((notice) => (
              <div
                key={`${notice.title}-${notice.created_at}`}
                className="flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                  <Megaphone size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{notice.title}</p>
                  {notice.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{notice.body}</p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-ink-soft">
                    {format(new Date(notice.created_at), "d 'de' MMMM 'de' yyyy, HH:mm 'h'", {
                      locale: es,
                    })}{' '}
                    · {notice.recipients} destinatario{notice.recipients === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
