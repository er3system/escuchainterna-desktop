import { redirect } from 'next/navigation';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { SqliteConsentInboxRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentInboxRepository';
import { ConsentReceptionSettings } from '@/contexts/clinical-records/infrastructure/consent-reception/ConsentReceptionSettings';
import { PageHeader } from '@/components/ui';
import { ConsentInboxPanel } from '@/components/consent-reception/ConsentInboxPanel';
export const metadata = { title: 'Consentimientos recibidos · EscuchaInterna' };
export default async function ConsentInboxPage() {
  const owner = await requireClinicalConfigAccess(); if (!isDesktopEdition()) redirect('/configuracion/consentimiento');
  const [receipts, settings, patients] = await Promise.all([new SqliteConsentInboxRepository(owner).list(), new ConsentReceptionSettings(owner).read(), getDatabaseAdapter().query<{ id: string; full_name: string }>('SELECT id, full_name FROM patients WHERE owner_user_id=? AND archived=0 ORDER BY created_at DESC', [owner])]);
  return <div><PageHeader title="Consentimientos recibidos" subtitle="Los documentos llegan a esta bandeja. Revisa la firma y el paciente antes de archivarlos." /><ConsentInboxPanel owner={owner} receipts={receipts} settings={settings} patients={patients.map(patient => ({ id: patient.id, name: decryptField(patient.full_name) })).sort((a,b) => a.name.localeCompare(b.name, 'es'))} /></div>;
}
