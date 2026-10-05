import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, BadgeCheck, FlaskConical } from 'lucide-react';
import { ListDiagnoses } from '@/contexts/clinical-records/application/list-diagnoses/ListDiagnoses';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqliteCie11Catalog } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCie11Catalog';
import type { DiagnosisKind, DiagnosisStatus } from '@/contexts/clinical-records/domain/Diagnosis';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { Badge, Card, EmptyState } from '@/components/ui';
import { Cie11Browser } from './Cie11Browser';
import { DiagnosisFormalityToggle } from './DiagnosisFormalityToggle';
import { updateDiagnosisStatusAction } from './actions';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

const STATUS_LABEL: Record<DiagnosisStatus, string> = {
  activo: 'Activo',
  descartado: 'Descartado',
  remitido: 'Remitido',
};

const STATUS_TONE: Record<DiagnosisStatus, 'success' | 'neutral' | 'warning'> = {
  activo: 'success',
  descartado: 'neutral',
  remitido: 'warning',
};

const KIND_LABEL: Record<DiagnosisKind, string> = {
  hipotesis: 'Hipótesis diagnóstica',
  formal: 'Diagnóstico formal',
};

export default async function DiagnosticoPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const diagnoses = await new ListDiagnoses(new SqliteDiagnosisRepository(ownerUserId)).execute(id);
  const datasetLoaded = (await new SqliteCie11Catalog().totalEntries()) > 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Diagnósticos del paciente</h2>
        {diagnoses.length === 0 ? (
          <EmptyState
            title="Sin diagnósticos registrados"
            description={datasetLoaded ? 'Busca en el catálogo CIE-11 de abajo y asigna el primer diagnóstico.' : 'Puedes documentar tu impresión diagnóstica en la historia clínica. La asignación de un código requiere instalar el catálogo CIE-11.'}
          />
        ) : (
          <div className="space-y-3">
            {diagnoses.map((diagnosis) => (
              <Card key={diagnosis.id} className={diagnosis.status === 'descartado' ? 'opacity-75' : ''}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        diagnosis.kind === 'formal' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                      }`}
                    >
                      {diagnosis.kind === 'formal' ? <BadgeCheck size={18} /> : <FlaskConical size={18} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-bg px-2.5 py-0.5 font-mono text-xs font-semibold text-ink-soft">
                          {diagnosis.cie11Code}
                        </span>
                        <p className="font-semibold text-ink">{diagnosis.cie11Title}</p>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {diagnosis.kind === 'formal' ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
                            title="Diagnóstico formal: afirmación clínico-legal confirmada por un profesional con tarjeta."
                          >
                            <BadgeCheck size={12} /> {KIND_LABEL.formal}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning"
                            title="Hipótesis diagnóstica de trabajo: aún no es un diagnóstico formal."
                          >
                            <FlaskConical size={12} /> {KIND_LABEL.hipotesis}
                          </span>
                        )}
                        <Badge tone={STATUS_TONE[diagnosis.status]}>{STATUS_LABEL[diagnosis.status]}</Badge>
                      </div>
                      {diagnosis.notes ? (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-soft">{diagnosis.notes}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-soft">
                        Registrado el{' '}
                        {format(new Date(diagnosis.diagnosedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex gap-1.5">
                      {(['activo', 'descartado', 'remitido'] as DiagnosisStatus[])
                        .filter((status) => status !== diagnosis.status)
                        .map((status) => (
                          <form key={status} action={updateDiagnosisStatusAction.bind(null, diagnosis.id, id, status)}>
                            <button
                              type="submit"
                              className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-primary hover:text-primary"
                            >
                              Marcar {STATUS_LABEL[status].toLowerCase()}
                            </button>
                          </form>
                        ))}
                    </div>
                    <DiagnosisFormalityToggle diagnosisId={diagnosis.id} patientId={id} kind={diagnosis.kind} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">Catálogo CIE-11</h2>
        {datasetLoaded ? (
          <Cie11Browser patientId={id} />
        ) : (
          <div className="flex items-start gap-3 rounded-card border border-warning bg-warning-soft p-4 text-sm text-ink">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold">{isDesktopEdition() ? 'El catálogo CIE-11 no está incluido en esta edición' : 'Dataset CIE-11 no cargado'}</p>
              <p className="mt-0.5 text-ink-soft">
                {isDesktopEdition() ? 'Los catálogos se distribuyen por separado conforme a sus licencias. Puedes registrar tu impresión diagnóstica en la historia clínica; el buscador de códigos estará disponible cuando se instale un catálogo autorizado.' : <>Coloca el dataset en <code className="font-mono">data/cie11/cie11.json</code> y reinicia la aplicación para habilitar el buscador de diagnósticos.</>}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
