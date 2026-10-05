import type { ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  FileDown,
  FilePlus2,
  FileSignature,
  FileText,
  History,
  Layers,
  Lock,
  Plus,
} from 'lucide-react';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqlitePatientBookingsReader } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientBookingsReader';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { assembleExpedienteInput } from '@/contexts/clinical-records/application/create-expediente-report/assembleExpedienteInput';
import { ListSessionNotes } from '@/contexts/clinical-records/application/list-session-notes/ListSessionNotes';
import { GetLatestPatientConsent } from '@/contexts/clinical-records/application/get-patient-consent/GetLatestPatientConsent';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { isConsentGranted } from '@/contexts/clinical-records/domain/value-objects/consentStatus';
import type { SessionNotePrimitives } from '@/contexts/clinical-records/domain/SessionNote';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import {
  SESSION_KIND_LABELS,
  SESSION_KINDS,
  sessionKindForTemplateId,
  sessionTemplateForKind,
} from '@/contexts/clinical-records/domain/sessionTemplates';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { Badge, Button, Card } from '@/components/ui';
import { RecordForm } from './RecordForm';
import { DocumentoView } from './DocumentoView';
import { SessionTimeline, type TimelineItem } from './SessionTimeline';
import { SessionEditor } from '../sesiones/[noteId]/SessionEditor';
import { DeleteRecordButton } from './DeleteRecordButton';
import { SessionArchiveButton } from './SessionArchiveButton';
import { ChangeModelButton } from './ChangeModelButton';
import { OpenNewExpedienteButton } from './OpenNewExpedienteButton';
import { createNoteAction } from '../sesiones/actions';

type Vista = 'evolucion' | 'documento';

/** Resumen breve de una sesión para la línea de tiempo de Evolución. */
function evolucionPreview(note: SessionNotePrimitives): string {
  const flat = note.content.replace(/\s+/g, ' ').trim();
  if (flat) return flat.length > 180 ? `${flat.slice(0, 180)}…` : flat;
  const values = Object.values(note.answers)
    .map((value) => (Array.isArray(value) ? value.join(', ') : value).trim())
    .filter((value) => value !== '');
  const joined = values.slice(0, 2).join(' · ');
  if (joined) return joined.length > 180 ? `${joined.slice(0, 180)}…` : joined;
  return 'Sesión sin contenido todavía.';
}

/**
 * Pestaña "Expediente" (fusiona Historia clínica + Sesiones). Abre en la vista
 * EVOLUCIÓN (la casa: registrar sesiones, línea de tiempo, próxima cita y, si no
 * existe aún, "Iniciar historia clínica"). La vista DOCUMENTO (a la derecha) es
 * el expediente consolidado: núcleo + bloques. Las sesiones SON la historia, así
 * que aparecen siempre en la Evolución.
 */
