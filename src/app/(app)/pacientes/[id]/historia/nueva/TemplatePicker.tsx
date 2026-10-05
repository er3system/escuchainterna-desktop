'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, FilePlus2, Loader2, Lock, Star, X } from 'lucide-react';
import type {
  ClinicalFieldType,
  ClinicalSection,
} from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalTemplatePrimitives } from '@/contexts/clinical-records/domain/ClinicalTemplate';
import { Badge, Button } from '@/components/ui';
import {
  setDefaultHistoriaTemplateAction,
  startNewEpisodeAction,
  startPrimaryHistoryAction,
  startRecordAction,
} from '../actions';

/** Acción de inicio según el modo del selector. */
type StartAction = (patientId: string, templateId: string | null) => Promise<void>;

const PASTELS = ['#F9D7DC', '#D5F0D9', '#CDE6F9', '#E3D7F5', '#FCF3C8', '#FBE3C0'];

const FIELD_TYPE_LABELS: Record<ClinicalFieldType, string> = {
  texto_corto: 'Texto corto',
  texto_largo: 'Texto largo',
  fecha: 'Fecha',
  numero: 'Número',
  seleccion: 'Selección',
  opcion_multiple: 'Opción múltiple',
  casillas: 'Casillas',
  escala: 'Escala',
};

/**
 * Secciones que REALMENTE entran en la historia. La sección "Notas adicionales"
 * la añade el catálogo a todas las plantillas, pero `EnsurePrimaryHistory` siempre
 * la descarta al crear la historia, así que no debe contar en el resumen del
 * selector (si no, "Historia libre" diría "2 secciones" teniendo un solo campo).
 */
function contentSections(sections: ClinicalSection[]): ClinicalSection[] {
  return sections.filter((section) => section.id !== 'notas-adicionales');
}

/** Cantidad de campos de una plantilla (para el resumen de la previsualización). */
function countFields(sections: ClinicalSection[]): number {
  return sections.reduce((total, section) => total + section.fields.length, 0);
}

