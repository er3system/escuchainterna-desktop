import Link from 'next/link';
import { ArrowLeft, FileSignature, User } from 'lucide-react';
import { PATIENT_REPORT_KIND_LABELS } from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import { renderClinicalMarkdownToHtml } from '@/contexts/clinical-records/domain/clinicalMarkdown';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { requireSupervisor, requireSignatureRequestForReview } from '../../supervisionData';
import { SignRequestActions } from './SignRequestActions';

export default async function RevisarFirmaPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { userId } = await requireSupervisor();
  const { requestId } = await params;
  // Gate (pendiente + dirigida a mí + vínculo vigente) y carga del reporte cross-owner.
  const review = await requireSignatureRequestForReview(userId, requestId);
  const identity = await new SqliteProfessionalIdentityReader(userId).read();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link
          href="/supervision"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a Supervisión
        </Link>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/30 dark:bg-primary/15 px-4 py-3 text-sm text-ink">
        <FileSignature size={18} className="mt-0.5 shrink-0 text-primary dark:text-accent-2" />
        <div>
          <p className="font-semibold">Solicitud de co-firma</p>
          <p className="mt-0.5 text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <User size={13} /> {review.requesterName}
            </span>{' '}
            te pidió firmar este reporte del paciente <strong>{review.patientName}</strong>. Al firmar,
            tomas la responsabilidad clínico-legal del documento (queda a tu nombre).
          </p>
          {review.note ? (
            <p className="mt-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs text-ink">
              Nota del practicante: {review.note}
            </p>
          ) : null}
        </div>
      </div>

      <SignRequestActions
        requestId={review.requestId}
        signerName={identity?.fullName ?? ''}
        signerLicense={identity?.professionalLicense ?? ''}
      />

      {/* Reporte a firmar (solo lectura) */}
      <div className="mt-4 rounded-card border border-line bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          {PATIENT_REPORT_KIND_LABELS[review.report.kind]}
        </p>
        <h1 className="mt-1 text-xl font-bold text-ink">{review.report.title}</h1>
        <p className="mt-0.5 text-sm text-ink-soft">Paciente: {review.patientName}</p>
        <div
          className="report-prose mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink"
          dangerouslySetInnerHTML={{ __html: renderClinicalMarkdownToHtml(review.report.content) }}
        />
      </div>
    </div>
  );
}
