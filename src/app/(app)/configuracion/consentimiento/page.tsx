import type { Metadata } from 'next';
import { GetOrCreateConsentTemplate } from '@/contexts/clinical-records/application/get-consent-template/GetOrCreateConsentTemplate';
import { SqliteConsentTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentTemplateRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { PageHeader } from '@/components/ui';
import { ConsentTemplateForm } from './ConsentTemplateForm';
import Link from 'next/link';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export const metadata: Metadata = {
  title: 'Consentimiento informado · EscuchaInterna',
};

export default async function ConsentimientoConfigPage() {
  const ownerUserId = await requireClinicalConfigAccess();
  const template = await new GetOrCreateConsentTemplate(
    new SqliteConsentTemplateRepository(ownerUserId),
  ).execute();

  return (
    <div>
      <PageHeader
        title="Consentimiento informado"
        subtitle={isDesktopEdition() ? 'Edita la plantilla de impresión. Puedes adjuntar la copia firmada o recibir documentos desde una carpeta de Drive.' : 'Edita la plantilla que firman tus pacientes. Desde el expediente puedes enviar la liga de firma o adjuntar la copia firmada.'}
      />
      <ConsentTemplateForm title={template.title} body={template.body} />
      {isDesktopEdition() ? <Link href="/consentimientos" className="mt-5 inline-block text-primary underline">Configurar recepción automática y abrir bandeja →</Link> : null}
    </div>
  );
}
