'use client';

import { useMemo } from 'react';
import {
  renderEmailTheme,
  type EmailSenderData,
  type EmailThemeId,
} from '@/shared/infrastructure/email-themes/emailThemes';

/**
 * Vista previa de un correo: renderiza el cuerpo (texto plano) envuelto en el
 * tema elegido por el profesional, con su mismo branding (nombre, organización,
 * logo). Reutilizado por el selector de temas, la edición de plantillas y la
 * pantalla de recordatorios — todas muestran exactamente lo que recibe el
 * paciente. Usa `srcDoc` + `sandbox` vacío para aislar el HTML del correo.
 */
export function EmailPreviewFrame({
  theme,
  body,
  sender,
  action,
  className = 'h-96 w-full rounded-lg border border-line bg-white',
  scale,
}: {
  theme: EmailThemeId;
  body: string;
  sender: EmailSenderData;
  action?: { label: string; url: string };
  className?: string;
  /** Para miniaturas: factor de escala (0-1) aplicado al iframe. */
  scale?: number;
}) {
  const html = useMemo(
    () => renderEmailTheme(theme, body, { ...sender, action }),
    [theme, body, sender, action],
  );

  if (scale && scale > 0 && scale < 1) {
    const inverse = `${100 / scale}%`;
    return (
      <div className={`pointer-events-none overflow-hidden ${className}`}>
        <iframe
          title="Vista previa del correo"
          srcDoc={html}
          sandbox=""
          style={{
            width: inverse,
            height: inverse,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            border: 0,
          }}
        />
      </div>
    );
  }

  return <iframe title="Vista previa del correo" srcDoc={html} sandbox="" className={className} />;
}
