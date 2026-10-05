import { PageHeader } from '@/components/ui';
import { GetEffectiveTemplates } from '@/contexts/marketing/application/get-effective-templates/GetEffectiveTemplates';
import { SqliteMessageTemplateOverrideRepository } from '@/contexts/marketing/infrastructure/persistence/SqliteMessageTemplateOverrideRepository';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { resolveEmailSender } from '@/shared/infrastructure/email-themes/resolveEmailSender';
import { TemplatesManager } from '@/app/(app)/mensajes/TemplatesManager';
import { RecordatoriosForm } from './RecordatoriosForm';

/** Plantillas que se editan/previsualizan desde Recordatorios (mismas que /mensajes). */
const REMINDER_TEMPLATE_KEYS = ['recordatorio_sesion', 'recordatorio_pago'];

export default async function RecordatoriosPage() {
  const repository = new SqlitePractitionerProfileRepository();
  const userId = await requireClinicalConfigAccess();
  const profile = await repository.findByUserId(userId);

  if (!profile) {
    return (
      <div>
        <PageHeader title="Recordatorios" />
        <p className="text-sm text-ink-soft">No se encontró el perfil del profesional.</p>
      </div>
    );
  }

  const templates = await new GetEffectiveTemplates(new SqliteMessageTemplateOverrideRepository(userId)).get();
  const sender = (await resolveEmailSender(userId)).sender;

  return (
    <div>
      <PageHeader
        title="Recordatorios"
        subtitle="Configura los recordatorios automáticos de sesión y de pago. Los cambios aplican a reservaciones nuevas."
      />
      <RecordatoriosForm
        sessionReminderHours={profile.sessionReminderHours}
        cancellationMinHours={profile.cancellationMinHours}
        autoPaymentReminders={profile.autoPaymentReminders}
      />

      <div className="mt-10">
        <h2 className="text-lg font-bold text-ink">Texto de los recordatorios</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-ink-soft">
          Personaliza y previsualiza el texto de tus recordatorios. Es el mismo editor que la sección Plantillas de
          Mensajes: lo que guardes aquí se usará en ambos lugares.
        </p>
        <TemplatesManager
          templates={templates}
          emailTheme={profile.emailTheme}
          sender={sender}
          onlyKeys={REMINDER_TEMPLATE_KEYS}
        />
      </div>
    </div>
  );
}
