'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, FileDown, FileSignature, Printer, Save, ShieldCheck } from 'lucide-react';
import type { PatientReportPrimitives } from '@/contexts/clinical-records/domain/PatientReport';
import {
  PATIENT_REPORT_KIND_LABELS,
  PATIENT_REPORT_STATUS_LABELS,
} from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import { renderClinicalMarkdownToHtml } from '@/contexts/clinical-records/domain/clinicalMarkdown';
import { Button, Input, Textarea } from '@/components/ui';
import { signReportAction, updateReportAction } from '../../actions';
import { PreSignChecklist } from '../../PreSignChecklist';
import { RequestSignaturePanel, type SupervisorChoice } from './RequestSignaturePanel';

interface ProfessionalHeader {
  fullName: string;
  professionalLicense: string;
  email: string;
  contactPhone: string;
  contactAddress: string;
  organizationName: string | null;
  organizationLogoDataUri: string | null;
}

export function ReportEditor({
  report: initialReport,
  patientId,
  patientName,
  professional,
  gaps = [],
  supervisors = [],
  pendingRequestId = null,
  desktopEdition = false,
}: {
  report: PatientReportPrimitives;
  patientId: string;
  patientName: string;
  professional: ProfessionalHeader | null;
  /** Huecos del expediente para el checklist "Antes de firmar" (fuera del PDF). */
  gaps?: string[];
  /** Supervisores activos a quienes el practicante puede pedir co-firma. */
  supervisors?: SupervisorChoice[];
  /** Id de una solicitud de firma pendiente para este reporte (o null). */
  pendingRequestId?: string | null;
  desktopEdition?: boolean;
}) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [title, setTitle] = useState(initialReport.title);
  const [content, setContent] = useState(initialReport.content);
  const [reviewed, setReviewed] = useState(initialReport.status === 'revisado');
  const [status, setStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isSigned = report.status === 'firmado';
  // La firma usa la identidad del PERFIL (no texto libre) y exige tarjeta profesional.
  const signerName = (professional?.fullName ?? '').trim();
  const signerLicense = (professional?.professionalLicense ?? '').trim();
  const hasLicense = signerLicense !== '';
  const canSign = report.status === 'revisado' && status !== 'dirty' && hasLicense;

  function save() {
    setStatus('saving');
    setError(null);
    startTransition(async () => {
      const result = await updateReportAction(report.id, patientId, { title, content, reviewed });
      if (result.ok) {
        setStatus('saved');
        setReport((previous) => ({
          ...previous,
          title,
          content,
          status: reviewed ? 'revisado' : 'borrador',
        }));
      } else {
        setStatus('dirty');
        setError(result.error ?? 'No se pudo guardar el reporte.');
      }
    });
  }

  function sign() {
    setError(null);
    startTransition(async () => {
      const result = await signReportAction(report.id, patientId);
      if (result.ok) {
        setReport((previous) => ({
          ...previous,
          status: 'firmado',
          signedBy: signerName,
          licenseNumber: signerLicense,
          signedAt: new Date().toISOString(),
        }));
        router.refresh();
      } else {
        setError(result.error ?? 'No se pudo firmar el reporte.');
      }
    });
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #reporte-imprimible, #reporte-imprimible * { visibility: visible; }
          #reporte-imprimible { position: absolute; left: 0; top: 0; width: 100%; padding: 0; border: none; box-shadow: none; }
          @page { margin: 18mm; }
        }
      `}</style>

      {/* Barra de estado y acciones */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {PATIENT_REPORT_KIND_LABELS[report.kind]} · {PATIENT_REPORT_STATUS_LABELS[report.status]}
          </p>
          <h2 className="text-lg font-bold text-ink">{isSigned ? report.title : 'Editar reporte'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-soft" aria-live="polite">
            {status === 'saving' ? 'Guardando…' : null}
            {status === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-success">
                <Check size={13} /> Guardado
              </span>
            ) : null}
            {status === 'dirty' ? 'Cambios sin guardar' : null}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="px-3"
          >
            <Printer size={15} /> {desktopEdition ? 'Imprimir / guardar PDF' : isSigned ? 'Imprimir' : 'Imprimir borrador'}
          </Button>
          {desktopEdition ? null : <a
            href={`/api/pacientes/${patientId}/reportes/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-bg"
          >
            <FileDown size={15} /> Descargar PDF
          </a>}
          {!isSigned ? (
            <Button
              type="button"
              onClick={save}
              disabled={pending}
              className="disabled:opacity-50"
            >
              <Save size={15} /> Guardar
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-danger print:hidden">{error}</p> : null}

      {!isSigned ? (
        <div className="mb-4">
          <PreSignChecklist gaps={gaps} />
        </div>
      ) : null}

      {/* Editor (solo si no está firmado) */}
      {!isSigned ? (
        <div className="mb-4 space-y-3 rounded-card border border-line bg-surface p-4 shadow-card print:hidden">
          <label className="block text-sm text-ink">
            <span className="font-semibold">Título:</span>
            <Input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setStatus('dirty');
              }}
              className="mt-1"
            />
          </label>
          <label className="block text-sm text-ink">
            <span className="font-semibold">Contenido:</span>
            <Textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setStatus('dirty');
                if (reviewed) setReviewed(false);
              }}
              rows={18}
              className="mt-1 resize-y font-mono leading-relaxed"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => {
                setReviewed(event.target.checked);
                setStatus('dirty');
              }}
              className="mt-0.5 accent-[var(--color-primary)]"
            />
            <span>
              <span className="font-semibold">He revisado este contenido</span> y confirmo que refleja mi
              valoración profesional. (Requisito para poder firmar.)
            </span>
          </label>

          <div className="rounded-lg border border-line bg-bg p-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-ink">
              <FileSignature size={15} /> Firmar reporte
            </p>

            {hasLicense ? (
              <>
                <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Firmarás como
                  </p>
                  <p className="mt-0.5 font-semibold text-ink">{signerName || '—'}</p>
                  <p className="text-ink-soft">Tarjeta profesional: {signerLicense}</p>
                </div>
                <button
                  type="button"
                  onClick={sign}
                  disabled={!canSign || pending}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                >
                  <ShieldCheck size={15} /> Firmar con sello de fecha
                </button>
                <p className="mt-1.5 text-xs text-ink-soft">
                  {canSign
                    ? 'Al firmar, el reporte queda inmutable y se imprime sin marca de agua.'
                    : 'Para firmar: guarda el reporte con la casilla «He revisado este contenido» marcada.'}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-ink">
                  <p className="font-semibold">No puedes firmar con tu cuenta.</p>
                  <p className="mt-0.5 text-ink-soft">
                    Firmar un documento clínico-legal exige una{' '}
                    <strong className="font-semibold text-ink">tarjeta profesional</strong> en tu perfil.
                    Si eres practicante en supervisión, pídele la firma a tu supervisor aquí abajo. Si ya
                    tienes tarjeta,{' '}
                    <a href="/ajustes" className="font-medium text-primary dark:text-accent-2 hover:underline">
                      regístrala en tu perfil
                    </a>
                    .
                  </p>
                </div>
                <RequestSignaturePanel
                  reportId={report.id}
                  patientId={patientId}
                  supervisors={supervisors}
                  pendingRequestId={pendingRequestId}
                  canRequest={report.status === 'revisado' && status !== 'dirty'}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success print:hidden">
          <ShieldCheck size={15} /> Reporte firmado e inmutable. Puedes imprimirlo como documento
          definitivo.
        </p>
      )}

      {/* Documento imprimible */}
      <div
        id="reporte-imprimible"
        className="relative overflow-hidden rounded-card border border-line bg-surface p-8 shadow-card"
      >
        {!isSigned ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span className="rotate-[-30deg] select-none text-7xl font-black tracking-widest text-danger opacity-15">
              BORRADOR
            </span>
          </div>
        ) : null}

        <header className="mb-6 border-b-2 border-ink pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                {PATIENT_REPORT_KIND_LABELS[report.kind]}
              </p>
              {professional ? (
                <div className="mt-2 text-sm">
                  <p className="font-bold text-ink">{professional.fullName || '—'}</p>
                  {professional.professionalLicense ? (
                    <p className="text-ink-soft">
                      Cédula / tarjeta profesional: {professional.professionalLicense}
                    </p>
                  ) : null}
                  <p className="text-ink-soft">
                    {[professional.contactPhone, professional.email].filter(Boolean).join(' · ')}
                  </p>
                  {professional.contactAddress ? (
                    <p className="text-ink-soft">{professional.contactAddress}</p>
                  ) : null}
                  {professional.organizationName ? (
                    <p className="text-ink-soft">{professional.organizationName}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {professional?.organizationLogoDataUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={professional.organizationLogoDataUri}
                alt={professional.organizationName ?? 'Logo de la organización'}
                className="h-14 w-auto shrink-0 object-contain"
              />
            ) : null}
          </div>
          <h1 className="mt-3 text-xl font-bold text-ink">{isSigned ? report.title : title}</h1>
          <p className="mt-1 text-sm text-ink-soft">Paciente: {patientName}</p>
        </header>

        <div
          className="report-prose text-sm leading-relaxed text-ink"
          dangerouslySetInnerHTML={{
            __html: renderClinicalMarkdownToHtml(isSigned ? report.content : content),
          }}
        />

        <footer className="mt-10 border-t border-line pt-4 text-sm">
          {isSigned && report.signedAt ? (
            <div>
              <p className="font-bold text-ink">{report.signedBy}</p>
              <p className="text-ink-soft">Cédula / tarjeta profesional: {report.licenseNumber}</p>
              <p className="text-ink-soft">
                Firmado el{' '}
                {format(new Date(report.signedAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
              </p>
            </div>
          ) : (
            <p className="font-semibold text-danger">
              DOCUMENTO EN BORRADOR — sin validez hasta su revisión y firma profesional.
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
