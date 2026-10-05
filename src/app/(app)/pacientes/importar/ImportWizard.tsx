'use client';

import { useMemo, useRef, useState, useTransition, type DragEvent } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Tag,
  Users,
} from 'lucide-react';
import {
  IMPORT_PATIENT_FIELDS,
  type ImportColumnMapping,
  type ImportColumnTarget,
} from '@/contexts/patients/application/import-patients-flexible/importFields';
import { decodeCsvBytes } from '@/contexts/patients/application/import-patients-flexible/decodeCsvBytes';
import type { CsvAnalysis } from '@/contexts/patients/application/import-patients-flexible/analyzeCsv';
import type { FlexibleImportResult } from '@/contexts/patients/application/import-patients-flexible/ImportPatientsWithMapping';
import { analyzeCsvAction, importWithMappingAction } from './actions';

/**
 * Importador flexible (v3 §3): subir CSV → mapear columnas (con sugerencia
 * automática) → vista previa de 5 filas → importar con reporte por fila.
 * Las columnas mapeadas a etiqueta crean tags «Columna: valor».
 */

type WizardStep = 'archivo' | 'mapeo' | 'previa' | 'resultado';

const STEP_LABELS: Array<{ key: WizardStep; label: string }> = [
  { key: 'archivo', label: 'Archivo' },
  { key: 'mapeo', label: 'Mapeo de columnas' },
  { key: 'previa', label: 'Vista previa' },
  { key: 'resultado', label: 'Resultado' },
];

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50';

