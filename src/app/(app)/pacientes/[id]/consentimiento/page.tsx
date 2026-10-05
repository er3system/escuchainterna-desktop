import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { GetLatestPatientConsent } from '@/contexts/clinical-records/application/get-patient-consent/GetLatestPatientConsent';
import { composeConsentSnapshot } from '@/contexts/clinical-records/application/issue-patient-consent/composeConsentSnapshot';
import { SqliteConsentTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentTemplateRepository';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import {
  CONSENT_STATUS_LABELS,
  isConsentGranted,
} from '@/contexts/clinical-records/domain/value-objects/consentStatus';
import { resolveConsentVariables } from '@/contexts/clinical-records/domain/value-objects/defaultConsentBody';
import { requireDataOwnerUserId } from '@/shared/infrastructure/auth/dataOwner';
import { Badge } from '@/components/ui';
import { PrintButton } from './PrintButton';

function formatDay(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Vista de detalle e impresión del consentimiento (v3 §2 pasos 3-4): copia
 * imprimible SIEMPRE disponible, con espacio de firma cuando aún no está
 * firmado y con la constancia de firma digital o el adjunto en papel cuando sí.
 */
export default async function ConsentimientoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ownerUserId = await requireDataOwnerUserId();
  const { id } = await params;
  const patient = await new SqlitePatientDirectory(ownerUserId).findSummary(id);
  if (!patient) notFound();

  const consent = await new GetLatestPatientConsent(new SqlitePatientConsentRepository(ownerUserId)).execute(id);

  // Sin consentimiento emitido: vista previa con la plantilla actual (para imprimir y firmar en papel).
  let title: string;
  let body: string;
  if (consent) {
    title = consent.templateTitle;
    body = consent.templateBody;
  } else {
    const snapshot = await composeConsentSnapshot(
      new SqliteConsentTemplateRepository(ownerUserId),
      new SqlitePatientDirectory(ownerUserId),
      new SqliteProfessionalIdentityReader(ownerUserId),
      id,
    );
    title = snapshot.title;
    body = snapshot.body;
  }

  const granted = consent ? isConsentGranted(consent.status) : false;
  const signDate = granted && consent?.signedAt ? formatDay(consent.signedAt) : null;
  const resolvedBody = resolveConsentVariables(body, { fecha: signDate ?? formatDay(new Date()) });

  const attachmentIsImage =
    consent?.filePath != null && /\.(webp|png|jpe?g|gif)$/i.test(consent.filePath);

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #consentimiento-imprimible, #consentimiento-imprimible * { visibility: visible; }
          #consentimiento-imprimible { position: absolute; left: 0; top: 0; width: 100%; padding: 0; border: none; box-shadow: none; }
          @page { margin: 18mm; }
        }
      `}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/pacientes/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          <ArrowLeft size={15} /> Volver al resumen
        </Link>
        <div className="flex items-center gap-2">
          {consent ? (
            <Badge tone={granted ? 'success' : consent.status === 'pendiente' ? 'warning' : 'neutral'}>
              {CONSENT_STATUS_LABELS[consent.status]}
            </Badge>
          ) : (
            <Badge tone="warning">Sin enviar</Badge>
          )}
          <PrintButton />
        </div>
      </div>

      <article
        id="consentimiento-imprimible"
        className="mx-auto max-w-3xl rounded-card border border-line bg-surface p-8 shadow-card"
      >
        <h1 className="text-center text-xl font-bold text-ink">{title}</h1>
        <p className="mt-1 text-center text-sm text-ink-soft">Paciente: {patient.fullName}</p>
        <div className="mx-auto mt-3 mb-6 h-0.5 w-16 rounded-full bg-primary" />

        <div className="whitespace-pre-wrap text-justify text-sm leading-relaxed text-ink">
          {resolvedBody}
        </div>

        <div className="mt-10 border-t border-line pt-6">
          {consent && consent.status === 'firmado' ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-ink">
                  Firmado digitalmente por {consent.signedName}
                </p>
                <p className="text-xs text-ink-soft">
                  {signDate ? `Fecha de firma: ${signDate}. ` : ''}
                  Aceptado desde la liga privada de firma de EscuchaInterna, con registro de fecha y
                  hora ({consent.signedAt ? new Date(consent.signedAt).toISOString() : '—'}).
                </p>
              </div>
            </div>
          ) : consent && consent.status === 'papel_adjunto' ? (
            <div>
              <p className="text-sm font-semibold text-ink">
                Consentimiento firmado en papel{signDate ? ` — adjuntado el ${signDate}` : ''}.
              </p>
              {consent.filePath ? (
                attachmentIsImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/pacientes/${id}/consentimiento`}
                    alt="Consentimiento firmado en papel"
                    className="mt-3 max-h-[480px] rounded-lg border border-line"
                  />
                ) : (
                  <a
                    href={`/api/pacientes/${id}/consentimiento`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-primary dark:text-accent-2 hover:underline print:hidden"
                  >
                    Ver documento adjunto (PDF)
                  </a>
                )
              ) : null}
            </div>
          ) : (
            <div className="grid gap-10 pt-8 sm:grid-cols-2">
              <div>
                <div className="border-t border-ink/60 pt-2" />
                <p className="text-xs text-ink-soft">Firma del paciente / consultante</p>
                <p className="mt-4 text-xs text-ink-soft">Nombre: ____________________________</p>
                <p className="mt-2 text-xs text-ink-soft">Documento: ________________________</p>
              </div>
              <div>
                <div className="border-t border-ink/60 pt-2" />
                <p className="text-xs text-ink-soft">Firma del profesional</p>
                <p className="mt-4 text-xs text-ink-soft">Fecha: ______________________________</p>
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
