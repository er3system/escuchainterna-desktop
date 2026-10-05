'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Eye, Mail, MessageCircle, Palette, Pencil, RotateCcw, X } from 'lucide-react';
import type { EffectiveMessageTemplate } from '@/contexts/marketing/application/get-effective-templates/GetEffectiveTemplates';
import {
  SAMPLE_TEMPLATE_VARIABLES,
  TEMPLATE_VARIABLE_DOCS,
  renderTemplateContent,
  type MessageTemplateKind,
} from '@/contexts/marketing/domain/value-objects/messageTemplateCatalog';
import { isEmailThemeId, type EmailSenderData, type EmailThemeId } from '@/shared/infrastructure/email-themes/emailThemes';
import { restoreTemplateAction, updateTemplateAction, type MensajesActionState } from './actions';
import { EmailPreviewFrame } from './EmailPreviewFrame';
import { EmailThemeSelector } from './EmailThemeSelector';
import { Button, Input, Textarea } from '@/components/ui';

const INITIAL: MensajesActionState = {};

const KIND_LABELS: Record<MessageTemplateKind, { title: string; description: string }> = {
  notificacion: {
    title: 'Notificaciones de sesiones y pagos',
    description: 'Se envían automáticamente al agendar, reagendar, cancelar, recordar sesiones y cobrar.',
  },
  automatizacion: {
    title: 'Automatizaciones',
    description: 'Correos automáticos de cumpleaños y reactivación (se configuran en Marketing).',
  },
  marketing: {
    title: 'Marketing',
    description: 'Plantillas sugeridas para el correo masivo desde la página de Marketing.',
  },
};

/** Variables de ejemplo con el nombre real del profesional para las vistas previas. */
function sampleVariablesFor(sender: EmailSenderData): Record<string, string> {
  return { ...SAMPLE_TEMPLATE_VARIABLES, profesional: sender.professionalName || 'Tu nombre' };
}

/**
 * Construye, a partir del cuerpo renderizado, el botón de acción (CTA) de la
 * vista previa del correo: detecta una liga de pago o de sesión y la convierte
 * en botón destacado. Es solo para la preview; el outbox enlaza las URLs en
 * línea con el tema. */
function deriveAction(key: string, renderedBody: string): { label: string; url: string } | undefined {
  const url = renderedBody.match(/https?:\/\/[^\s<]+/)?.[0];
  if (!url) return undefined;
  if (key === 'recordatorio_pago' || key === 'factura') return { label: 'Pagar', url };
  if (key.startsWith('sesion') || key === 'recordatorio_sesion') return { label: 'Ver mi sesión', url };
  return { label: 'Agendar una sesión', url };
}

/**
 * Gestor unificado de plantillas: lista, edición con vista previa EN VIVO
 * (envuelta en el tema del profesional para correo, texto plano con emojis para
 * WhatsApp) y restaurar original. Compartido por la pestaña "Plantillas" de
 * /mensajes y por /configuracion/recordatorios (que pasa `onlyKeys` para
 * mostrar solo las plantillas de recordatorio). Incluye el mismo selector de
 * tema de correo que el resto de la app.
 */
