'use client';

import { useActionState, useState } from 'react';
import { Check } from 'lucide-react';
import {
  EMAIL_THEMES,
  isEmailThemeId,
  type EmailSenderData,
  type EmailThemeId,
} from '@/shared/infrastructure/email-themes/emailThemes';
import { chooseEmailThemeAction, type MensajesActionState } from './actions';
import { EmailPreviewFrame } from './EmailPreviewFrame';
import { Button } from '@/components/ui';

const INITIAL: MensajesActionState = {};

const SAMPLE_BODY = `Hola María,

Te recuerdo nuestra sesión del lunes 12 de junio a las 10:00 am.

Cualquier cosa, escríbeme por este medio.

Un abrazo,
{{profesional}}`;

/**
 * Selector de tema de correo reutilizable (mismo control en /mensajes y en
 * /configuracion/recordatorios). Muestra los 3 temas con miniatura en vivo del
 * branding real del profesional y persiste practitioner_profile.email_theme.
 * Al cambiar de tema, `onThemeChange` permite a la pantalla contenedora
 * actualizar sus vistas previas sin recargar.
 */
export function EmailThemeSelector({
  currentTheme,
  sender,
  onThemeChange,
}: {
  currentTheme: string;
  sender: EmailSenderData;
  onThemeChange?: (theme: EmailThemeId) => void;
}) {
  const [state, dispatch, pending] = useActionState(chooseEmailThemeAction, INITIAL);
  const [selected, setSelected] = useState<EmailThemeId>(
    isEmailThemeId(currentTheme) ? currentTheme : 'calido',
  );

  const sample = SAMPLE_BODY.replaceAll('{{profesional}}', sender.professionalName || 'Tu nombre');

  function pick(theme: EmailThemeId) {
    setSelected(theme);
    onThemeChange?.(theme);
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {EMAIL_THEMES.map((theme) => {
          const isActive = selected === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => pick(theme.id)}
              className={`rounded-card border-2 p-3 text-left transition ${
                isActive ? 'border-primary bg-primary-light/40 dark:bg-primary/15 dark:border-accent-2/25' : 'border-line bg-surface hover:border-ink-soft'
              }`}
            >
              <EmailPreviewFrame
                theme={theme.id}
                body={sample}
                sender={sender}
                scale={0.5}
                className="h-56 w-full rounded-lg border border-line bg-white"
              />
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    isActive ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-transparent'
                  }`}
                >
                  <Check size={12} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-ink">{theme.name}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{theme.description}</p>
            </button>
          );
        })}
      </div>

      {state.error ? <p className="mt-4 text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="mt-4 text-sm text-success">{state.ok}</p> : null}

      <form action={dispatch} className="mt-5 flex items-center justify-end gap-2">
        <input type="hidden" name="tema" value={selected} />
        <Button type="submit" disabled={pending} className="px-5">
          {pending ? 'Guardando…' : 'Guardar tema'}
        </Button>
      </form>
    </div>
  );
}
