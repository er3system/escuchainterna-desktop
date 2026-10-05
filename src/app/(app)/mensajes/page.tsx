import Link from 'next/link';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { resolveWaBudget, type WaBudget } from '@/shared/infrastructure/message-billing/WaBudgetGate';
import { GetEffectiveTemplates } from '@/contexts/marketing/application/get-effective-templates/GetEffectiveTemplates';
import { GetMessageLog } from '@/contexts/marketing/application/get-message-log/GetMessageLog';
import { GetMessageLogQuery } from '@/contexts/marketing/application/get-message-log/GetMessageLogQuery';
import { SqliteMessageTemplateOverrideRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMessageTemplateOverrideRepository';
import { SqliteOutboxMessageLog } from '@/contexts/marketing/infrastructure/persistence/SqliteOutboxMessageLog';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { resolveEmailSender } from '@/shared/infrastructure/email-themes/resolveEmailSender';
import type { EmailSenderData } from '@/shared/infrastructure/email-themes/emailThemes';
import { MessageFilters } from './MessageFilters';
import { MessageList } from './MessageList';
import { TemplatesManager } from './TemplatesManager';
import { isDesktopEdition, locallyRecordedMessageChannels } from '@/shared/infrastructure/config/desktopEdition';
import { retryDesktopMail } from './retryDesktopMail';

export default async function MensajesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    canal?: string;
    tipo?: string;
    q?: string;
    pagina?: string;
  }>;
}) {
  const ownerUserId = await requireDataOwnerUserId();
  const { tab = 'registro', canal = '', tipo = '', q = '', pagina = '1' } = await searchParams;
  const showTemplates = tab === 'plantillas';

  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);
  const emailTheme = profile?.emailTheme || 'calido';
  const sender = (await resolveEmailSender(ownerUserId)).sender;
  const waBudget = await resolveWaBudget(ownerUserId);

  return (
    <div>
      <PageHeader
        title="Mensajes"
        subtitle={isDesktopEdition() ? 'Registro local de recordatorios, confirmaciones y campañas. Sin proveedor, estos registros no se entregan al destinatario.' : 'El registro de todo lo enviado (recordatorios, confirmaciones y campañas) y las plantillas y tema visual de tus correos. En modo local los mensajes se registran aquí sin enviarse.'}
      />

      {isDesktopEdition() ? <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 text-sm"><Link href="/configuracion/integraciones" className="text-accent-strong underline">Conectar mi clave de Resend para enviar correo</Link><form action={retryDesktopMail}><button className="rounded-lg border border-line px-3 py-2">Reintentar correos pendientes</button></form></div> : null}
      <WaBudgetBanner budget={waBudget} />

      <div className="mb-6 flex gap-1 border-b border-line">
        <TabLink href="/mensajes" label="Registro" active={!showTemplates} />
        <TabLink href="/mensajes?tab=plantillas" label="Plantillas" active={showTemplates} />
      </div>

      {showTemplates ? (
        <TemplatesTab ownerUserId={ownerUserId} emailTheme={emailTheme} sender={sender} />
      ) : (
        <LogTab ownerUserId={ownerUserId} canal={canal} tipo={tipo} q={q} pagina={pagina} />
      )}
    </div>
  );
}

/**
 * Contador del presupuesto de WhatsApp del plan (v3-spec §5): «WhatsApp este
 * mes: X de Y» + aviso al exceder. Los registros 'omitido' no cuentan.
 */
function WaBudgetBanner({ budget }: { budget: WaBudget }) {
  const { limit, used, exceeded } = budget;
  const percent = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="mb-6 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <MessageCircle size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {isDesktopEdition() ? `Registros de WhatsApp este mes: ${used}` : <>WhatsApp este mes: {used} de {limit ?? '∞'}{limit === null ? <span className="ml-1 font-normal text-ink-soft">(sin límite)</span> : null}</>}
          </p>
          {limit !== null ? (
            <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-bg">
              <div
                className={`h-full rounded-full ${exceeded ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          ) : null}
        </div>
      </div>
      {exceeded ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-xs text-ink">
            Alcanzaste el límite de WhatsApp de tu plan este mes. No te preocupes:{' '}
            <strong>los recordatorios siguen llegando por correo</strong> y los WhatsApp omitidos quedan
            registrados abajo. El contador se reinicia el primer día del próximo mes.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'border-primary text-primary dark:text-accent-2' : 'border-transparent text-ink-soft hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
}

async function TemplatesTab({
  ownerUserId,
  emailTheme,
  sender,
}: {
  ownerUserId: string;
  emailTheme: string;
  sender: EmailSenderData;
}) {
  const templates = await new GetEffectiveTemplates(new SqliteMessageTemplateOverrideRepository(ownerUserId)).get();
  return <TemplatesManager templates={templates} emailTheme={emailTheme} sender={sender} />;
}

async function LogTab({
  ownerUserId,
  canal,
  tipo,
  q,
  pagina,
}: {
  ownerUserId: string;
  canal: string;
  tipo: string;
  q: string;
  pagina: string;
}) {
  const query = GetMessageLogQuery.fromPrimitives({
    channel: canal,
    tipo,
    search: q,
    page: Number(pagina) || 1,
    pageSize: 25,
  });
  const result = await new GetMessageLog(new SqliteOutboxMessageLog(ownerUserId)).get(query);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const from = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.total, result.page * result.pageSize);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (canal) params.set('canal', canal);
    if (tipo) params.set('tipo', tipo);
    if (q) params.set('q', q);
    params.set('pagina', String(page));
    return `/mensajes?${params.toString()}`;
  };

  return (
    <>
      <MessageFilters current={{ canal, tipo, q }} />

      {result.entries.length === 0 ? (
        <EmptyState
          title="Sin mensajes"
          description={
            canal || tipo || q
              ? 'No encontramos mensajes para tu búsqueda.'
              : 'Cuando la app genere recordatorios, confirmaciones o correos de campañas aparecerán aquí.'
          }
        />
      ) : (
        <>
          <MessageList entries={result.entries} locallyRecordedChannels={await locallyRecordedMessageChannels(ownerUserId)} />
          <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
            <span>
              {from}-{to} de {result.total}
            </span>
            <div className="flex items-center gap-2">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-bg">
                  ‹ Anterior
                </Link>
              ) : null}
              <span>
                Página {result.page} de {totalPages}
              </span>
              {result.page < totalPages ? (
                <Link href={pageHref(result.page + 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-bg">
                  Siguiente ›
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
