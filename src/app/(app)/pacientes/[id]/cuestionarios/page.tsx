import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';
import {
  ASSESSMENT_INSTRUMENTS,
  findInstrument,
  type SeverityTone,
} from '@/contexts/clinical-records/domain/assessmentInstruments';
import {
  SqlitePatientAssessmentRepository,
  type PatientAssessment,
} from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientAssessmentRepository';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { EmptyState } from '@/components/ui';
import { ApplyAssessment } from './ApplyAssessment';
import { DeleteAssessmentButton } from './DeleteAssessmentButton';

const TONE_BAR: Record<SeverityTone, string> = {
  success: 'bg-success',
  caution: 'bg-warning',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const TONE_BADGE: Record<SeverityTone, string> = {
  success: 'bg-success-soft text-success',
  caution: 'bg-warning-soft text-warning',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

function toneForSeverity(instrumentId: string, severity: string): SeverityTone {
  const instrument = findInstrument(instrumentId);
  return instrument?.severityBands.find((band) => band.label === severity)?.tone ?? 'success';
}

export default async function CuestionariosPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const all = await new SqlitePatientAssessmentRepository(ownerUserId).list(id);

  // Catálogo de pruebas/instrumentos de la Colección EscuchaInterna (contenido global,
  // sin owner_user_id): guías + imprimibles que el psicólogo puede descargar y usar.
  const instruments = (
    await new SqlitePublicationRepository().search({ category: 'Pruebas e instrumentos' })
  ).map((publication) => publication.toPrimitives());
  // Instrumentos APLICABLES (PHQ-9/GAD-7) que además tienen guía descargable: el id del
  // instrumento coincide con el de la publicación, así el formulario ofrece su imprimible.
  const guidePdfInstrumentIds = instruments.filter((p) => p.pdfPath).map((p) => p.id);

  // Agrupa por instrumento (solo los que tienen aplicaciones), respetando el orden
  // del catálogo. `all` ya viene de más reciente a más antiguo.
  const groups = ASSESSMENT_INSTRUMENTS.map((instrument) => ({
    instrument,
    applications: all.filter((application) => application.instrumentId === instrument.id),
  })).filter((group) => group.applications.length > 0);

  return (
    <div className="space-y-6">
      <ApplyAssessment patientId={id} guidePdfInstrumentIds={guidePdfInstrumentIds} />

      <section className="space-y-6">
        <h2 className="text-lg font-bold text-ink">Historial</h2>
        {groups.length === 0 ? (
          <EmptyState
            title="Aún no has aplicado cuestionarios"
            description="Aplica un PHQ-9 o GAD-7 arriba; cada aplicación queda con su puntaje para seguir la evolución."
          />
        ) : (
          groups.map(({ instrument, applications }) => {
            // Cronológico (viejo → nuevo) para leer la tendencia de izquierda a derecha.
            const chronological = [...applications].reverse();
            const latest = applications[0];
            const previous = applications[1];
            const first = chronological[0];
            const delta = previous ? latest.totalScore - previous.totalScore : null;
            // Progreso macro: cambio total desde la primera aplicación (todo el proceso).
            const overall = applications.length > 1 ? latest.totalScore - first.totalScore : null;
            const latestTone = toneForSeverity(instrument.id, latest.severity);

            return (
              <div key={instrument.id} className="rounded-card border border-line bg-surface shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
                  <div>
                    <h3 className="font-bold text-ink">
                      {instrument.name} <span className="font-medium text-ink-soft">· {instrument.measures}</span>
                    </h3>
                    <p className="text-xs text-ink-soft">
                      {applications.length} {applications.length === 1 ? 'aplicación' : 'aplicaciones'}
                    </p>
                    {overall !== null ? (
                      <p
                        className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${
                          overall < 0 ? 'text-success' : overall > 0 ? 'text-danger' : 'text-ink-soft'
                        }`}
                        title="Cambio total desde la primera aplicación"
                      >
                        {overall < 0 ? <ArrowDown size={12} /> : overall > 0 ? <ArrowUp size={12} /> : <ArrowRight size={12} />}
                        {overall > 0 ? `+${overall}` : overall} pts desde la 1ª aplicación
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {delta !== null ? (
                      <span
                        className={`inline-flex items-center gap-1 text-sm font-semibold ${
                          delta < 0 ? 'text-success' : delta > 0 ? 'text-danger' : 'text-ink-soft'
                        }`}
                        title="Cambio respecto de la aplicación anterior"
                      >
                        {delta < 0 ? <ArrowDown size={15} /> : delta > 0 ? <ArrowUp size={15} /> : <ArrowRight size={15} />}
                        {delta > 0 ? `+${delta}` : delta} pts
                      </span>
                    ) : null}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_BADGE[latestTone]}`}>
                      {latest.severity || '—'}
                    </span>
                  </div>
                </div>

                {/* Tendencia: barras por aplicación (viejo → nuevo). */}
                {chronological.length > 1 ? (
                  <div className="flex items-end gap-1.5 px-4 pt-4" style={{ height: '5rem' }}>
                    {chronological.map((application) => {
                      const tone = toneForSeverity(instrument.id, application.severity);
                      const pct = Math.max(6, Math.round((application.totalScore / instrument.maxScore) * 100));
                      return (
                        <div
                          key={application.id}
                          className="flex w-6 flex-col justify-end"
                          title={`${format(new Date(application.appliedAt), "d MMM yyyy", { locale: es })}: ${application.totalScore}/${instrument.maxScore}`}
                        >
                          <div className={`rounded-t ${TONE_BAR[tone]}`} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* Aplicaciones (nuevo → viejo). */}
                <ul className="divide-y divide-line">
                  {applications.map((application: PatientAssessment) => {
                    const tone = toneForSeverity(instrument.id, application.severity);
                    return (
                      <li key={application.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold text-ink">
                              {application.totalScore}
                              <span className="text-sm font-medium text-ink-soft">/{instrument.maxScore}</span>
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_BADGE[tone]}`}>
                              {application.severity || '—'}
                            </span>
                            {application.riskFlag ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
                                <AlertTriangle size={12} /> Riesgo
                              </span>
                            ) : null}
                          </div>
                          {application.notes ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{application.notes}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-ink-soft">
                            {format(new Date(application.appliedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                        <DeleteAssessmentButton patientId={id} assessmentId={application.id} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
