import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, ClipboardList, FileSignature, FileText, Lock, MessageSquare, Wallet } from 'lucide-react';
import { ListSupervisionReviews } from '@/contexts/identity/application/list-supervision-reviews/ListSupervisionReviews';
import { SqliteSupervisionReviewRepository } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisionReviewRepository';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { PATIENT_REPORT_STATUS_LABELS } from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import { sessionInsightsProviderName } from '@/contexts/clinical-records/infrastructure/ai/createSessionInsights';
import { formatMoneyWithCode } from '@/shared/domain/currencies';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { Badge, Card, PageHeader } from '@/components/ui';
import { SupervisionBanner } from '../../../SupervisionBanner';
import {
  requireSupervisor,
  requireSupervisionLink,
  requireSupervisedPatient,
  listSupervisedNotes,
  listSupervisedRecords,
  listSupervisedPayments,
} from '../../../supervisionData';
import { CaseSummaryPanel } from './CaseSummaryPanel';
import { IssueCertificateButton } from './IssueCertificateButton';

function notePreview(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat === '') return 'Sin contenido.';
  return flat.length > 140 ? `${flat.slice(0, 140)}…` : flat;
}

function formatDate(value: string): string {
  return format(new Date(value), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

export default async function SupervisedPatientPage({
  params,
}: {
  params: Promise<{ userId: string; patientId: string }>;
}) {
  const { userId: supervisorId } = await requireSupervisor();
  const { userId, patientId } = await params;
  const link = await requireSupervisionLink(supervisorId, userId);
  const patient = await requireSupervisedPatient(userId, patientId);

  // Bitácora de acceso (v3 §1.2): la vista de supervisión también deja rastro.
  await logRecordAccess(supervisorId, patientId, 'supervision');

  const notes = link.scope.notas ? await listSupervisedNotes(userId, patientId) : [];
  const records = link.scope.historias ? await listSupervisedRecords(userId, patientId) : [];
  const payments = link.scope.pagos ? await listSupervisedPayments(userId, patientId) : null;

  // Retroalimentación del supervisor en sesión (v3.2): estado por nota.
  const reviewsByNote = await new ListSupervisionReviews(
    new SqliteSupervisionReviewRepository(),
  ).forNotes(
    notes.map((note) => note.id),
    supervisorId,
  );
  const reviewedCount = notes.filter((note) => reviewsByNote[note.id]?.reviewed).length;

  // Certificados que el DOCENTE ha emitido sobre este paciente (propiedad del docente).
  const certificates = (await new SqlitePatientReportRepository(supervisorId).listByPatient(patientId)).map(
    (report) => report.toPrimitives(),
  );

  return (
    <div>
      <SupervisionBanner detail={`Paciente de ${link.supervisedName}`} />
      <div className="mb-4">
        <Link
          href={`/supervision/${userId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a pacientes de {link.supervisedName}
        </Link>
      </div>
      <PageHeader
        title={patient.fullName}
        subtitle={[
          patient.gender || null,
          patient.birthDate
            ? `Nació el ${format(new Date(patient.birthDate), "d 'de' MMMM 'de' yyyy", { locale: es })}`
            : null,
          patient.therapyStartDate
            ? `En terapia desde ${format(new Date(patient.therapyStartDate), "MMMM 'de' yyyy", { locale: es })}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {patient.activeDiagnosis || patient.consultationReason ? (
        <Card className="mb-6">
          {patient.activeDiagnosis ? (
            <p className="mb-1 flex flex-wrap items-center gap-2 text-sm text-ink">
              <span className="font-semibold">Diagnóstico activo:</span>
              <Badge tone="primary">{patient.activeDiagnosis}</Badge>
            </p>
          ) : null}
          {patient.consultationReason ? (
            <p className="text-sm text-ink">
              <span className="font-semibold">Motivo de consulta:</span> {patient.consultationReason}
            </p>
          ) : null}
        </Card>
      ) : null}

      {/* Resumen del caso con IA (v3.2): material del supervisor, no se persiste. */}
      <CaseSummaryPanel
        supervisedUserId={userId}
        patientId={patientId}
        patientName={patient.fullName}
        provider={await sessionInsightsProviderName(supervisorId)}
      />

      <div className="space-y-8">
        {/* ---------------- Notas de sesión ---------------- */}
        <section>
          <h2 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
            <FileText size={18} className="text-primary dark:text-accent-2" /> Notas de sesión
            {link.scope.notas && notes.length > 0 ? (
              <Badge tone={reviewedCount === notes.length ? 'success' : 'neutral'}>
                {reviewedCount}/{notes.length} revisadas
              </Badge>
            ) : null}
          </h2>
          {!link.scope.notas ? (
            <Card>
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <Lock size={14} /> Tu alcance de supervisión no incluye las notas de sesión.
              </p>
            </Card>
          ) : notes.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-soft">Este paciente no tiene notas de sesión.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/supervision/${userId}/pacientes/${patientId}/notas/${note.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{note.title}</p>
                        <Badge tone={reviewsByNote[note.id]?.reviewed ? 'success' : 'neutral'}>
                          {reviewsByNote[note.id]?.reviewed ? 'Revisada ✓' : 'Sin revisar'}
                        </Badge>
                        {reviewsByNote[note.id]?.comment ? (
                          <Badge tone="primary">
                            <MessageSquare size={11} /> Con retroalimentación
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-ink-soft">{formatDate(note.updatedAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{notePreview(note.content)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---------------- Historias clínicas ---------------- */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
            <ClipboardList size={18} className="text-primary dark:text-accent-2" /> Historias clínicas
          </h2>
          {!link.scope.historias ? (
            <Card>
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <Lock size={14} /> Tu alcance de supervisión no incluye las historias clínicas.
              </p>
            </Card>
          ) : records.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-soft">Este paciente no tiene historias clínicas.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <Link
                  key={record.id}
                  href={`/supervision/${userId}/pacientes/${patientId}/historias/${record.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{record.title}</p>
                      <p className="text-xs text-ink-soft">
                        Plantilla: {record.templateName} · {formatDate(record.updatedAt)}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---------------- Certificados emitidos por el docente ---------------- */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <FileSignature size={18} className="text-primary dark:text-accent-2" /> Certificados emitidos por ti
            </h2>
            <IssueCertificateButton supervisedUserId={userId} patientId={patientId} />
          </div>
          <p className="mb-3 text-xs text-ink-soft">
            Documentos que firmas con TU tarjeta sobre este paciente (no a nombre de {link.supervisedName}).
            Distinto de la co-firma, donde firmas un reporte que redactó {link.supervisedName}.
          </p>
          {certificates.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-soft">Aún no has emitido certificados de este paciente.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {certificates.map((certificate) => (
                <Link
                  key={certificate.id}
                  href={`/supervision/${userId}/pacientes/${patientId}/certificados/${certificate.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{certificate.title}</p>
                      <Badge tone={certificate.status === 'firmado' ? 'success' : 'neutral'}>
                        {PATIENT_REPORT_STATUS_LABELS[certificate.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      Actualizado el {formatDate(certificate.updatedAt)}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---------------- Pagos (solo con scope.pagos) ---------------- */}
        {payments ? (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
              <Wallet size={18} className="text-primary dark:text-accent-2" /> Pagos
            </h2>
            <Card>
              <div className="mb-3 flex flex-wrap gap-4 text-sm">
                <p className="text-ink">
                  <span className="font-semibold">Pagado:</span>{' '}
                  {formatMoneyWithCode(payments.paidTotal, payments.currency)}
                </p>
                <p className="text-ink">
                  <span className="font-semibold">Por cobrar:</span>{' '}
                  {formatMoneyWithCode(payments.pendingTotal, payments.currency)}
                </p>
              </div>
              {payments.payments.length === 0 ? (
                <p className="text-sm text-ink-soft">Este paciente no tiene sesiones registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                        <th className="py-2 pr-4 font-semibold">Sesión</th>
                        <th className="py-2 pr-4 font-semibold">Monto</th>
                        <th className="py-2 pr-4 font-semibold">Estado</th>
                        <th className="py-2 font-semibold">Método</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {payments.payments.map((payment) => {
                        const amount = payment.price > 0 ? payment.price : payment.feeCharged;
                        return (
                          <tr key={payment.bookingId}>
                            <td className="py-2.5 pr-4 text-ink">
                              {format(new Date(payment.startAt), "d MMM yyyy, HH:mm", { locale: es })}
                              {payment.feeReason ? (
                                <span className="ml-2">
                                  <Badge tone="warning">
                                    {payment.feeReason === 'inasistencia'
                                      ? 'Tarifa por inasistencia'
                                      : 'Tarifa por cancelación tardía'}
                                  </Badge>
                                </span>
                              ) : null}
                            </td>
                            <td className="py-2.5 pr-4 text-ink">
                              {formatMoneyWithCode(amount, payments.currency)}
                            </td>
                            <td className="py-2.5 pr-4">
                              <Badge tone={payment.paymentStatus === 'pagada' ? 'success' : 'warning'}>
                                {payment.paymentStatus === 'pagada' ? 'Pagada' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-ink-soft">{payment.paymentMethod ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-ink-soft">
                Información de solo lectura: aquí no se registran ni modifican pagos.
              </p>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
