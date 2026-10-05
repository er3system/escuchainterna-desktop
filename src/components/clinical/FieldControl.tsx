'use client';

import { useRef } from 'react';
import type { ClinicalField } from '@/shared/infrastructure/persistence/builtinTemplates';
import { baseOption, composeOther, optionsWithOther, otherDetail, resolveOtherOption } from './otherOption';

/** Valor de respuesta de un campo clínico: texto simple o lista (casillas). */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

/** ¿El campo tiene una respuesta no vacía? */
export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== '';
}

export function AutoTextarea({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <textarea
      ref={ref}
      value={value}
      placeholder={placeholder ?? 'Escribe tu respuesta...'}
      rows={2}
      onChange={(event) => {
        onChange(event.target.value);
        const element = ref.current;
        if (element) {
          element.style.height = 'auto';
          element.style.height = `${element.scrollHeight}px`;
        }
      }}
      className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
    />
  );
}

/** Campo de texto "¿cuál(es)?" del patrón "Otro → ¿cuáles?" (v2 §4). */
function OtherDetailInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 pl-6">
      <span className="shrink-0 text-xs font-medium text-ink-soft">¿Cuál(es)?</span>
      <input
        type="text"
        value={value}
        placeholder="Especifica…"
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
      />
    </div>
  );
}

/** Render de un campo clínico según su tipo (texto, fecha, escala, casillas, …). */
export function FieldControl({
  field,
  value,
  onChange,
}: {
  field: ClinicalField;
  value: AnswerValue | undefined;
  onChange: (next: AnswerValue) => void;
}) {
  const text = typeof value === 'string' ? value : '';
  const list = Array.isArray(value) ? value : [];

  switch (field.type) {
    case 'texto_corto':
      return (
        <input
          type="text"
          value={text}
          placeholder={field.placeholder ?? 'Tu respuesta'}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        />
      );
    case 'texto_largo':
      return <AutoTextarea value={text} placeholder={field.placeholder} onChange={onChange} />;
    case 'fecha':
      return (
        <input
          type="date"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        />
      );
    case 'numero':
      return (
        <input
          type="number"
          value={text}
          placeholder={field.placeholder ?? '0'}
          onChange={(event) => onChange(event.target.value)}
          className="w-40 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
        />
      );
    case 'seleccion': {
      const otherOpt = resolveOtherOption(field);
      const options = optionsWithOther(field.options, otherOpt);
      const base = baseOption(text);
      const isOther = otherOpt !== undefined && base === otherOpt;
      return (
        <div className="space-y-2">
          <select
            value={base}
            onChange={(event) => {
              const chosen = event.target.value;
              onChange(chosen === otherOpt ? composeOther(otherOpt, otherDetail(text)) : chosen);
            }}
            className="w-full max-w-sm rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="">Selecciona una opción…</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {isOther ? (
            <OtherDetailInput
              value={otherDetail(text)}
              onChange={(detail) => onChange(composeOther(otherOpt, detail))}
            />
          ) : null}
        </div>
      );
    }
    case 'opcion_multiple': {
      const otherOpt = resolveOtherOption(field);
      const options = optionsWithOther(field.options, otherOpt);
      const isOther = otherOpt !== undefined && baseOption(text) === otherOpt;
      return (
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={field.id}
                checked={option === otherOpt ? isOther : text === option}
                onChange={() =>
                  onChange(option === otherOpt ? composeOther(otherOpt, otherDetail(text)) : option)
                }
                className="accent-[var(--color-primary)]"
              />
              {option}
            </label>
          ))}
          {isOther ? (
            <OtherDetailInput
              value={otherDetail(text)}
              onChange={(detail) => onChange(composeOther(otherOpt, detail))}
            />
          ) : null}
        </div>
      );
    }
    case 'casillas': {
      const otherOpt = resolveOtherOption(field);
      const options = optionsWithOther(field.options, otherOpt);
      const otherEntry = otherOpt !== undefined ? list.find((item) => baseOption(item) === otherOpt) : undefined;
      return (
        <div className="space-y-2">
          {options.map((option) => {
            const checked = option === otherOpt ? otherEntry !== undefined : list.includes(option);
            return (
              <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (option === otherOpt) {
                      onChange(
                        event.target.checked
                          ? [...list, otherOpt]
                          : list.filter((item) => baseOption(item) !== otherOpt),
                      );
                    } else {
                      onChange(
                        event.target.checked ? [...list, option] : list.filter((item) => item !== option),
                      );
                    }
                  }}
                  className="accent-[var(--color-primary)]"
                />
                {option}
              </label>
            );
          })}
          {otherEntry !== undefined && otherOpt !== undefined ? (
            <OtherDetailInput
              value={otherDetail(otherEntry)}
              onChange={(detail) =>
                onChange(list.map((item) => (baseOption(item) === otherOpt ? composeOther(otherOpt, detail) : item)))
              }
            />
          ) : null}
        </div>
      );
    }
    case 'escala': {
      const min = field.scaleMin ?? 1;
      const max = field.scaleMax ?? 10;
      const steps: number[] = [];
      for (let step = min; step <= max; step += 1) steps.push(step);
      return (
        <div className="flex flex-wrap items-end gap-2">
          {field.scaleMinLabel ? (
            <span className="pb-2 text-xs text-ink-soft">{field.scaleMinLabel}</span>
          ) : null}
          <div className="flex gap-1.5">
            {steps.map((step) => {
              const selected = text === String(step);
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => onChange(selected ? '' : String(step))}
                  className={`h-9 w-9 rounded-full border text-sm font-medium transition-colors ${
                    selected
                      ? 'border-primary bg-primary text-white'
                      : 'border-line bg-surface text-ink hover:border-primary hover:text-primary'
                  }`}
                >
                  {step}
                </button>
              );
            })}
          </div>
          {field.scaleMaxLabel ? (
            <span className="pb-2 text-xs text-ink-soft">{field.scaleMaxLabel}</span>
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
}
