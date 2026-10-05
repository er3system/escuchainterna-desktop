'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ban, Check, CheckCheck, ChevronDown, Clock, HardDrive, Mail, MessageCircle, XCircle } from 'lucide-react';
import type { OutboxLogEntry } from '@/contexts/marketing/domain/repositories/OutboxMessageLog';
import { outboxTemplateLabel } from '@/contexts/marketing/domain/value-objects/OutboxTemplateLabel';
import { isThemedEmailBody } from '@/shared/infrastructure/email-themes/emailThemes';
import { MessageBodyView } from '@/components/MessageBodyView';

export function MessageList({ entries, locallyRecordedChannels = [] }: { entries: OutboxLogEntry[]; locallyRecordedChannels?: Array<'whatsapp' | 'email'> }) {
  return (
    <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      {entries.map((entry) => (
        <MessageRow key={entry.id} entry={entry} locallyRecorded={locallyRecordedChannels.includes(entry.channel)} />
      ))}
    </ul>
  );
}

function MessageRow({ entry, locallyRecorded }: { entry: OutboxLogEntry; locallyRecorded: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const themed = isThemedEmailBody(entry.body);
  const preview = (themed ? stripHtml(entry.body) : entry.body).replace(/\s+/g, ' ').trim();

  return (
    <li className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-bg"
      >
        <ChannelIcon channel={entry.channel} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink">
              {entry.recipientName || entry.recipient || 'Sin destinatario'}
            </span>
            <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[11px] font-medium text-ink-soft">
              {outboxTemplateLabel(entry.template)}
            </span>
            {entry.status === 'omitido' ? (
              <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                Omitido: límite del plan
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {entry.subject ? <span className="font-medium">{entry.subject} — </span> : null}
            {preview}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[11px] text-ink-soft">
            {formatDistanceToNow(new Date(locallyRecorded ? entry.createdAt : entry.sentAt ?? entry.createdAt), { addSuffix: true, locale: es })}
          </span>
          <span className="flex items-center gap-1.5">
            {locallyRecorded ? <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft" title="Registro local; no acredita entrega al destinatario"><HardDrive size={13} /> Registro local</span> : <StatusIcon status={entry.status} />}
            <ChevronDown
              size={14}
              className={`text-ink-soft transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-line bg-bg px-4 py-4">
          {themed ? (
            <div className="max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <p className="border-b border-line px-4 py-2 text-xs text-ink-soft">
                Para: <span className="font-medium text-ink">{entry.recipient || '—'}</span>
                {entry.subject ? (
                  <>
                    {' · '}
                    <span className="font-semibold text-ink">{entry.subject}</span>
                  </>
                ) : null}
              </p>
              <div className="p-3">
                <MessageBodyView
                  body={entry.body}
                  recipientLabel={entry.recipientName || entry.recipient}
                />
              </div>
            </div>
          ) : (
            <div
              className={`max-w-xl rounded-2xl border border-line bg-surface px-4 py-3 shadow-card ${
                entry.channel === 'whatsapp' ? 'rounded-tl-sm' : ''
              }`}
            >
              <p className="mb-2 text-xs text-ink-soft">
                Para: <span className="font-medium text-ink">{entry.recipient || '—'}</span>
              </p>
              {entry.subject ? <p className="mb-2 text-sm font-semibold text-ink">{entry.subject}</p> : null}
              <p className="whitespace-pre-wrap text-sm text-ink">{entry.body}</p>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** Texto plano aproximado de un correo HTML (solo para la línea de vista previa). */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function ChannelIcon({ channel }: { channel: OutboxLogEntry['channel'] }) {
  if (channel === 'whatsapp') {
    return (
      <span
        title="WhatsApp"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
      >
        <MessageCircle size={17} />
      </span>
    );
  }
  return (
    <span
      title="Correo"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary"
    >
      <Mail size={17} />
    </span>
  );
}

function StatusIcon({ status }: { status: OutboxLogEntry['status'] }) {
  switch (status) {
    case 'pendiente':
      return (
        <span role="img" aria-label="Pendiente" title="Pendiente">
          <Clock size={15} className="text-warning" />
        </span>
      );
    case 'enviado':
      return (
        <span role="img" aria-label="Enviado" title="Enviado">
          <Check size={15} className="text-ink-soft" />
        </span>
      );
    case 'recibido':
      return (
        <span role="img" aria-label="Recibido" title="Recibido">
          <CheckCheck size={15} className="text-ink-soft" />
        </span>
      );
    case 'leido':
      return (
        <span role="img" aria-label="Leído" title="Leído">
          <CheckCheck size={15} className="text-primary" />
        </span>
      );
    case 'fallido':
      return (
        <span role="img" aria-label="Fallido" title="Fallido">
          <XCircle size={15} className="text-danger" />
        </span>
      );
    case 'omitido':
      return (
        <span
          role="img"
          aria-label="Omitido: límite de WhatsApp del plan (el aviso salió por correo)"
          title="Omitido: límite de WhatsApp del plan (el aviso salió por correo)"
        >
          <Ban size={15} className="text-warning" />
        </span>
      );
    default:
      return null;
  }
}
