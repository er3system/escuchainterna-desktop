import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalAnswers } from '@/contexts/clinical-records/domain/ClinicalRecord';

/**
 * Vista de SOLO LECTURA de un expediente sellado (expediente anterior). No usa el
 * editor (SectionsEditor) a propósito: un expediente sellado no se edita, se
 * consulta. Renderiza núcleo + bloques con sus respuestas como documento.
 */
function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter((item) => `${item}`.trim() !== '').join(', ');
  if (typeof value === 'string') return value.trim();
  return '';
}

export function SealedRecordView({
  sections,
  answers,
}: {
  sections: ClinicalSection[];
  answers: ClinicalAnswers;
}) {
  if (sections.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-soft">
        Este expediente no tiene secciones registradas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const answered = section.fields.filter((field) => displayValue(answers[field.id]) !== '');
        return (
          <section key={section.id} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <div className="border-b border-line bg-bg/40 px-5 py-3">
              <h3 className="text-base font-bold text-ink">{section.title}</h3>
              {section.description ? (
                <p className="mt-0.5 text-sm text-ink-soft">{section.description}</p>
              ) : null}
            </div>
            <div className="divide-y divide-line">
              {answered.length === 0 ? (
                <p className="px-5 py-4 text-sm italic text-ink-soft">Sin contenido en esta sección.</p>
              ) : (
                answered.map((field) => (
                  <div key={field.id} className="px-5 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{field.label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{displayValue(answers[field.id])}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
