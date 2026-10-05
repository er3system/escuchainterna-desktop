import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, History, Stethoscope } from 'lucide-react';
import type { ExpedienteInput } from '@/contexts/clinical-records/domain/expedienteContent';
import { SESSION_KIND_LABELS } from '@/contexts/clinical-records/domain/sessionTemplates';
import type { ClinicalAnswers, ClinicalAnswerValue } from '@/contexts/clinical-records/domain/ClinicalRecord';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';

function flat(value: ClinicalAnswerValue | undefined): string {
  if (value === undefined) return '';
  return (Array.isArray(value) ? value.join(', ') : value).trim();
}

function answeredRows(section: ClinicalSection, answers: ClinicalAnswers): { label: string; value: string }[] {
  return section.fields
    .map((field) => ({ label: field.label, value: flat(answers[field.id]) }))
    .filter((entry) => entry.value !== '');
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/** Renderiza las filas respondidas de una sección (label: valor). null si está vacía. */
function SectionRows({
  section,
  answers,
  heading = 'h4',
}: {
  section: ClinicalSection;
  answers: ClinicalAnswers;
  heading?: 'h3' | 'h4';
}) {
  const rows = answeredRows(section, answers);
  if (rows.length === 0) return null;
  const Heading = heading;
  return (
    <div className="mt-3 first:mt-0">
      <Heading className="text-sm font-bold text-ink">{section.title}</Heading>
      <dl className="mt-1 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="text-sm">
            <dt className="font-semibold text-ink-soft">{row.label}</dt>
            <dd className="whitespace-pre-wrap text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Vista VIVA (solo lectura) del Documento: la compilación organizada de TODO el
 * expediente — núcleo + bloques de la historia, cada sesión de la Evolución con
 * su formulario y sus bloques, y los diagnósticos. Se deriva en cada carga, así
 * que siempre refleja lo que hay en Evolución; el PDF firmable se genera aparte.
 */
export function DocumentoView({ input }: { input: ExpedienteInput }) {
  const historyHasContent =
    input.history !== null &&
    input.history.sections.some((section) => answeredRows(section, input.history!.answers).length > 0);

  return (
    <article className="space-y-5 rounded-card border border-line bg-surface p-6 shadow-card">
      <header className="border-b border-line pb-4">
        <h2 className="text-xl font-bold text-ink">Historia clínica — {input.patientName}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {input.professionalName || '[profesional]'}
          {input.professionalLicense ? ` · ${input.professionalLicense}` : ''}
        </p>
        <p className="text-xs text-ink-soft">
          {input.birthDate ? `Nacimiento: ${input.birthDate} · ` : ''}
          {input.gender ? `${input.gender} · ` : ''}
          Documento al {shortDate(input.generatedAt)}
        </p>
      </header>

      {/* Núcleo + bloques de la historia */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
          <FileText size={16} className="text-primary" /> Historia clínica (núcleo y bloques)
        </h3>
        {!historyHasContent ? (
          <p className="text-sm text-ink-soft">Sin contenido registrado en el núcleo de la historia.</p>
        ) : (
          <div className="space-y-3">
            {input.history!.sections.map((section) => (
              <SectionRows key={section.id} section={section} answers={input.history!.answers} heading="h4" />
            ))}
          </div>
        )}
      </section>

      {/* Evolución: todas las sesiones no archivadas */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
          <History size={16} className="text-primary" /> Evolución ({input.evolucion.length})
        </h3>
        {input.evolucion.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay sesiones registradas en la Evolución.</p>
        ) : (
          <div className="space-y-4">
            {input.evolucion.map((session, index) => {
              const free = session.content.replace(/\s+/g, ' ').trim();
              const sectionRows = session.sections.filter(
                (section) => answeredRows(section, session.answers).length > 0,
              );
              const empty = free === '' && sectionRows.length === 0;
              return (
                <div key={`${session.date}-${index}`} className="rounded-lg border border-line bg-bg/40 p-4">
                  <p className="text-sm font-semibold text-ink">
                    {shortDate(session.date)} · {session.title}{' '}
                    <span className="font-normal text-ink-soft">({SESSION_KIND_LABELS[session.kind]})</span>
                  </p>
                  {free ? <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink">{session.content}</p> : null}
                  {sectionRows.map((section) => (
                    <SectionRows key={section.id} section={section} answers={session.answers} heading="h4" />
                  ))}
                  {empty ? (
                    <p className="mt-1 text-sm italic text-ink-soft">Sesión sin contenido registrado.</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Diagnósticos */}
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
          <Stethoscope size={16} className="text-primary" /> Diagnósticos (CIE-11)
        </h3>
        {input.diagnoses.length === 0 ? (
          <p className="text-sm text-ink-soft">Sin diagnósticos registrados.</p>
        ) : (
          <ul className="space-y-1">
            {input.diagnoses.map((diagnosis) => (
              <li key={diagnosis.code} className="text-sm text-ink">
                <span className="font-mono font-semibold">{diagnosis.code}</span> — {diagnosis.title}{' '}
                <span className="text-ink-soft">({diagnosis.status})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
