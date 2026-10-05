'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import type {
  ClinicalFieldType,
  ClinicalSection,
} from '@/shared/infrastructure/persistence/builtinTemplates';
import type { TemplateActionInput, TemplateActionResult } from './actions';
import { Input, Textarea, Select } from '@/components/ui';

const FIELD_TYPE_LABELS: Record<ClinicalFieldType, string> = {
  texto_corto: 'Texto corto',
  texto_largo: 'Texto largo',
  fecha: 'Fecha',
  numero: 'Número',
  seleccion: 'Selección (desplegable)',
  opcion_multiple: 'Opción múltiple',
  casillas: 'Casillas',
  escala: 'Escala',
};

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as ClinicalFieldType[];

interface FieldDraft {
  key: string;
  id: string;
  label: string;
  type: ClinicalFieldType;
  required: boolean;
  optionsText: string;
  scaleMin: string;
  scaleMax: string;
  scaleMinLabel: string;
  scaleMaxLabel: string;
}

interface SectionDraft {
  key: string;
  id: string;
  title: string;
  description: string;
  fields: FieldDraft[];
}

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyField(): FieldDraft {
  return {
    key: newKey(),
    id: `campo-${newKey()}`,
    label: '',
    type: 'texto_largo',
    required: false,
    optionsText: '',
    scaleMin: '1',
    scaleMax: '10',
    scaleMinLabel: '',
    scaleMaxLabel: '',
  };
}

function emptySection(): SectionDraft {
  return { key: newKey(), id: `seccion-${newKey()}`, title: '', description: '', fields: [emptyField()] };
}

/** Sección «Notas adicionales» que toda plantilla nueva incluye por defecto (spec v2 §6.9). */
function additionalNotesSectionDraft(): SectionDraft {
  return {
    key: newKey(),
    id: 'notas-adicionales',
    title: 'Notas adicionales',
    description: 'Espacio libre para información que no corresponde a las secciones anteriores.',
    fields: [
      {
        key: newKey(),
        id: 'otros-notas',
        label: 'Otros / Notas adicionales',
        type: 'texto_largo',
        required: false,
        optionsText: '',
        scaleMin: '1',
        scaleMax: '10',
        scaleMinLabel: '',
        scaleMaxLabel: '',
      },
    ],
  };
}

function sectionsToDrafts(sections: ClinicalSection[]): SectionDraft[] {
  return sections.map((section) => ({
    key: newKey(),
    id: section.id,
    title: section.title,
    description: section.description ?? '',
    fields: section.fields.map((field) => ({
      key: newKey(),
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required === true,
      optionsText: (field.options ?? []).join('\n'),
      scaleMin: String(field.scaleMin ?? 1),
      scaleMax: String(field.scaleMax ?? 10),
      scaleMinLabel: field.scaleMinLabel ?? '',
      scaleMaxLabel: field.scaleMaxLabel ?? '',
    })),
  }));
}

