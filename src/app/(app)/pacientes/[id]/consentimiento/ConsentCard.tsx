'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ban, Check, Copy, FileSignature, Image as ImageIcon, Paperclip, Printer, Send } from 'lucide-react';
import {
  CONSENT_STATUS_LABELS,
  isConsentGranted,
  type ConsentStatus,
} from '@/contexts/clinical-records/domain/value-objects/consentStatus';
import { imageToWebp } from '@/components/imageToWebp';
import { Badge, Card } from '@/components/ui';
import { attachPaperConsentAction, revokeConsentAction, sendConsentAction } from './actions';
import { ConsentReceptionRequest } from '@/components/consent-reception/ConsentReceptionRequest';

export interface ConsentCardData {
  /** null = nunca se ha emitido un consentimiento para este paciente. */
  status: ConsentStatus | null;
  sentAt: string | null;
  signedAt: string | null;
  signedName: string;
  hasFile: boolean;
  /** Liga pública de firma (solo cuando está pendiente). */
  signUrl: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

const actionButton =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50';
const quietButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink disabled:opacity-50';

export function ConsentCard({ patientId, consent, desktop = false }: { patientId: string; consent: ConsentCardData; desktop?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const granted = isConsentGranted(consent.status);
  const pendienteFirma = consent.status === 'pendiente';
  // Se puede adjuntar/reemplazar la foto mientras no haya firma DIGITAL (esa no se pisa con
  // papel) ni esté revocado: pendiente, sin consentimiento, o ya con papel (reemplazo).
  const isReplace = consent.status === 'papel_adjunto';
  const canAttach = consent.status === null || pendienteFirma || isReplace;

  function runSend() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await sendConsentAction(patientId);
      if (!result.ok) setError(result.error ?? 'No se pudo enviar.');
      else if (result.warning) setInfo(result.warning);
      else setInfo(pendienteFirma ? 'Liga reenviada por WhatsApp y correo.' : 'Consentimiento enviado por WhatsApp y correo.');
    });
  }

  function runRevoke() {
    const message = granted
      ? 'Quedará registrado que el paciente retiró su autorización (Ley 1581). El expediente conserva el rastro de la firma previa. ¿Revocar el consentimiento?'
      : 'La liga enviada dejará de funcionar. ¿Revocar?';
    if (!window.confirm(message)) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await revokeConsentAction(patientId);
      if (!result.ok) setError(result.error ?? 'No se pudo revocar.');
      else
        setInfo(
          granted
            ? 'Consentimiento revocado. Quedó registrada la fecha de revocación.'
            : 'Liga revocada. Puedes enviar una nueva cuando quieras.',
        );
    });
  }

  function handleAttachment(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      // Las fotos/escaneos se convierten a WebP en el navegador (v3 §9).
      const prepared = await imageToWebp(file);
      const formData = new FormData();
      formData.append('archivo', prepared);
      const result = await attachPaperConsentAction(patientId, formData);
      if (!result.ok) setError(result.error ?? 'No se pudo adjuntar.');
      else setInfo('Consentimiento en papel adjuntado.');
      if (fileRef.current) fileRef.current.value = '';
    });
  }

  async function copyLink() {
    if (!consent.signUrl) return;
    try {
      await navigator.clipboard.writeText(consent.signUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia la liga de firma:', consent.signUrl);
    }
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-ink-soft">
          <FileSignature size={14} /> Consentimiento
        </h3>
        {consent.status === null ? (
          <Badge tone="warning">{desktop ? 'Sin documento' : 'Sin enviar'}</Badge>
        ) : (
          <Badge tone={granted ? 'success' : consent.status === 'pendiente' ? 'warning' : 'neutral'}>
            {desktop && consent.status === 'papel_adjunto' ? 'Documento firmado' : CONSENT_STATUS_LABELS[consent.status]}
          </Badge>
        )}
      </div>

      <p className="text-sm text-ink-soft">
        {consent.status === null
          ? desktop ? 'Este paciente aún no tiene consentimiento informado. Adjunta la copia firmada o prepara su recepción con Drive.' : 'Este paciente aún no tiene consentimiento informado. Envíale la liga de firma o adjunta la copia firmada en papel.'
          : consent.status === 'pendiente'
            ? desktop ? 'Pendiente de recibir la copia firmada. Puedes adjuntarla o preparar su recepción con Drive.' : `Liga enviada${consent.sentAt ? ` el ${formatDate(consent.sentAt)}` : ''}; esperando la firma del paciente.`
            : consent.status === 'firmado'
              ? `Firmado digitalmente por ${consent.signedName}${consent.signedAt ? ` el ${formatDate(consent.signedAt)}` : ''}.`
              : consent.status === 'papel_adjunto'
                ? `Documento firmado adjunto${consent.signedAt ? ` · Fecha registrada: ${formatDate(consent.signedAt)}` : ''}.`
                : 'El consentimiento fue revocado. Envía uno nuevo cuando lo necesites.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {!granted && !desktop ? (
          <button type="button" onClick={runSend} disabled={pending} className={actionButton}>
            <Send size={13} />
            {pendienteFirma ? 'Reenviar liga' : 'Enviar al paciente'}
          </button>
        ) : null}

        {pendienteFirma && consent.signUrl && !desktop ? (
          <button type="button" onClick={copyLink} disabled={pending} className={quietButton}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copiada' : 'Copiar liga'}
          </button>
        ) : null}

        {canAttach ? (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className={quietButton}
            >
              <Paperclip size={13} /> {isReplace ? 'Reemplazar foto' : 'Adjuntar firmado en papel'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(event) => handleAttachment(event.target.files)}
            />
          </>
        ) : null}

        {consent.status === 'papel_adjunto' && consent.hasFile ? (
          <a
            href={`/api/pacientes/${patientId}/consentimiento`}
            target="_blank"
            rel="noreferrer"
            className={quietButton}
          >
            <ImageIcon size={13} /> Ver adjunto
          </a>
        ) : null}

        <Link href={`/pacientes/${patientId}/consentimiento`} className={quietButton}>
          <Printer size={13} /> Ver / imprimir
        </Link>

        {pendienteFirma || granted ? (
          <button type="button" onClick={runRevoke} disabled={pending} className={quietButton}>
            <Ban size={13} /> {granted ? 'Revocar consentimiento' : 'Revocar liga'}
          </button>
        ) : null}
      </div>
      {desktop ? <ConsentReceptionRequest patientId={patientId} /> : null}

      {pending ? <p className="mt-2 text-xs text-ink-soft">Procesando…</p> : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {info ? <p className="mt-2 text-sm text-success">{info}</p> : null}
    </Card>
  );
}
