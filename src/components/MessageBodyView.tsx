'use client';

import Link from 'next/link';
import { Palette } from 'lucide-react';
import { isThemedEmailBody } from '@/shared/infrastructure/email-themes/emailThemes';

/**
 * Muestra el cuerpo de un mensaje del outbox tal cual lo recibió la persona:
 * - Correo HTML con tema (isThemedEmailBody) → se RENDERIZA en un iframe aislado
 *   (sandbox vacío: sin scripts ni acceso a la app). El psicólogo ve el correo, no el código.
 * - Texto plano (WhatsApp, recordatorios simples) → se muestra como texto.
 *
 * Si se pasa `themeSettingsHref`, muestra un enlace «Configurar tema» que lleva a la
 * zona de temas de correo (en vez de mostrar el HTML, que no le sirve al profesional).
 * Fuente única para todas las superficies que enseñan correos enviados.
 */
export function MessageBodyView({
  body,
  recipientLabel,
  height = '24rem',
  themeSettingsHref,
}: {
  body: string;
  /** Para el título accesible del iframe (p. ej. el destinatario). */
  recipientLabel?: string;
  /** Alto del iframe del correo, como valor CSS (p. ej. '60vh', '20rem'). */
  height?: string;
  /** Si se da, muestra «Configurar tema» enlazando a la zona de temas. */
  themeSettingsHref?: string;
}) {
  if (!isThemedEmailBody(body)) {
    return <p className="whitespace-pre-wrap text-sm text-ink">{body}</p>;
  }

  return (
    <div>
      {themeSettingsHref ? (
        <div className="mb-2 flex justify-end">
          <Link
            href={themeSettingsHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-bg hover:text-ink"
          >
            <Palette size={13} className="text-primary" />
            Configurar tema
          </Link>
        </div>
      ) : null}
      <iframe
        title={recipientLabel ? `Correo para ${recipientLabel}` : 'Vista del correo'}
        srcDoc={body}
        sandbox=""
        style={{ height }}
        className="w-full rounded-lg border border-line bg-white"
      />
    </div>
  );
}
