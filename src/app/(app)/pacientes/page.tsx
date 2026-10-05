import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Download,
  Eye,
  Lock,
  Plus,
  Upload,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader } from '@/components/ui';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { ExportPatientsCsv } from '@/contexts/patients/application/export-patients-csv/ExportPatientsCsv';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SqliteActiveDiagnosisReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteActiveDiagnosisReader';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import {
  forbidProfessorRole,
  isAssistantUser,
  resolveDataOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';
import { listPatientsSharedWithMe } from '@/shared/infrastructure/auth/patientShares';
import { archivePatientAction, restorePatientAction } from './actions';
import { PatientFilters } from './PatientFilters';

export const dynamic = 'force-dynamic';

interface PacientesSearchParams {
  q?: string;
  archivados?: string;
  etiqueta?: string;
  genero?: string;
  diagnostico?: string;
  ultima?: string;
  proxima?: string;
  creado?: string;
  aviso?: string;
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<PacientesSearchParams>;
}) {
  // El profesor (supervisa, no atiende) no tiene cartera propia: su lugar es /supervision.
  await forbidProfessorRole();
  const sessionUserId = await requireSessionUserId();
  // Asistente (v3 §4): opera la cartera del titular, pero sin ver diagnósticos.
  const assistantView = await isAssistantUser(sessionUserId);
  const ownerUserId = await resolveDataOwnerUserId(sessionUserId);
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  // Compatibilidad: la query histórica usaba `archivados=1`; el panel usa
  // `archivados=archivados|todos`. El asistente nunca filtra por diagnóstico.
  const archivedParam = params.archivados === '1' ? 'todos' : params.archivados;
  const showArchived = archivedParam === 'archivados' || archivedParam === 'todos';
  const createdName = (params.creado ?? '').trim();

  const repository = new SqlitePatientRepository(ownerUserId);
  const items = await new SearchPatients(repository).search(
    new SearchPatientsQuery({
      text: q,
      archived: archivedParam,
      tag: params.etiqueta,
      gender: params.genero,
      diagnosis: assistantView ? undefined : params.diagnostico,
      lastSession: params.ultima,
      nextAppointment: params.proxima,
    }),
  );
  const knownTags = await repository.distinctTags();

  // Para el estado vacío: distingue "sin pacientes" de "los filtros no devuelven nada".
  const hasActiveFilters =
    q.length > 0 ||
    showArchived ||
    Boolean(params.etiqueta) ||
    Boolean(params.genero) ||
    (params.diagnostico && params.diagnostico !== 'todos') ||
    (params.ultima && params.ultima !== 'todos') ||
    (params.proxima && params.proxima !== 'todos');

  const csv = await new ExportPatientsCsv(repository).exportAll();
  const exportHref = `data:text/csv;charset=utf-8;base64,${Buffer.from(csv, 'utf8').toString('base64')}`;

  // Spec v2 §6.11: diagnóstico activo más reciente por paciente (columna
  // Diagnóstico). Contenido clínico: oculto para el rol asistente (v3 §4).
  const activeDiagnoses = assistantView
    ? null
    : await new SqliteActiveDiagnosisReader(ownerUserId).latestForAllPatients();

  // Expedientes que un colega me compartió en solo lectura (Ajustes › Compartir). Se
  // acota al usuario REAL en sesión (no al titular): un asistente nunca es receptor.
  const sharedWithMe = assistantView ? [] : await listPatientsSharedWithMe(sessionUserId);

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle="Busca y filtra tu cartera"
        actions={
          <>
            <a
              href={exportHref}
              download="pacientes.csv"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-bg"
            >
              <Download size={16} />
              Exportar
            </a>
            <Link
              href="/pacientes/importar"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-bg"
            >
              <Upload size={16} />
              Importar
            </Link>
            <Link
              href="/pacientes/nuevo"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <Plus size={16} />
              Nuevo paciente
            </Link>
          </>
        }
      />

      {createdName ? (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-line bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 size={18} />
          ¡Se ha creado al paciente {createdName} exitosamente!
        </div>
      ) : null}

      {params.aviso === 'expediente' ? (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-line bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          <Lock size={18} />
          Solo el profesional accede al expediente clínico. Tu perfil de asistente puede ver y editar
          los datos de contacto, la agenda y los pagos.
        </div>
      ) : null}

      <PatientFilters
        knownTags={knownTags}
        resultCount={items.length}
        showDiagnosis={!assistantView}
      />

      {items.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            title="Sin resultados"
            description="Ningún paciente coincide con los filtros seleccionados."
          />
        ) : (
          <EmptyState
            title="Sin pacientes"
            description="Todavía no tienes pacientes registrados."
            action={
              <Link
                href="/pacientes/nuevo"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                <Plus size={16} />
                Nuevo paciente
              </Link>
            }
          />
        )
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Correo</th>
                <th className="px-5 py-3">Teléfono</th>
                {activeDiagnoses ? <th className="px-5 py-3">Diagnóstico</th> : null}
                <th className="px-5 py-3">Etiquetas</th>
                <th className="px-5 py-3">Fecha de alta</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((patient) => (
                <tr
                  key={patient.id}
                  className={`border-b border-line last:border-b-0 ${patient.archived ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                        {initials(patient.fullName)}
                      </span>
                      <Link
                        href={`/pacientes/${patient.id}`}
                        className="font-medium text-ink transition hover:text-primary dark:hover:text-accent-2 hover:underline"
                      >
                        {patient.fullName}
                      </Link>
                      {patient.archived ? <Badge tone="neutral">Archivado</Badge> : null}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{patient.email || '—'}</td>
                  <td className="px-5 py-3">
                    {patient.phone ? (
                      <span
                        className={patient.phoneReachableByWhatsApp ? 'text-ink' : 'text-danger'}
                        title={
                          patient.phoneReachableByWhatsApp
                            ? undefined
                            : 'Teléfono inválido: no llegarán mensajes de WhatsApp'
                        }
                      >
                        {patient.phone}
                      </span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  {activeDiagnoses ? (
                  <td className="px-5 py-3">
                    {(() => {
                      const diagnosis = activeDiagnoses.get(patient.id);
                      return diagnosis ? (
                        <Badge tone="primary">
                          <span className="font-mono">{diagnosis.cie11Code}</span>
                          <span
                            className="max-w-40 truncate"
                            title={diagnosis.cie11Title}
                          >
                            {diagnosis.cie11Title}
                          </span>
                        </Badge>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      );
                    })()}
                  </td>
                  ) : null}
                  <td className="px-5 py-3">
                    {patient.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {patient.tags.map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-soft">
                    {format(new Date(patient.createdAt), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end">
                      {patient.archived ? (
                        <form action={restorePatientAction.bind(null, patient.id)}>
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            title="Restaurar paciente"
                            className="px-2.5"
                          >
                            <ArchiveRestore size={14} />
                            Restaurar
                          </Button>
                        </form>
                      ) : (
                        <form action={archivePatientAction.bind(null, patient.id)}>
                          <button
                            type="submit"
                            title="Archivar paciente"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-danger-soft hover:text-danger"
                          >
                            <Archive size={14} />
                            Archivar
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {items.length === 0 && !hasActiveFilters ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
          <Users size={14} />
          ¿Tienes una lista en Excel? Guárdala como CSV e impórtala desde «Importar».
        </p>
      ) : null}

      {sharedWithMe.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Eye size={18} className="text-primary dark:text-accent-2" />
            <h2 className="text-lg font-bold text-ink">Compartidos conmigo</h2>
            <span className="text-sm text-ink-soft">· solo lectura, de colegas de tu organización</span>
          </div>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-line">
              {sharedWithMe.map((shared) => (
                <li key={shared.id}>
                  <Link
                    href={`/pacientes/${shared.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-bg"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                      {initials(shared.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {shared.fullName}
                        {shared.archived ? <span className="text-ink-soft"> · archivado</span> : null}
                      </p>
                      <p className="truncate text-xs text-ink-soft">Compartido por {shared.ownerName}</p>
                    </div>
                    <Badge tone="primary">Solo lectura</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