function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function TemplateEditor({
  initial,
  action,
}: {
  initial?: { name: string; therapyType: string; description: string; sections: ClinicalSection[] };
  action: (input: TemplateActionInput) => Promise<TemplateActionResult>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [therapyType, setTherapyType] = useState(initial?.therapyType ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sections, setSections] = useState<SectionDraft[]>(
    initial ? sectionsToDrafts(initial.sections) : [emptySection(), additionalNotesSectionDraft()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSection(sectionKey: string, patch: Partial<SectionDraft>) {
    setSections((previous) =>
      previous.map((section) => (section.key === sectionKey ? { ...section, ...patch } : section)),
    );
  }

  function updateField(sectionKey: string, fieldKey: string, patch: Partial<FieldDraft>) {
    setSections((previous) =>
      previous.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.key === fieldKey ? { ...field, ...patch } : field,
              ),
            }
          : section,
      ),
    );
  }

  function submit() {
    setError(null);
    const payload: TemplateActionInput = {
      name,
      therapyType,
      description,
      sections: sections.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
        fields: section.fields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
          options:
            field.type === 'seleccion' || field.type === 'opcion_multiple' || field.type === 'casillas'
              ? field.optionsText
                  .split('\n')
                  .map((option) => option.trim())
                  .filter((option) => option !== '')
              : undefined,
          scaleMin: field.type === 'escala' ? Number(field.scaleMin) : undefined,
          scaleMax: field.type === 'escala' ? Number(field.scaleMax) : undefined,
          scaleMinLabel: field.type === 'escala' ? field.scaleMinLabel : undefined,
          scaleMaxLabel: field.type === 'escala' ? field.scaleMaxLabel : undefined,
        })),
      })),
    };
    startTransition(async () => {
      const result = await action(payload);
      if (result.ok) {
        router.push('/configuracion/plantillas');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-ink">
              Nombre de la plantilla:<span className="text-danger"> *</span>
            </span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Evaluación inicial — adolescentes"
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Tipo de terapia:</span>
            <Input
              value={therapyType}
              onChange={(event) => setTherapyType(event.target.value)}
              placeholder="Ej. Cognitivo-conductual"
              className="mt-1"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-ink">Descripción:</span>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="¿Para qué casos se usa esta plantilla?"
              className="mt-1"
            />
          </label>
        </div>
      </div>

      {sections.map((section, sectionIndex) => (
        <div key={section.key} className="rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-start gap-3 border-b border-line p-4">
            <div className="flex-1 space-y-2">
              <Input
                value={section.title}
                onChange={(event) => updateSection(section.key, { title: event.target.value })}
                placeholder={`Título de la sección ${sectionIndex + 1}`}
              />
              <Input
                value={section.description}
                onChange={(event) => updateSection(section.key, { description: event.target.value })}
                placeholder="Descripción de la sección (opcional)"
              />
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                onClick={() => setSections((previous) => moveItem(previous, sectionIndex, -1))}
                disabled={sectionIndex === 0}
                className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                aria-label="Subir sección"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => setSections((previous) => moveItem(previous, sectionIndex, 1))}
                disabled={sectionIndex === sections.length - 1}
                className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-ink disabled:opacity-30"
                aria-label="Bajar sección"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => setSections((previous) => previous.filter((item) => item.key !== section.key))}
                className="rounded-lg border border-line p-1.5 text-danger hover:border-danger hover:bg-danger-soft"
                aria-label="Eliminar sección"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            {section.fields.map((field, fieldIndex) => {
              const needsOptions =
                field.type === 'seleccion' || field.type === 'opcion_multiple' || field.type === 'casillas';
              return (
                <div key={field.key} className="rounded-lg border border-line bg-bg/50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid flex-1 gap-2 md:grid-cols-2">
                      <Input
                        value={field.label}
                        onChange={(event) => updateField(section.key, field.key, { label: event.target.value })}
                        placeholder={`Pregunta ${fieldIndex + 1}`}
                      />
                      <div className="flex items-center gap-3">
                        <Select
                          value={field.type}
                          onChange={(event) =>
                            updateField(section.key, field.key, {
                              type: event.target.value as ClinicalFieldType,
                            })
                          }
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {FIELD_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </Select>
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-ink">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(event) =>
                              updateField(section.key, field.key, { required: event.target.checked })
                            }
                            className="accent-[var(--color-primary)]"
                          />
                          Requerida
                        </label>
                      </div>
                      {needsOptions ? (
                        <Textarea
                          value={field.optionsText}
                          onChange={(event) =>
                            updateField(section.key, field.key, { optionsText: event.target.value })
                          }
                          rows={3}
                          placeholder={'Una opción por línea\nOpción A\nOpción B'}
                          className="md:col-span-2"
                        />
                      ) : null}
                      {field.type === 'escala' ? (
                        <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-4">
                          <label className="block text-xs text-ink-soft">
                            Mínimo
                            <Input
                              type="number"
                              value={field.scaleMin}
                              onChange={(event) =>
                                updateField(section.key, field.key, { scaleMin: event.target.value })
                              }
                              className="mt-0.5"
                            />
                          </label>
                          <label className="block text-xs text-ink-soft">
                            Máximo
                            <Input
                              type="number"
                              value={field.scaleMax}
                              onChange={(event) =>
                                updateField(section.key, field.key, { scaleMax: event.target.value })
                              }
                              className="mt-0.5"
                            />
                          </label>
                          <label className="block text-xs text-ink-soft">
                            Etiqueta mínima
                            <Input
                              value={field.scaleMinLabel}
                              onChange={(event) =>
                                updateField(section.key, field.key, { scaleMinLabel: event.target.value })
                              }
                              placeholder="Ej. Nada"
                              className="mt-0.5"
                            />
                          </label>
                          <label className="block text-xs text-ink-soft">
                            Etiqueta máxima
                            <Input
                              value={field.scaleMaxLabel}
                              onChange={(event) =>
                                updateField(section.key, field.key, { scaleMaxLabel: event.target.value })
                              }
                              placeholder="Ej. Muchísimo"
                              className="mt-0.5"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(section.key, { fields: moveItem(section.fields, fieldIndex, -1) })
                        }
                        disabled={fieldIndex === 0}
                        className="rounded-lg border border-line p-1 text-ink-soft hover:text-ink disabled:opacity-30"
                        aria-label="Subir pregunta"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(section.key, { fields: moveItem(section.fields, fieldIndex, 1) })
                        }
                        disabled={fieldIndex === section.fields.length - 1}
                        className="rounded-lg border border-line p-1 text-ink-soft hover:text-ink disabled:opacity-30"
                        aria-label="Bajar pregunta"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(section.key, {
                            fields: section.fields.filter((item) => item.key !== field.key),
                          })
                        }
                        className="rounded-lg border border-line p-1 text-danger hover:border-danger hover:bg-danger-soft"
                        aria-label="Eliminar pregunta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => updateSection(section.key, { fields: [...section.fields, emptyField()] })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-white"
            >
              <Plus size={14} /> Añadir pregunta
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setSections((previous) => [...previous, emptySection()])}
        className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface py-4 text-sm font-medium text-ink-soft hover:border-primary hover:text-primary dark:hover:text-accent-2"
      >
        <Plus size={16} /> Añadir sección
      </button>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push('/configuracion/plantillas')}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          <Save size={15} /> {pending ? 'Guardando…' : 'Guardar plantilla'}
        </button>
      </div>
    </div>
  );
}
