import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileSignature, Printer, ShieldCheck } from 'lucide-react';
import { ListPatientReports } from '@/contexts/clinical-records/application/list-patient-reports/ListPatientReports';
import { GetExpedienteGaps } from '@/contexts/clinical-records/application/get-expediente-gaps/GetExpedienteGaps';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { PreSignChecklist } from './PreSignChecklist';
import { sessionInsightsProviderName } from '@/contexts/clinical-records/infrastructure/ai/createSessionInsights';
import { COUNTRY_GUIDELINES } from '@/contexts/clinical-records/domain/value-objects/countryGuidelines';
import {
  PATIENT_REPORT_KIND_LABELS,
  PATIENT_REPORT_STATUS_LABELS,
} from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import {
  listPatientAccessLog,
  RECORD_ACCESS_AREA_LABELS,
} from '@/shared/infrastructure/audit/recordAccessLog';
import { Badge, Button, Card } from '@/components/ui';
import { NewReportForm } from './NewReportForm';
import { ExpedienteReportButton } from './ExpedienteReportButton';
import { DeleteReportButton } from './DeleteReportButton';

const OPTIONS = [
  { name: 'datos', label: 'Datos del paciente', defaultChecked: true },
  { name: 'historia', label: 'Historia(s) clínica(s)', defaultChecked: true },
  { name: 'notas', label: 'Notas de sesión', defaultChecked: true },
  { name: 'diagnosticos', label: 'Diagnósticos (CIE-11)', defaultChecked: true },
  { name: 'archivos', label: 'Lista de archivos', defaultChecked: false },
];

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning'> = {
  borrador: 'neutral',
  revisado: 'warning',
  firmado: 'success',
};

export default async function ExportarPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;

  const reports = await new ListPatientReports(new SqlitePatientReportRepository(ownerUserId)).execute(id);
  const gaps = await new GetExpedienteGaps({
    patients: new SqlitePatientDirectory(ownerUserId),
    records: new SqliteClinicalRecordRepository(ownerUserId),
    notes: new SqliteSessionNoteRepository(ownerUserId),
    diagnoses: new SqliteDiagnosisRepository(ownerUserId),
    identity: new SqliteProfessionalIdentityReader(ownerUserId),
  }).execute(id);
  const provider = await sessionInsightsProviderName(ownerUserId);
  const countries = COUNTRY_GUIDELINES.map((country) => ({ code: country.code, name: country.name }));
  // Bitácora (v3 §1.2): últimos accesos al expediente de ESTE paciente.
  const accesses = await listPatientAccessLog(ownerUserId, id, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PreSignChecklist gaps={gaps} />

      <Card>
        <h2 className="mb-1 text-lg font-bold text-ink">Generar expediente</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Elige las secciones a incluir y genera una vista imprimible del expediente completo, con el
          encabezado de tus datos profesionales.
        </p>
        <form action={`/pacientes/${id}/exportar/vista`} method="get" className="space-y-3">
          {OPTIONS.map((option) => (
            <label key={option.name} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name={option.name}
                value="1"
                defaultChecked={option.defaultChecked}
                className="accent-[var(--color-primary)]"
              />
              {option.label}
            </label>
          ))}
          <div className="pt-2">
            <Button type="submit">
              <Printer size={15} /> Generar vista imprimible
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-bold text-ink">Historia clínica completa</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Ensambla el expediente consolidado —núcleo de la historia, bloques por enfoque, evolución de
          las sesiones integradas y diagnósticos— en un documento firmable. Se genera de forma
          automática (sin IA) y pasa por la misma revisión y firma que los demás reportes.
        </p>
        <ExpedienteReportButton patientId={id} />
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-bold text-ink">Reportes firmados</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Informes clínico-legales con borrador asistido por IA, revisión obligatoria y firma
          profesional. Solo un reporte firmado se imprime sin la marca de agua BORRADOR.
        </p>
        <NewReportForm patientId={id} countries={countries} provider={provider} />

        {reports.length > 0 ? (
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
              >
                <Link
                  href={`/pacientes/${id}/exportar/reportes/${report.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <FileSignature size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{report.title}</span>
                    <span className="block text-xs text-ink-soft">
                      {PATIENT_REPORT_KIND_LABELS[report.kind]} ·{' '}
                      {report.status === 'firmado' && report.signedAt
                        ? `Firmado el ${format(new Date(report.signedAt), "d 'de' MMMM 'de' yyyy", { locale: es })} por ${report.signedBy}`
                        : `Actualizado el ${format(new Date(report.updatedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}`}
                    </span>
                  </span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={STATUS_TONE[report.status] ?? 'neutral'}>
                    {PATIENT_REPORT_STATUS_LABELS[report.status]}
                  </Badge>
                  {report.status !== 'firmado' ? (
                    <DeleteReportButton reportId={report.id} patientId={id} reportTitle={report.title} />
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
          <ShieldCheck size={18} className="text-primary" /> Últimos accesos
        </h2>
        <p className="mb-4 text-sm text-ink-soft">
          Bitácora automática: cada vez que alguien (tú, tu equipo o un supervisor) abre un área del
          expediente queda registrado. Se muestra como máximo un evento por persona y área cada 10
          minutos.
        </p>
        {accesses.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay accesos registrados para este paciente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <th className="py-2 pr-4 font-semibold">Fecha</th>
                  <th className="py-2 pr-4 font-semibold">Quién</th>
                  <th className="py-2 font-semibold">Área</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {accesses.map((access) => (
                  <tr key={access.id}>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-ink-soft">
                      {format(new Date(access.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                    </td>
                    <td className="py-2.5 pr-4 text-ink">
                      {access.actorName || access.actorEmail || access.actorUserId}
                    </td>
                    <td className="py-2.5">
                      <Badge tone="primary">
                        {RECORD_ACCESS_AREA_LABELS[access.area] ?? access.area}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
