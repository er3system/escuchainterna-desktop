import type { Metadata } from 'next';
import { GetOrCreateConsentTemplate } from '@/contexts/clinical-records/application/get-consent-template/GetOrCreateConsentTemplate';
import { SqliteConsentTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentTemplateRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { PageHeader } from '@/components/ui';
import { ConsentTemplateForm } from './ConsentTemplateForm';

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
        subtitle="La plantilla que firman tus pacientes: edítala a tu práctica. Desde el expediente la envías con una liga de firma digital o adjuntas la copia firmada en papel."
      />
      <ConsentTemplateForm title={template.title} body={template.body} />
    </div>
  );
}