const BTN_OUTLINE =
  'inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-bg disabled:opacity-50';

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>('archivo');
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState<CsvAnalysis | null>(null);
  const [targets, setTargets] = useState<ImportColumnTarget[]>([]);
  const [result, setResult] = useState<FlexibleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // ------------------------------------------------ Paso 1: archivo
  function processFile(file: File | undefined | null): void {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name) && !/text\/(csv|plain)/.test(file.type)) {
      setError('El archivo debe ser un CSV (.csv). Si tienes un Excel, guárdalo como «CSV (delimitado por comas)» primero.');
      return;
    }
    setError(null);
    setFileName(file.name);
    startTransition(async () => {
      try {
        // Decodificación en el navegador: UTF-8 con/sin BOM o latin1 (Excel viejo).
        const text = decodeCsvBytes(await file.arrayBuffer());
        const analyzed = await analyzeCsvAction(text);
        if (!analyzed.ok) {
          setError(analyzed.error ?? 'No se pudo analizar el archivo.');
          return;
        }
        setContent(text);
        setAnalysis(analyzed);
        setTargets(analyzed.columns.map((column) => column.suggestion));
        setResult(null);
        setStep('mapeo');
      } catch {
        setError('No se pudo leer el archivo. Intenta nuevamente.');
      }
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    processFile(event.dataTransfer.files?.[0]);
  }

  // ------------------------------------------------ Validación del mapeo
  const nameColumnCount = targets.filter((target) => target === 'nombre').length;
  const duplicatedFields = useMemo(() => {
    const counts = new Map<string, number>();
    for (const target of targets) {
      if (target === 'etiqueta' || target === 'ignorar') continue;
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([field]) => field));
  }, [targets]);

  const mappingValid = nameColumnCount === 1 && duplicatedFields.size === 0;

  const mapping: ImportColumnMapping[] = useMemo(
    () =>
      analysis
        ? analysis.columns.map((column, position) => ({
            index: column.index,
            header: column.header,
            target: targets[position] ?? 'ignorar',
          }))
        : [],
    [analysis, targets],
  );

  // ------------------------------------------------ Vista previa mapeada
  const previewFields = useMemo(
    () => IMPORT_PATIENT_FIELDS.filter((field) => targets.includes(field.id)),
    [targets],
  );
  const tagColumns = useMemo(
    () =>
      analysis
        ? analysis.columns.filter((_, position) => targets[position] === 'etiqueta')
        : [],
    [analysis, targets],
  );

  function previewValue(row: string[], fieldId: string): string {
    if (!analysis) return '';
    const position = targets.findIndex((target) => target === fieldId);
    if (position < 0) return '';
    return row[position] ?? '';
  }

  const importNow = () => {
    setError(null);
    startTransition(async () => {
      try {
        const imported = await importWithMappingAction(content, mapping);
        setResult(imported);
        setStep('resultado');
      } catch {
        setError('No se pudo importar el archivo. Intenta nuevamente.');
      }
    });
  };

  const reset = () => {
    setStep('archivo');
    setFileName(null);
    setContent('');
    setAnalysis(null);
    setTargets([]);
    setResult(null);
    setError(null);
  };

  const stepIndex = STEP_LABELS.findIndex(({ key }) => key === step);

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2">
        {STEP_LABELS.map(({ key, label }, index) => (
          <li key={key} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                index === stepIndex
                  ? 'bg-primary text-white'
                  : index < stepIndex
                    ? 'bg-primary-light text-primary'
                    : 'bg-bg text-ink-soft'
              }`}
            >
              {index + 1}. {label}
            </span>
            {index < STEP_LABELS.length - 1 ? <span className="h-px w-4 bg-line" /> : null}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="flex items-start gap-2 rounded-card border-l-4 border-danger bg-surface p-4 text-sm text-ink shadow-card">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
          {error}
        </div>
      ) : null}

      {/* ---------------------------------------------- Paso archivo */}
      {step === 'archivo' ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Subir archivo CSV"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? 'border-primary bg-primary-light' : 'border-line bg-surface hover:border-primary'
          }`}
        >
          <FileUp size={32} className="mb-3 text-primary" />
          <p className="text-sm font-semibold text-primary">
            {pending ? 'Analizando archivo…' : 'Arrastra hasta aquí tu archivo CSV'}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            o haz clic para seleccionarlo · acepta separador con coma o punto y coma, UTF-8 o latin1
          </p>
          {fileName ? <p className="mt-2 text-xs font-medium text-ink">{fileName}</p> : null}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              processFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      ) : null}

      {/* ---------------------------------------------- Paso mapeo */}
      {step === 'mapeo' && analysis ? (
        <div className="space-y-4">
          <div className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-sm text-ink">
              <span className="font-semibold">{fileName}</span> · {analysis.totalRows}{' '}
              {analysis.totalRows === 1 ? 'fila de datos' : 'filas de datos'} · separador «
              {analysis.delimiter === '\t' ? 'tabulador' : analysis.delimiter}»
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              Indica a qué campo corresponde cada columna. Las columnas institucionales (programa,
              semestre, código…) puedes guardarlas como etiquetas del paciente.
            </p>
          </div>

          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-2.5">Columna del archivo</th>
                  <th className="px-4 py-2.5">Ejemplos</th>
                  <th className="px-4 py-2.5">Se importa como</th>
                </tr>
              </thead>
              <tbody>
                {analysis.columns.map((column, position) => {
                  const target = targets[position] ?? 'ignorar';
                  const duplicated =
                    target !== 'etiqueta' && target !== 'ignorar' && duplicatedFields.has(target);
                  return (
                    <tr key={column.index} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-2.5 font-medium text-ink">{column.header}</td>
                      <td className="max-w-48 truncate px-4 py-2.5 text-xs text-ink-soft">
                        {column.samples.length > 0 ? column.samples.join(' · ') : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          aria-label={`Destino de la columna ${column.header}`}
                          value={target}
                          onChange={(event) => {
                            const next = [...targets];
                            next[position] = event.target.value as ImportColumnTarget;
                            setTargets(next);
                          }}
                          className={`w-full max-w-72 rounded-lg border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-primary ${
                            duplicated ? 'border-danger' : 'border-line'
                          }`}
                        >
                          <optgroup label="Campos del paciente">
                            {IMPORT_PATIENT_FIELDS.map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.label}
                                {field.required ? ' *' : ''}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Otros destinos">
                            <option value="etiqueta">→ Etiqueta: «{column.header}»</option>
                            <option value="ignorar">No importar esta columna</option>
                          </optgroup>
                        </select>
                        {duplicated ? (
                          <p className="mt-1 text-xs text-danger">Campo asignado a más de una columna.</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {nameColumnCount !== 1 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle size={15} />
              {nameColumnCount === 0
                ? 'Asigna una columna al campo «Nombre completo» para continuar.'
                : 'Solo una columna puede ser «Nombre completo».'}
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <button type="button" onClick={reset} className={BTN_OUTLINE}>
              <ArrowLeft size={15} /> Elegir otro archivo
            </button>
            <button
              type="button"
              disabled={!mappingValid || pending}
              onClick={() => setStep('previa')}
              className={BTN_PRIMARY}
            >
              Ver vista previa <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------- Paso vista previa */}
      {step === 'previa' && analysis ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  {previewFields.map((field) => (
                    <th key={field.id} className="px-4 py-2.5">
                      {field.label}
                    </th>
                  ))}
                  {tagColumns.length > 0 ? <th className="px-4 py-2.5">Etiquetas</th> : null}
                </tr>
              </thead>
              <tbody>
                {analysis.previewRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b border-line last:border-b-0">
                    {previewFields.map((field) => (
                      <td key={field.id} className="px-4 py-2.5 text-ink">
                        {previewValue(row, field.id) || <span className="text-ink-soft">—</span>}
                      </td>
                    ))}
                    {tagColumns.length > 0 ? (
                      <td className="px-4 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {tagColumns.map((column) => {
                            const position = analysis.columns.findIndex(
                              (candidate) => candidate.index === column.index,
                            );
                            const value = (row[position] ?? '').trim();
                            if (!value) return null;
                            return (
                              <span
                                key={column.index}
                                className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                <Tag size={11} />
                                {column.header}: {value}
                              </span>
                            );
                          })}
                        </span>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-soft">
            Mostrando {analysis.previewRows.length} de {analysis.totalRows}{' '}
            {analysis.totalRows === 1 ? 'fila' : 'filas'}. Si algo no cuadra, regresa y ajusta el
            mapeo.
          </p>

          <div className="flex items-center justify-between">
            <button type="button" disabled={pending} onClick={() => setStep('mapeo')} className={BTN_OUTLINE}>
              <ArrowLeft size={15} /> Ajustar mapeo
            </button>
            <button type="button" disabled={pending} onClick={importNow} className={BTN_PRIMARY}>
              {pending
                ? 'Importando…'
                : `Importar ${analysis.totalRows} ${analysis.totalRows === 1 ? 'paciente' : 'pacientes'}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------- Paso resultado */}
      {step === 'resultado' && result ? (
        <div className="space-y-4">
          {result.importados > 0 ? (
            <div className="flex items-center gap-2 rounded-card border border-line bg-success-soft px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 size={18} />
              {result.importados === 1
                ? '¡Se importó 1 paciente exitosamente!'
                : `¡Se importaron ${result.importados} pacientes exitosamente!`}
              <Link href="/pacientes" className="ml-auto font-semibold underline">
                Ver pacientes
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-card border-l-4 border-danger bg-surface px-4 py-3 text-sm font-medium text-ink shadow-card">
              <AlertTriangle size={18} className="text-danger" />
              No se importó ningún paciente. Revisa el reporte de errores e intenta de nuevo.
            </div>
          )}

          {result.advertencias.length > 0 ? (
            <div className="rounded-card border border-line bg-warning-soft p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
                <AlertTriangle size={16} />
                Advertencias ({result.advertencias.length})
              </p>
              <ul className="space-y-1 text-sm text-ink">
                {result.advertencias.map((warning) => (
                  <li key={`${warning.fila}-${warning.motivo}`}>
                    <span className="font-semibold">Fila {warning.fila}:</span> {warning.motivo}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.errores.length > 0 ? (
            <div className="overflow-hidden rounded-card border border-line shadow-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-danger text-white">
                    <th className="w-20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Fila</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errores.map((rowError) => (
                    <tr
                      key={`${rowError.fila}-${rowError.motivo}`}
                      className="border-b border-line bg-danger-soft/40 last:border-b-0"
                    >
                      <td className="px-4 py-2.5 font-semibold text-ink">{rowError.fila}</td>
                      <td className="px-4 py-2.5 text-ink">{rowError.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line bg-surface px-4 py-2.5 text-xs text-ink-soft">
                Las filas con error no se importaron; corrígelas en tu archivo y vuelve a intentarlo.
              </p>
            </div>
          ) : null}

          {result.importados > 0 && result.errores.length === 0 && result.advertencias.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-ink-soft">
              <Users size={14} />
              Todos los registros se importaron sin observaciones.
            </p>
          ) : null}

          <button type="button" onClick={reset} className={BTN_OUTLINE}>
            Importar otro archivo
          </button>
        </div>
      ) : null}
    </div>
  );
}
