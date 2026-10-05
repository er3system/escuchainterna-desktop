import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { SqliteConsentInboxRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentInboxRepository';
import { ConsentReceptionId } from '@/contexts/clinical-records/domain/value-objects/ConsentReceptionId';
import { PageHeader, Card } from '@/components/ui';

export const metadata = { title: 'Documento recibido · EscuchaInterna' };

export default async function ReceivedConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await requireClinicalConfigAccess();
  if (!isDesktopEdition()) redirect('/configuracion/consentimiento');
  const { id } = await params;
  let identity: ConsentReceptionId;
  try { identity = new ConsentReceptionId(id); } catch { notFound(); }
  const receipt = await new SqliteConsentInboxRepository(owner).find(identity);
  if (!receipt) notFound();
  const document = receipt.toPrimitives().document;
  const source = `/api/consentimientos/${id}`;
  return <div>
    <Link href="/consentimientos" className="mb-4 inline-flex items-center gap-2 text-sm text-primary underline"><ArrowLeft size={16} /> Volver a la bandeja</Link>
    <PageHeader title="Documento recibido" subtitle="Comprueba el contenido y la firma antes de archivarlo en el expediente." />
    <Card>
      <p className="mb-3 break-all text-xs text-ink-soft">{document.filename}</p>
      {document.mime === 'application/pdf'
        ? <iframe title="Consentimiento recibido" src={source} className="h-[75vh] min-h-[500px] w-full rounded-xl border border-line" />
        // Documento clínico autenticado; se conserva su formato y tamaño original.
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={source} alt="Documento de consentimiento recibido" className="mx-auto max-h-[75vh] max-w-full object-contain" />}
    </Card>
  </div>;
}
