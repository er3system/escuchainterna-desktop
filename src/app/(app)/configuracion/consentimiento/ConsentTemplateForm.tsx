'use client';

import { useActionState, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import {
  DEFAULT_CONSENT_BODY,
  DEFAULT_CONSENT_TITLE,
} from '@/contexts/clinical-records/domain/value-objects/defaultConsentBody';
import { updateConsentTemplateAction, type ConsentTemplateFormState } from './actions';

const INITIAL: ConsentTemplateFormState = {};

const VARIABLES: Array<{ token: string; label: string }> = [
  { token: '{{paciente}}', label: 'Nombre del paciente' },
  { token: '{{profesional}}', label: 'Tu nombre' },
  { token: '{{cedula}}', label: 'Tu cédula / tarjeta profesional' },
  { token: '{{fecha}}', label: 'Fecha de firma' },
];

export function ConsentTemplateForm({ title, body }: { title: string; body: string }) {
  const [state, dispatch, pending] = useActionState(updateConsentTemplateAction, INITIAL);
  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentBody, setCurrentBody] = useState(body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function restoreDefault() {
    if (
      !window.confirm(
        'Esto reemplaza tu texto actual por el texto base de EscuchaInterna. ¿Restaurar?',
      )
    ) {
      return;
    }
    setCurrentTitle(DEFAULT_CONSENT_TITLE);
    setCurrentBody(DEFAULT_CONSENT_BODY);
  }

  function insertVariable(token: string) {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? currentBody.length;
    const end = textarea.selectionEnd ?? currentBody.length;
    const next = currentBody.slice(0, start) + token + currentBody.slice(end);
    setCurrentBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <form action={dispatch} className="max-w-3xl space-y-5">
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink">Texto del consentimiento</h2>
          <button
            type="button"
            onClick={restoreDefault}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
          >
            <RotateCcw size={13} /> Restaurar texto base
          </button>
        </div>

        <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="titulo">
          Título:
        </label>
        <Input
          id="titulo"
          name="titulo"
          value={currentTitle}
          onChange={(event) => setCurrentTitle(event.target.value)}
          maxLength={200}
          required
        />

        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="cuerpo">
            Documento:
          </label>
          <Textarea
            id="cuerpo"
            name="cuerpo"
            ref={bodyRef}
            value={currentBody}
            onChange={(event) => setCurrentBody(event.target.value)}
            rows={22}
            required
            className="font-mono text-[13px] leading-relaxed"
          />
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Variables disponibles (clic para insertar):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((variable) => (
              <button
                key={variable.token}
                type="button"
                onClick={() => insertVariable(variable.token)}
                title={variable.label}
                className="rounded-full bg-primary-light px-2.5 py-1 font-mono text-xs text-primary transition hover:bg-primary hover:text-white"
              >
                {variable.token}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {'{{paciente}}, {{profesional}} y {{cedula}} se congelan al enviar cada consentimiento; '}
            {'{{fecha}} se resuelve con la fecha de la firma.'}
          </p>
        </div>
      </section>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium text-success">{state.ok}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar plantilla'}
        </Button>
      </div>
    </form>
  );
}
