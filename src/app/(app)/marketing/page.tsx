import Link from 'next/link';
import { History } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { GetAutomations } from '@/contexts/marketing/application/get-automations/GetAutomations';
import { GetEffectiveTemplates } from '@/contexts/marketing/application/get-effective-templates/GetEffectiveTemplates';
import { RunDueAutomations } from '@/contexts/marketing/application/run-due-automations/RunDueAutomations';
import { OutboxEmailDispatcher } from '@/contexts/marketing/infrastructure/outbox/OutboxEmailDispatcher';
import { SqliteAutomationDeliveryLog } from '@/contexts/marketing/infrastructure/persistence/SqliteAutomationDeliveryLog';
import { SqliteMarketingAutomationRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMarketingAutomationRepository';
import { SqliteMessageTemplateOverrideRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMessageTemplateOverrideRepository';
import { SqliteRecipientDirectory } from '@/contexts/marketing/infrastructure/persistence/SqliteRecipientDirectory';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { forbidAssistantRole, forbidProfessorRole } from '@/shared/infrastructure/auth/dataOwner';
import { resolveEmailSender } from '@/shared/infrastructure/email-themes/resolveEmailSender';
import type { EmailThemeId } from '@/shared/infrastructure/email-themes/emailThemes';
import { AutomationsPanel } from './AutomationsPanel';
import { RecipientsTable } from './RecipientsTable';
import { OptionalServiceNotice } from '@/components/desktop/OptionalServiceNotice';

export default async function MarketingPage() {
  await forbidProfessorRole();
  const ownerUserId = await forbidAssistantRole();

  // Automatizaciones vencidas: idempotente, corre en cada carga de /marketing.
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  try {
    await new RunDueAutomations(
      new SqliteMarketingAutomationRepository(ownerUserId),
      new SqliteRecipientDirectory(ownerUserId),
      new SqliteAutomationDeliveryLog(ownerUserId),
      new OutboxEmailDispatcher(ownerUserId),
      new SqliteMessageTemplateOverrideRepository(ownerUserId),
    ).run({
      senderName: profile?.fullName || 'Tu profesional',
      scheduleLink: `${baseUrl}/reservar/${profile?.publicSlug ?? ''}`,
    });
  } catch {
    // La carga de la página no debe romperse por una automatización.
  }

  const automations = await new GetAutomations(
    new SqliteMarketingAutomationRepository(ownerUserId),
  ).get();

  // El registro de envíos vive en Mensajes (un solo log): aquí solo enlazamos a las campañas.
  const segmentation = await new SqliteRecipientDirectory(ownerUserId).listForSegmentation();
  const marketingTemplates = (
    await new GetEffectiveTemplates(new SqliteMessageTemplateOverrideRepository(ownerUserId)).get()
  ).filter((template) => template.kind === 'marketing');
  const theme = (profile?.emailTheme || 'calido') as EmailThemeId;
  const sender = (await resolveEmailSender(ownerUserId)).sender;
  const senderName = profile?.fullName || 'Tu profesional';
  const scheduleLink = `${baseUrl}/reservar/${profile?.publicSlug ?? ''}`;

  return (
    <div>
      <PageHeader
        title="Marketing"
        subtitle="Crea campañas de correo a tus pacientes y deja andando automatizaciones de cumpleaños y reactivación."
        actions={
          <Link
            href="/mensajes?tipo=campanas"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-primary hover:text-primary"
          >
            <History size={15} /> Registro de envíos
          </Link>
        }
      />

      <div className="space-y-6">
        <OptionalServiceNotice ownerUserId={ownerUserId} feature="email" />
        <AutomationsPanel automations={automations} />
        <RecipientsTable
          allRecipients={segmentation}
          templates={marketingTemplates}
          theme={theme}
          sender={sender}
          senderName={senderName}
          scheduleLink={scheduleLink}
        />
      </div>
    </div>
  );
}