export default async function ExpedientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string; sel?: string; sesion?: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const sp = await searchParams;
  const vista: Vista = sp.vista === 'documento' ? 'documento' : 'evolucion';
  const base = `/pacientes/${id}/historia`;

  const recordsRepo = new SqliteClinicalRecordRepository(ownerUserId);
  // Expediente VIGENTE (activo) = la primaria abierta más reciente. Pueden coexistir
  // varias abiertas (episodios sin sellar); las demás son "otros expedientes abiertos".
  const activeId = (await recordsRepo.findPrimaryHistory(id))?.recordId() ?? null;
  const hasHistory = activeId !== null;

  // Aviso de coherencia (v3 §2): banner NO bloqueante si falta el consentimiento.
  const consent = await new GetLatestPatientConsent(new SqlitePatientConsentRepository(ownerUserId)).execute(id);
  const hasConsent = consent !== null && isConsentGranted(consent.status);

  let body: ReactNode;

  if (vista === 'documento') {
    // Documento = vista VIVA derivada: la compilación de TODO el expediente
    // (núcleo + bloques de la historia + cada sesión de la Evolución con sus
    // bloques + diagnósticos). Es de SOLO LECTURA y se reensambla en cada carga,
    // así que siempre refleja la Evolución; se edita en la pestaña Evolución y se
    // congela/firma desde "Exportar". No se auto-crea la historia.
    const expedienteInput = await assembleExpedienteInput(
      {
        patients: new SqlitePatientDirectory(ownerUserId),
        records: recordsRepo,
        notes: new SqliteSessionNoteRepository(ownerUserId),
        diagnoses: new SqliteDiagnosisRepository(ownerUserId),
        identity: new SqliteProfessionalIdentityReader(ownerUserId),
      },
      id,
      new Date().toISOString(),
    );
    const allRecords = (await recordsRepo.listByPatient(id)).map((record) => record.toPrimitives());
    const otros = allRecords.filter((record) => record.kind !== 'historia');
    // Expedientes anteriores: historias primarias selladas (solo lectura).
    const selladas = allRecords
      .filter((record) => record.kind === 'historia' && record.closedAt)
      .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
    // Otros expedientes ABIERTOS (episodios que coexisten): editables, distintos de la
    // vista de arriba (que es la del expediente vigente/activo).
    const otrosAbiertos = allRecords
      .filter((record) => record.kind === 'historia' && !record.closedAt && record.id !== activeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    body = (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/30 dark:bg-primary/15 px-4 py-2.5">
          <p className="flex items-center gap-2 text-sm text-ink">
            <FileText size={16} className="text-primary dark:text-accent-2" />
            <span className="font-medium">Vista del expediente completo</span>
            <span className="text-xs text-ink-soft">— se actualiza solo con lo que registras en Evolución</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!hasHistory ? (
              <Link
                href={`${base}/nueva?primaria=1`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
              >
                <FilePlus2 size={14} /> Iniciar historia clínica
              </Link>
            ) : null}
            <Link
              href={`/pacientes/${id}/exportar`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark"
            >
              <FileDown size={14} /> Exportar / Firmar PDF
            </Link>
          </div>
        </div>

        {expedienteInput ? (
          <DocumentoView input={expedienteInput} />
        ) : (
          <p className="rounded-card border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink-soft">
            No se pudo cargar el expediente.
          </p>
        )}

        {otrosAbiertos.length > 0 ? (
          <div className="border-t border-line pt-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
              <Layers size={14} /> Otros expedientes abiertos
            </h3>
            <div className="space-y-2">
              {otrosAbiertos.map((record) => (
                <Card key={record.id} className="transition-shadow hover:shadow-md">
                  <Link href={`${base}/${record.id}`} className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                      <FileText size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{record.title}</p>
                      <p className="text-xs text-ink-soft">
                        Abierto · episodio anterior (sigue editable)
                      </p>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {selladas.length > 0 ? (
          <div className="border-t border-line pt-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
              <Lock size={14} /> Expedientes anteriores
            </h3>
            <div className="space-y-2">
              {selladas.map((record) => (
                <Card key={record.id} className="transition-shadow hover:shadow-md">
                  <Link href={`${base}/${record.id}`} className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-ink-soft">
                      <Lock size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{record.title}</p>
                      <p className="text-xs text-ink-soft">
                        Sellado el{' '}
                        {format(new Date(record.closedAt ?? record.updatedAt), "d 'de' MMMM 'de' yyyy", {
                          locale: es,
                        })}{' '}
                        · solo lectura
                      </p>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        {otros.length > 0 ? (
          <div className="border-t border-line pt-4">
            <h3 className="mb-3 text-sm font-semibold text-ink-soft">Registros aparte</h3>
            <div className="space-y-2">
              {otros.map((record) => (
                <Card key={record.id} className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`${base}/${record.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg text-ink-soft">
                        <ClipboardList size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{record.title}</p>
                        <p className="text-xs text-ink-soft">
                          Actualizado el{' '}
                          {format(new Date(record.updatedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                        </p>
                      </div>
                    </Link>
                    <DeleteRecordButton recordId={record.id} patientId={id} recordTitle={record.title} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  } else {
    const notesRepo = new SqliteSessionNoteRepository(ownerUserId);
    const sessionNotes = new ListSessionNotes(notesRepo);
    // Orden manual (P8): position ASC = orden de lectura (más antigua arriba),
    // el mismo del Documento. Reordenable arrastrando en SessionTimeline.
    const notes = (await sessionNotes
      .execute(id))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt.localeCompare(b.createdAt));
    const archivedNotes = (await sessionNotes.executeArchived(id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const primary = await recordsRepo.findPrimaryHistory(id);
    const primaryPrimitives = primary ? primary.toPrimitives() : null;
    const bookings = await new SqlitePatientBookingsReader(ownerUserId).listByPatient(id);
    const nowIso = new Date().toISOString();
    const proxima = bookings
      .filter((b) => b.startAt > nowIso && (b.status === 'agendada' || b.status === 'confirmada'))
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    const payByBooking = new Map(bookings.map((b) => [b.bookingId, b.paymentStatus]));
    // Datos precomputados de cada viñeta para la línea de tiempo (cliente, drag).
    const timelineItems: TimelineItem[] = notes.map((note) => {
      const tecnicas = Array.isArray(note.answers['tecnicas']) ? (note.answers['tecnicas'] as string[]) : [];
      const riesgoRaw = note.answers['riesgo-nivel'];
      const riesgo =
        typeof riesgoRaw === 'string' && riesgoRaw !== '' && riesgoRaw !== 'Sin riesgo' ? riesgoRaw : null;
      const pagoStatus = note.bookingId ? payByBooking.get(note.bookingId) : undefined;
      return {
        id: note.id,
        title: note.title,
        sessionKind: note.sessionKind,
        hasTemplate: note.templateId !== null,
        createdAt: note.createdAt,
        preview: evolucionPreview(note),
        tecnicas,
        riesgo,
        pago: pagoStatus === 'pagada' ? 'pagada' : pagoStatus ? 'pendiente' : null,
        blockCount: note.sections?.length ?? 0,
      };
    });
    const allRecordsEvo = (await recordsRepo.listByPatient(id)).map((record) => record.toPrimitives());
    const registrosAparte = allRecordsEvo
      .filter((record) => record.kind !== 'historia')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    // Expedientes anteriores: historias primarias selladas (solo lectura).
    const selladas = allRecordsEvo
      .filter((record) => record.kind === 'historia' && record.closedAt)
      .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
    // Otros expedientes ABIERTOS (episodios que coexisten, distintos del vigente).
    const otrosAbiertos = allRecordsEvo
      .filter((record) => record.kind === 'historia' && !record.closedAt && record.id !== activeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // Maestro-detalle: ?sesion=<id> selecciona esa sesión; ?sel=historia la
    // historia; por defecto la historia si existe, si no, un estado vacío.
    let selectedNote: SessionNotePrimitives | null = null;
    if (sp.sesion) {
      const note = await notesRepo.findById(sp.sesion);
      if (note && note.belongsTo(id)) selectedNote = note.toPrimitives();
    }
    // ?sesion=<id> presente pero no resuelto (id inexistente o de otro paciente):
    // se avisa en vez de caer mudo a la historia (la URL no debe "mentir").
    const sesionNotFound = Boolean(sp.sesion) && selectedNote === null;
    const selectedArchived = selectedNote?.archived ?? false;
    const detailKind: 'historia' | 'sesion' | 'none' = selectedNote
      ? 'sesion'
      : sp.sel === 'historia'
        ? 'historia'
        : hasHistory
          ? 'historia'
          : 'none';

    // ----- Panel derecho (detalle) -----
    let detail: ReactNode;
    if (sesionNotFound) {
      detail = (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
          <AlertTriangle size={24} className="text-warning" />
          <p className="text-sm font-medium text-ink">No se encontró la sesión</p>
          <p className="max-w-xs text-xs text-ink-soft">
            La sesión solicitada no existe o no pertenece a este paciente.
          </p>
          <Link href={`${base}?vista=evolucion`} className="mt-1 text-xs font-medium text-primary dark:text-accent-2 hover:underline">
            Volver a la Evolución
          </Link>
        </div>
      );
    } else if (detailKind === 'sesion' && selectedNote) {
      const noteKind = sessionKindForTemplateId(selectedNote.templateId);
      const template = noteKind ? sessionTemplateForKind(noteKind) : null;
      const noteSections: ClinicalSection[] = [
        ...(template?.sections ?? []),
        ...(selectedNote.sections ?? []),
      ];
      detail = (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-ink">
              <span className="truncate">{selectedNote.title}</span>
              {noteKind ? <Badge tone="primary">{SESSION_KIND_LABELS[noteKind]}</Badge> : null}
              {selectedArchived ? <Badge tone="neutral">Archivada</Badge> : null}
            </h2>
            <div className="flex items-center gap-2">
              {selectedArchived ? (
                <SessionArchiveButton noteId={selectedNote.id} patientId={id} archived />
              ) : null}
              <Link
                href={`/pacientes/${id}/sesiones/${selectedNote.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
              >
                <ExternalLink size={14} /> Abrir sesión completa
              </Link>
            </div>
          </div>
          {selectedArchived ? (
            <div className="flex items-center gap-2 rounded-card border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-ink">
              <Archive size={14} className="shrink-0 text-warning" />
              Esta sesión está archivada (fuera de la Evolución). Restáurala para volver a incluirla en el
              expediente.
            </div>
          ) : null}
          <SessionEditor
            // key por nota: al cambiar de sesión en el maestro-detalle (navegación suave
            // ?sesion=), remonta el editor para re-sembrar título/contenido/respuestas desde
            // las props; sin esto el estado del editor anterior quedaba "pegado" (solo el
            // encabezado del servidor cambiaba, no el contenido).
            key={selectedNote.id}
            compact
            noteId={selectedNote.id}
            patientId={id}
            structuredTitle={template?.name ?? 'Estructura de la sesión'}
            structuredDescription={
              template?.description ??
              'Añade bloques (técnicas, evaluaciones, procesos) a esta sesión.'
            }
            sections={noteSections}
            initialAnswers={selectedNote.answers}
            initialTitle={selectedNote.title}
            initialContent={selectedNote.content}
            createdAt={selectedNote.createdAt}
          />
        </div>
      );
    } else if (detailKind === 'historia' && primaryPrimitives) {
      detail = (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-ink">Historia clínica</h2>
            <div className="flex items-center gap-2">
              <ChangeModelButton recordId={primaryPrimitives.id} patientId={id} />
              <DeleteRecordButton
                recordId={primaryPrimitives.id}
                patientId={id}
                recordTitle={primaryPrimitives.title}
                redirectToList
              />
            </div>
          </div>
          <RecordForm
            recordId={primaryPrimitives.id}
            patientId={id}
            title={primaryPrimitives.title}
            description="El núcleo de la historia clínica y los bloques por enfoque que añadas."
            sections={primaryPrimitives.sections ?? []}
            initialAnswers={primaryPrimitives.answers}
            enableBlocks
          />
        </div>
      );
    } else {
      detail = (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
          <Layers size={24} className="text-ink-soft" />
          <p className="text-sm font-medium text-ink">Selecciona algo para verlo aquí</p>
          <p className="max-w-xs text-xs text-ink-soft">
            Elige la historia clínica o una sesión de la izquierda para ver y editar sus bloques.
          </p>
        </div>
      );
    }

    // ----- Panel izquierdo (maestro) -----
    const master = (
      <div className="space-y-4">
        {!hasHistory ? (
          <Link
            href={`${base}/nueva?primaria=1`}
            className="flex flex-wrap items-center gap-2.5 rounded-card border border-primary/40 dark:border-accent-2/25 bg-primary-light/50 dark:bg-primary/20 px-3.5 py-3 transition hover:bg-primary-light"
          >
            <FilePlus2 size={18} className="shrink-0 text-primary dark:text-accent-2" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-primary dark:text-accent-2">Iniciar historia clínica</span>
              <span className="block text-xs text-ink-soft">Elige un modelo terapéutico.</span>
            </span>
          </Link>
        ) : null}

        {hasHistory ? <OpenNewExpedienteButton patientId={id} /> : null}

        <div className="rounded-card border border-line bg-surface p-3.5">
          <form action={createNoteAction.bind(null, id)} className="space-y-2">
            <select
              name="sessionKind"
              defaultValue="seguimiento"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              aria-label="Tipo de sesión"
            >
              {SESSION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {SESSION_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="title"
              placeholder="Título (opcional)"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
            <Button type="submit" className="w-full">
              <Plus size={16} /> Registrar sesión
            </Button>
          </form>
          {proxima ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft">
              <CalendarClock size={13} className="text-primary dark:text-accent-2" /> Próxima cita:{' '}
              {format(new Date(proxima.startAt), 'EEE d MMM · HH:mm', { locale: es })}
            </p>
          ) : null}
        </div>

        <SessionTimeline
          patientId={id}
          base={base}
          selectedId={selectedNote?.id ?? null}
          items={timelineItems}
          historia={
            primaryPrimitives
              ? { modelTitle: primaryPrimitives.title.replace(/^historia cl[ií]nica\s*·?\s*/i, '').trim() }
              : null
          }
          historiaSelected={detailKind === 'historia'}
        />

        {archivedNotes.length > 0 ? (
          <details className="rounded-card border border-line bg-surface" open={selectedArchived || undefined}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-ink-soft hover:text-ink">
              <Archive size={14} /> Sesiones archivadas ({archivedNotes.length})
            </summary>
            <div className="space-y-1.5 border-t border-line px-3.5 py-2.5">
              {archivedNotes.map((note) => {
                const selected = selectedNote?.id === note.id;
                return (
                  <div
                    key={note.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                      selected ? 'border-primary bg-primary-light/40 dark:bg-primary/15 ring-1 ring-primary/30' : 'border-line bg-bg/40'
                    }`}
                  >
                    <Link
                      href={`${base}?vista=evolucion&sesion=${note.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-xs"
                    >
                      <span className="truncate font-medium text-ink">{note.title}</span>
                      <span className="shrink-0 text-ink-soft">
                        {format(new Date(note.createdAt), 'd MMM yyyy', { locale: es })}
                      </span>
                    </Link>
                    <SessionArchiveButton noteId={note.id} patientId={id} archived />
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}

        {otrosAbiertos.length > 0 ? (
          <details className="rounded-card border border-line bg-surface" open>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-ink-soft hover:text-ink">
              <Layers size={14} /> Otros expedientes abiertos ({otrosAbiertos.length})
            </summary>
            <div className="space-y-1.5 border-t border-line px-3.5 py-2.5">
              {otrosAbiertos.map((record) => (
                <Link
                  key={record.id}
                  href={`${base}/${record.id}`}
                  className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-xs text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
                >
                  <FileText size={13} className="shrink-0 text-primary dark:text-accent-2" />
                  <span className="min-w-0 flex-1 truncate font-medium">{record.title}</span>
                  <span className="shrink-0 text-ink-soft">
                    {format(new Date(record.createdAt), 'd MMM yyyy', { locale: es })}
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ) : null}

        {selladas.length > 0 ? (
          <details className="rounded-card border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-ink-soft hover:text-ink">
              <Lock size={14} /> Expedientes anteriores ({selladas.length})
            </summary>
            <div className="space-y-1.5 border-t border-line px-3.5 py-2.5">
              {selladas.map((record) => (
                <Link
                  key={record.id}
                  href={`${base}/${record.id}`}
                  className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-xs text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
                >
                  <Lock size={13} className="shrink-0 text-ink-soft" />
                  <span className="min-w-0 flex-1 truncate font-medium">{record.title}</span>
                  <span className="shrink-0 text-ink-soft">
                    {format(new Date(record.closedAt ?? record.updatedAt), 'd MMM yyyy', { locale: es })}
                  </span>
                </Link>
              ))}
            </div>
          </details>
        ) : null}

        <details className="rounded-card border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-ink-soft hover:text-ink">
            <Layers size={14} /> Registros aparte ({registrosAparte.length})
          </summary>
          <div className="space-y-1.5 border-t border-line px-3.5 py-2.5">
            {registrosAparte.map((record) => (
              <Link
                key={record.id}
                href={`${base}/${record.id}`}
                className="flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-2.5 py-1.5 text-xs text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
              >
                <ClipboardList size={13} className="shrink-0 text-ink-soft" />
                <span className="truncate font-medium">{record.title}</span>
              </Link>
            ))}
            <Link
              href={`${base}/nueva`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
            >
              <Plus size={13} /> Abrir registro aparte
            </Link>
          </div>
        </details>
      </div>
    );

    body = (
      <div className="grid items-start gap-5 lg:grid-cols-[20rem_1fr]">
        {master}
        <div className="min-w-0">{detail}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!hasConsent ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <FileSignature size={16} className="shrink-0 text-warning" />
            {consent && consent.status === 'pendiente'
              ? 'El consentimiento informado de este paciente sigue pendiente de firma.'
              : 'Este paciente aún no tiene consentimiento informado firmado.'}
          </p>
          <Link
            href={`/pacientes/${id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
          >
            Gestionar consentimiento
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-line">
          <Link
            href={`${base}?vista=evolucion`}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              vista === 'evolucion' ? 'bg-primary-light text-primary' : 'bg-surface text-ink-soft hover:text-ink'
            }`}
          >
            <History size={15} /> Evolución
          </Link>
          <Link
            href={`${base}?vista=documento`}
            className={`inline-flex items-center gap-1.5 border-l border-line px-4 py-2 text-sm font-medium transition-colors ${
              vista === 'documento' ? 'bg-primary-light text-primary' : 'bg-surface text-ink-soft hover:text-ink'
            }`}
          >
            <FileText size={15} /> Documento
          </Link>
        </div>
        <Link
          href={`/pacientes/${id}/exportar`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
        >
          <FileDown size={15} /> Historia clínica completa
        </Link>
      </div>

      {body}
    </div>
  );
}