/** Modal de previsualización: secciones y campos de la plantilla en solo lectura. */
function PreviewModal({
  template,
  patientId,
  startAction,
  onClose,
}: {
  template: ClinicalTemplatePrimitives;
  patientId: string;
  startAction: StartAction;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink">{template.name}</h3>
            {template.therapyType ? (
              <span className="text-xs font-medium text-primary">{template.therapyType}</span>
            ) : null}
            {template.description ? (
              <p className="mt-1 text-sm text-ink-soft">{template.description}</p>
            ) : null}
            <p className="mt-1 text-xs text-ink-soft">
              {contentSections(template.sections).length}{' '}
              {contentSections(template.sections).length === 1 ? 'sección' : 'secciones'} ·{' '}
              {countFields(contentSections(template.sections))} preguntas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-soft hover:bg-bg hover:text-ink"
            aria-label="Cerrar previsualización"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          {template.sections.map((section, index) => (
            <div
              key={section.id}
              className="rounded-lg border border-line bg-bg/40 p-4"
              style={{ borderLeft: `4px solid ${PASTELS[index % PASTELS.length]}` }}
            >
              <h4 className="text-sm font-bold text-ink">
                {index + 1}. {section.title}
              </h4>
              {section.description ? (
                <p className="mt-0.5 text-xs text-ink-soft">{section.description}</p>
              ) : null}
              <ul className="mt-2 space-y-1">
                {section.fields.map((field) => (
                  <li key={field.id} className="flex items-start justify-between gap-3 text-sm text-ink">
                    <span>
                      {field.label}
                      {field.required ? <span className="text-danger"> *</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-ink-soft">{FIELD_TYPE_LABELS[field.type]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-primary hover:text-primary"
          >
            Cerrar
          </button>
          <form action={startAction.bind(null, patientId, template.id)}>
            <Button type="submit">
              <FilePlus2 size={16} /> Usar esta plantilla
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function TemplatePicker({
  patientId,
  templates,
  defaultTemplateId,
  mode = 'registro',
}: {
  patientId: string;
  templates: ClinicalTemplatePrimitives[];
  defaultTemplateId: string | null;
  /**
   * 'primaria' inicia la historia clínica primaria (núcleo del modelo); 'episodio'
   * abre un nuevo episodio que coexiste (fuerza otra primaria); 'registro' abre un
   * registro aparte.
   */
  mode?: 'registro' | 'primaria' | 'episodio';
}) {
  const router = useRouter();
  const startAction: StartAction =
    mode === 'episodio'
      ? startNewEpisodeAction
      : mode === 'primaria'
        ? startPrimaryHistoryAction
        : startRecordAction;
  const isPrimaryLike = mode === 'primaria' || mode === 'episodio';
  const [defaultId, setDefaultId] = useState<string | null>(defaultTemplateId);
  const [preview, setPreview] = useState<ClinicalTemplatePrimitives | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // La plantilla por defecto se muestra primero; el resto conserva su orden.
  const ordered = useMemo(() => {
    if (!defaultId) return templates;
    const favorite = templates.filter((t) => t.id === defaultId);
    const rest = templates.filter((t) => t.id !== defaultId);
    return [...favorite, ...rest];
  }, [templates, defaultId]);

  function toggleDefault(templateId: string) {
    const next = defaultId === templateId ? null : templateId;
    setDefaultId(next);
    setPendingId(templateId);
    startTransition(async () => {
      const result = await setDefaultHistoriaTemplateAction(patientId, next);
      if (!result.ok) {
        // Revertir si el servidor rechazó la preferencia.
        setDefaultId(defaultTemplateId);
      }
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mode === 'registro' ? (
          <form action={startRecordAction.bind(null, patientId, null)}>
            <button
              type="submit"
              className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface p-6 text-center shadow-card transition-colors hover:border-primary hover:text-primary"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
                <FilePlus2 size={18} />
              </span>
              <span className="font-semibold text-ink">Historia en blanco</span>
              <span className="text-sm text-ink-soft">Formato libre, sin plantilla.</span>
            </button>
          </form>
        ) : null}

        {ordered.map((template, index) => {
          const isDefault = defaultId === template.id;
          return (
            <div
              key={template.id}
              className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex gap-1.5">
                {template.sections.slice(0, 5).map((section, sectionIndex) => (
                  <span
                    key={section.id}
                    className="h-2 flex-1 rounded-full"
                    style={{ backgroundColor: PASTELS[(index + sectionIndex) % PASTELS.length] }}
                  />
                ))}
              </div>
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="font-semibold text-ink">{template.name}</span>
                <button
                  type="button"
                  onClick={() => toggleDefault(template.id)}
                  disabled={pendingId === template.id}
                  title={isDefault ? 'Quitar como predeterminada' : 'Marcar como predeterminada'}
                  aria-pressed={isDefault}
                  className={`shrink-0 rounded-lg p-1 transition-colors disabled:opacity-50 ${
                    isDefault ? 'text-warning' : 'text-ink-soft hover:text-warning'
                  }`}
                >
                  {pendingId === template.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Star size={16} fill={isDefault ? 'currentColor' : 'none'} />
                  )}
                </button>
              </div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {template.therapyType ? (
                  <span className="text-xs font-medium text-primary">{template.therapyType}</span>
                ) : null}
                {isDefault ? <Badge tone="warning">Por defecto</Badge> : null}
                {template.isBuiltin ? (
                  <span className="text-ink-soft" title="Plantilla integrada">
                    <Lock size={13} />
                  </span>
                ) : (
                  <Badge tone="primary">Propia</Badge>
                )}
              </div>
              <span className="flex-1 text-sm text-ink-soft">{template.description}</span>
              <span className="mt-2 text-xs font-medium text-ink-soft">
                {contentSections(template.sections).length}{' '}
                {contentSections(template.sections).length === 1 ? 'sección' : 'secciones'}
              </span>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreview(template)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary"
                >
                  <Eye size={14} /> Previsualizar
                </button>
                <form action={startAction.bind(null, patientId, template.id)} className="flex-1">
                  <Button type="submit" size="sm" className="w-full">
                    {isPrimaryLike ? 'Iniciar con este modelo' : 'Usar plantilla'}
                  </Button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      {preview ? (
        <PreviewModal
          template={preview}
          patientId={patientId}
          startAction={startAction}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