export function TemplatesManager({
  templates,
  emailTheme,
  sender,
  onlyKeys,
  showThemeSelector = true,
}: {
  templates: EffectiveMessageTemplate[];
  emailTheme: string;
  sender: EmailSenderData;
  /** Si se pasa, solo se listan las plantillas con estas claves. */
  onlyKeys?: string[];
  showThemeSelector?: boolean;
}) {
  const [theme, setTheme] = useState<EmailThemeId>(isEmailThemeId(emailTheme) ? emailTheme : 'calido');
  const [previewing, setPreviewing] = useState<EffectiveMessageTemplate | null>(null);
  const [editing, setEditing] = useState<EffectiveMessageTemplate | null>(null);

  const visible = onlyKeys ? templates.filter((template) => onlyKeys.includes(template.key)) : templates;
  const kinds: MessageTemplateKind[] = ['notificacion', 'automatizacion', 'marketing'];

  return (
    <div className="space-y-6">
      {showThemeSelector ? (
        <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Palette size={16} className="text-primary dark:text-accent-2" />
            <div>
              <h2 className="text-sm font-semibold text-ink">Tema de correo</h2>
              <p className="text-xs text-ink-soft">
                El diseño con el que tus pacientes reciben tus correos. Tu nombre
                {sender.organizationName ? ' y el logo de tu organización' : ''} se incluyen automáticamente.
              </p>
            </div>
          </div>
          <div className="p-5">
            <EmailThemeSelector currentTheme={theme} sender={sender} onThemeChange={setTheme} />
          </div>
        </section>
      ) : null}

      <div className="rounded-card border border-line bg-primary-light/30 dark:bg-primary/15 px-5 py-4 text-sm text-ink">
        <p className="font-semibold">Variables disponibles</p>
        <p className="mt-1 text-ink-soft">
          Escribe estas variables entre llaves dobles y se reemplazarán automáticamente al enviar cada mensaje:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLE_DOCS.map((doc) => (
            <span
              key={doc.token}
              title={doc.description}
              className="rounded-full bg-surface px-2.5 py-0.5 font-mono text-xs text-primary dark:text-accent-2 shadow-sm"
            >
              {`{{${doc.token}}}`}
            </span>
          ))}
        </div>
      </div>

      {kinds.map((kind) => {
        const group = visible.filter((template) => template.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-sm font-semibold text-ink">{KIND_LABELS[kind].title}</h2>
              <p className="text-xs text-ink-soft">{KIND_LABELS[kind].description}</p>
            </div>
            <ul>
              {group.map((template) => (
                <li
                  key={template.key}
                  className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-0"
                >
                  <span
                    title={template.channel === 'whatsapp' ? 'WhatsApp (y correo)' : 'Correo'}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      template.channel === 'whatsapp'
                        ? 'bg-success-soft text-success'
                        : 'bg-primary-light text-primary'
                    }`}
                  >
                    {template.channel === 'whatsapp' ? <MessageCircle size={15} /> : <Mail size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{template.name}</span>
                      {template.isCustomized ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                          Personalizada
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-ink-soft">{template.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setPreviewing(template)}
                    >
                      <Eye size={13} /> Vista previa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => setEditing(template)}
                    >
                      <Pencil size={13} /> Editar
                    </Button>
                    {template.isCustomized ? <RestoreButton templateKey={template.key} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {previewing ? (
        <PreviewModal template={previewing} theme={theme} sender={sender} onClose={() => setPreviewing(null)} />
      ) : null}
      {editing ? (
        <EditModal template={editing} theme={theme} sender={sender} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

function RestoreButton({ templateKey }: { templateKey: string }) {
  const [state, dispatch, pending] = useActionState(restoreTemplateAction, INITIAL);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.ok) setConfirming(false);
  }, [state.ok]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Vuelve al contenido integrado y borra tu personalización"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-warning transition hover:bg-warning-soft"
      >
        <RotateCcw size={13} /> Restaurar original
      </button>
    );
  }

  return (
    <form action={dispatch} className="flex items-center gap-1.5">
      <input type="hidden" name="clave" value={templateKey} />
      <span className="text-xs text-ink-soft">¿Borrar tu versión?</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-warning px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Restaurando…' : 'Sí, restaurar'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-bg"
      >
        No
      </button>
    </form>
  );
}

/** Vista previa de un mensaje (correo envuelto en el tema o WhatsApp en texto plano). */
function MessagePreview({
  template,
  theme,
  sender,
  body,
  subject,
}: {
  template: EffectiveMessageTemplate;
  theme: EmailThemeId;
  sender: EmailSenderData;
  body: string;
  subject: string;
}) {
  const variables = sampleVariablesFor(sender);
  const renderedBody = useMemo(() => renderTemplateContent(body, variables), [body, variables]);
  const renderedSubject = renderTemplateContent(subject, variables);
  const action = deriveAction(template.key, renderedBody);

  if (template.channel === 'email') {
    return (
      <div>
        <p className="mb-2 text-xs text-ink-soft">
          Asunto: <span className="font-medium text-ink">{renderedSubject || '(sin asunto)'}</span>
        </p>
        <EmailPreviewFrame theme={theme} body={renderedBody} sender={sender} action={action} />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg bg-bg p-4">
        <div className="max-w-md rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3 shadow-card">
          <p className="whitespace-pre-wrap text-sm text-ink">{renderedBody}</p>
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          Las notificaciones de sesión también se envían por correo con tu tema visual.
        </p>
      </div>
    </div>
  );
}

function PreviewModal({
  template,
  theme,
  sender,
  onClose,
}: {
  template: EffectiveMessageTemplate;
  theme: EmailThemeId;
  sender: EmailSenderData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Vista previa — {template.name}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink" title="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-soft">Ejemplo con datos de muestra.</p>
        <MessagePreview
          template={template}
          theme={theme}
          sender={sender}
          body={template.body}
          subject={template.subject}
        />
        <div className="mt-4 flex justify-end">
          <Button variant="outline" type="button" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  template,
  theme,
  sender,
  onClose,
}: {
  template: EffectiveMessageTemplate;
  theme: EmailThemeId;
  sender: EmailSenderData;
  onClose: () => void;
}) {
  const [state, dispatch, pending] = useActionState(updateTemplateAction, INITIAL);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);

  const variableDocs = TEMPLATE_VARIABLE_DOCS.filter((doc) => template.variables.includes(doc.token));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Editar — {template.name}</h2>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-ink" title="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-xs text-ink-soft">
          El nombre y la clave de la plantilla son fijos; solo personalizas el contenido. La vista previa de la derecha
          se actualiza mientras escribes. Con &quot;Restaurar original&quot; vuelves a la versión integrada.
        </p>

        <div className="grid gap-5 lg:grid-cols-2">
          <form action={dispatch} className="space-y-3">
            <input type="hidden" name="clave" value={template.key} />
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink" htmlFor={`asunto-${template.key}`}>
                {template.channel === 'email' ? 'Asunto' : 'Asunto (referencia interna)'}
              </label>
              <Input
                id={`asunto-${template.key}`}
                name="asunto"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink" htmlFor={`contenido-${template.key}`}>
                Contenido
              </label>
              <Textarea
                id={`contenido-${template.key}`}
                name="contenido"
                rows={12}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="font-mono"
              />
            </div>
            {variableDocs.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-ink">Variables de esta plantilla (clic para insertar):</p>
                <div className="flex flex-wrap gap-1.5">
                  {variableDocs.map((doc) => (
                    <button
                      key={doc.token}
                      type="button"
                      title={doc.description}
                      onClick={() => setBody((current) => `${current}{{${doc.token}}}`)}
                      className="rounded-full bg-bg px-2.5 py-0.5 font-mono text-xs text-primary dark:text-accent-2 transition hover:bg-primary-light"
                    >
                      {`{{${doc.token}}}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
            {state.ok ? <p className="text-sm text-success">{state.ok}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" type="button" onClick={onClose}>
                Cerrar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar contenido'}
              </Button>
            </div>
          </form>

          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-ink">Vista previa en vivo</p>
            <MessagePreview
              template={template}
              theme={theme}
              sender={sender}
              body={body}
              subject={subject}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
