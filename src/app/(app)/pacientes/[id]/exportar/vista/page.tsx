import Link from 'next/link';
import { notFound } from 'next/navigation';
import { differenceInYears, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import { BuildRecordExport } from '@/contexts/clinical-records/application/build-record-export/BuildRecordExport';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqlitePatientFileRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { PrintButton } from './PrintButton';

const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo',
  descartado: 'Descartado',
  remitido: 'Remitido',
};

function formatDay(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Título de cada registro DENTRO de la sección "Historia clínica". La historia
 * primaria nace con el título "Historia clínica · <enfoque>", lo que repetía la
 * palabra bajo el encabezado de sección. Aquí se muestra solo el enfoque (o un
 * rótulo neutro si no lo hay); los registros sueltos conservan su título.
 */
function recordTitle(record: { title: string; kind: string }): string {
  if (record.kind !== 'historia') return record.title;
  const enfoque = record.title.replace(/^historia cl[ií]nica\s*(·\s*)?/i, '').trim();
  return enfoque || 'Historia consolidada';
}

/** Subtítulo (naturaleza del registro) sin repetir "Historia clínica". */
function recordKindLabel(record: { kind: string; closed: boolean; templateName: string }): string {
  if (record.kind === 'historia') {
    return record.closed ? 'Expediente anterior · sellado' : 'Historia consolidada';
  }
  return `Plantilla: ${record.templateName}`;
}

export default async function VistaImprimiblePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const query = await searchParams;
  const wants = (key: string) => query[key] === '1';

  const exportData = await new BuildRecordExport(
    new SqlitePatientDirectory(ownerUserId),
    new SqliteClinicalRecordRepository(ownerUserId),
    new SqliteClinicalTemplateRepository(ownerUserId),
    new SqliteSessionNoteRepository(ownerUserId),
    new SqliteDiagnosisRepository(ownerUserId),
    new SqlitePatientFileRepository(ownerUserId),
  ).execute(id, {
    includePatientData: wants('datos'),
    includeRecords: wants('historia'),
    includeNotes: wants('notas'),
    includeDiagnoses: wants('diagnosticos'),
    includeFiles: wants('archivos'),
  });
  if (!exportData) notFound();

  const professional = await new SqliteProfessionalIdentityReader(ownerUserId).read();

  const { patient } = exportData;
  const age = patient.birthDate ? differenceInYears(new Date(), new Date(patient.birthDate)) : null;

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #expediente-imprimible, #expediente-imprimible * { visibility: visible; }
          #expediente-imprimible { position: absolute; left: 0; top: 0; width: 100%; padding: 0; border: none; box-shadow: none; }
          @page { margin: 18mm; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/pacientes/${id}/exportar`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Cambiar secciones
        </Link>
        <PrintButton />
      </div>

      <div
        id="expediente-imprimible"
        className="mx-auto max-w-3xl rounded-card border border-line bg-surface p-8 shadow-card"
      >
        {/* Encabezado con datos del profesional (spec v2 §6.8) */}
        <header className="mb-6 border-b-2 border-ink pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                EscuchaInterna · Expediente clínico
              </p>
              {professional ? (
                <div className="mt-2 text-sm">
                  <p className="font-bold text-ink">{professional.fullName || '—'}</p>
                  {professional.professionalLicense ? (
                    <p className="text-ink-soft">
                      Cédula / tarjeta profesional: {professional.professionalLicense}
                    </p>
                  ) : null}
                  <p className="text-ink-soft">
                    {[professional.contactPhone, professional.email].filter(Boolean).join(' · ')}
                  </p>
                  {professional.contactAddress ? (
                    <p className="text-ink-soft">{professional.contactAddress}</p>
                  ) : null}
                  {professional.organizationName ? (
                    <p className="text-ink-soft">{professional.organizationName}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {professional?.organizationLogoDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={professional.organizationLogoDataUri}
                alt={professional.organizationName ?? 'Logo de la organización'}
                className="h-14 w-auto shrink-0 object-contain"
              />
            ) : null}
          </div>
          <h1 className="mt-3 text-2xl font-bold text-ink">{patient.fullName}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Generado el {format(new Date(exportData.generatedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        </header>

        {exportData.patientData ? (
          <section className="mb-6">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-bold text-ink">Datos del paciente</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="font-semibold text-ink">Email</dt>
                <dd className="text-ink-soft">{patient.email || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Celular</dt>
                <dd className="text-ink-soft">{patient.phone || '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Fecha de nacimiento</dt>
                <dd className="text-ink-soft">
                  {formatDay(patient.birthDate)}
                  {age !== null ? ` (${age} años)` : ''}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Inicio de terapia</dt>
                <dd className="text-ink-soft">{formatDay(patient.therapyStartDate)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Contacto de emergencia</dt>
                <dd className="text-ink-soft">
                  {patient.emergencyContactName || '—'}
                  {patient.emergencyContactPhone ? ` · ${patient.emergencyContactPhone}` : ''}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Etiquetas</dt>
                <dd className="text-ink-soft">{patient.tags.join(', ') || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-semibold text-ink">Motivo de consulta</dt>
                <dd className="whitespace-pre-wrap text-ink-soft">{patient.consultationReason || '—'}</dd>
              </div>
            </dl>
          </section>
        ) : null}

        {exportData.records.length > 0 ? (
          <section className="mb-6">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-bold text-ink">Historia clínica</h2>
            {exportData.records.map((record, recordIndex) => (
              <div key={recordIndex} className="mb-4 border-l-2 border-line pl-3">
                <h3 className="text-sm font-bold text-ink">{recordTitle(record)}</h3>
                <p className="mb-2 text-xs text-ink-soft">
                  {recordKindLabel(record)} · Actualizada el{' '}
                  {format(new Date(record.updatedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                {record.sections.length === 0 ? (
                  <p className="text-sm text-ink-soft">Sin respuestas registradas.</p>
                ) : (
                  record.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="mb-3">
                      <h4 className="text-sm font-semibold text-ink">{section.title}</h4>
                      <dl className="mt-1 space-y-1.5">
                        {section.questions.map((question, questionIndex) => (
                          <div key={questionIndex} className="text-sm">
                            <dt className="font-medium text-ink">{question.label}</dt>
                            <dd className="whitespace-pre-wrap text-ink-soft">{question.answer}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))
                )}
              </div>
            ))}
          </section>
        ) : null}

        {exportData.notes.length > 0 ? (
          <section className="mb-6">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-bold text-ink">Notas de sesión</h2>
            {exportData.notes.map((note, index) => (
              <div key={index} className="mb-3">
                <h3 className="text-sm font-semibold text-ink">
                  {note.title}
                  <span className="ml-2 font-normal text-ink-soft">
                    {format(new Date(note.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>
                </h3>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-soft">
                  {note.content || 'Sin contenido.'}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        {exportData.diagnoses.length > 0 ? (
          <section className="mb-6">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-bold text-ink">Diagnósticos (CIE-11)</h2>
            <ul className="space-y-2">
              {exportData.diagnoses.map((diagnosis) => (
                <li key={diagnosis.id} className="text-sm">
                  <span className="font-mono font-semibold text-ink">{diagnosis.cie11Code}</span>{' '}
                  <span className="font-medium text-ink">{diagnosis.cie11Title}</span>{' '}
                  <span className="text-ink-soft">
                    · {STATUS_LABEL[diagnosis.status] ?? diagnosis.status} ·{' '}
                    {format(new Date(diagnosis.diagnosedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </span>
                  {diagnosis.notes ? (
                    <p className="whitespace-pre-wrap text-ink-soft">{diagnosis.notes}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {exportData.files.length > 0 ? (
          <section className="mb-2">
            <h2 className="mb-2 border-b border-line pb-1 text-base font-bold text-ink">Archivos adjuntos</h2>
            <ul className="space-y-1 text-sm">
              {exportData.files.map((file, index) => (
                <li key={index} className="text-ink-soft">
                  <span className="font-medium text-ink">{file.filename}</span> · {formatSize(file.size)} ·{' '}
                  {format(new Date(file.uploadedAt), "d MMM yyyy", { locale: es })}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
