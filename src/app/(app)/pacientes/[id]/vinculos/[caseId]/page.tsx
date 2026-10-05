import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, ArrowLeft, Check, Lock, MessagesSquare, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { SqliteRelationalCaseRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRelationalCaseRepository';
import { SqliteCaseMemberRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseMemberRepository';
import { SqliteCaseSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseSessionNoteRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { Badge, Button, Card } from '@/components/ui';
import {
  MEMBER_RELATION_LABELS,
  MEMBER_RELATION_QUALITIES,
} from '@/contexts/clinical-records/domain/value-objects/caseProfile';
import {
  addCaseEventAction,
  addCaseMemberAction,
  addIndividualSessionAction,
  addJointSessionAction,
  grantConsentAction,
  recordScreeningAction,
  removeCaseEventAction,
  removeMemberRelationAction,
  setCaseObjectivesAction,
  setIdentifiedPatientAction,
  setMemberRoleAction,
  setSecretsPolicyAction,
  setSystemEvalAction,
  upsertMemberRelationAction,
} from '../actions';
import { PatientPicker } from '@/components/patients/PatientPicker';

/** Sugerencias de rol/parentesco para el datalist (el campo admite texto libre). */
const ROLE_SUGGESTIONS = ['Madre', 'Padre', 'Hijo/a', 'Hermano/a', 'Abuelo/a', 'Pareja', 'Cuidador/a', 'Otro'];

const SECRETS_LABEL: Record<string, string> = {
  no_secretos: 'Sin secretos: lo dicho a solas puede llevarse a la sesión conjunta si es relevante.',
  confidencialidad_limitada:
    'Confidencialidad limitada: se guarda lo dicho a solas, salvo lo que haga inviable la terapia conjunta.',
};

const SCREENING_LABEL: Record<string, { tone: 'neutral' | 'success' | 'warning' | 'danger'; label: string }> = {
  pendiente: { tone: 'neutral', label: 'Cribado pendiente' },
  sin_hallazgos: { tone: 'success', label: 'Sin hallazgos' },
  violencia_situacional: { tone: 'warning', label: 'Violencia situacional' },
  violencia_coercitiva: { tone: 'danger', label: 'Violencia coercitiva' },
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id, caseId } = await params;

  const relationalCase = await new SqliteRelationalCaseRepository(ownerUserId).findById(caseId);
  if (!relationalCase) notFound();
  const c = relationalCase.toPrimitives();

  const patients = new SqlitePatientRepository(ownerUserId);
  // Lectura de solo lectura (sin transacción): resolvemos los nombres en paralelo.
  const members = await Promise.all(
    (await new SqliteCaseMemberRepository(ownerUserId).listByCase(caseId)).map(async (m) => {
      const p = m.toPrimitives();
      const patient = await patients.findById(p.patientId);
      return { ...p, patientName: patient ? patient.toPrimitives().fullName : p.label || 'Paciente' };
    }),
  );

  // Familia: pacientes que aún no son miembros, para sumarlos al caso.
  const memberPatientIds = new Set(members.map((m) => m.patientId));
  const availableToAdd =
    c.kind === 'familia' && c.status === 'activo'
      ? (await new SearchPatients(patients).search(new SearchPatientsQuery({ archived: 'activos' })))
          .filter((p) => !memberPatientIds.has(p.id))
          .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
      : [];

  const base = `/pacientes/${id}/vinculos`;
  const everyConsent = members.length > 0 && members.every((m) => m.consentStatus === 'otorgado');
  const everyScreened = members.length > 0 && members.every((m) => m.screeningStatus !== 'pendiente');
  const canIndividual = c.status === 'activo' && c.secretsPolicy !== '';

  const nameByPatient = new Map(members.map((m) => [m.patientId, m.patientName]));
  const nameByMember = new Map(members.map((m) => [m.id, m.patientName]));
  const sessions = (await new SqliteCaseSessionNoteRepository(ownerUserId).listByCase(caseId)).map((s) => s.toPrimitives());
  const VISIBILITY_BADGE: Record<string, { tone: 'primary' | 'neutral' | 'danger'; label: string }> = {
    compartido: { tone: 'primary', label: 'Conjunta' },
    individual: { tone: 'neutral', label: 'Individual' },
    confidential: { tone: 'danger', label: 'Confidencial' },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={base} className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline">
          <ArrowLeft size={16} /> Vínculos
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Users size={18} className="text-primary dark:text-accent-2" /> {c.title}
        </h2>
        <Badge tone={c.status === 'contraindicado' ? 'danger' : c.status === 'cerrado' ? 'neutral' : 'success'}>
          {c.status === 'contraindicado' ? 'Contraindicado' : c.status === 'cerrado' ? 'Cerrado' : 'Activo'}
        </Badge>
        <Link
          href={`${base}/${caseId}/exportar`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
        >
          <ShieldCheck size={15} /> Exportar caso
        </Link>
      </div>

      {/* Saltar entre perfiles del caso (cómodo con familias de varios miembros). */}
      {members.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-bg/40 px-3 py-2">
          <span className="text-xs font-medium text-ink-soft">Saltar al perfil:</span>
          {members.map((m) =>
            m.patientId === id ? (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white"
              >
                {m.patientName} · aquí
              </span>
            ) : (
              <Link
                key={m.id}
                href={`/pacientes/${m.patientId}/vinculos/${caseId}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
              >
                {m.patientName}
              </Link>
            ),
          )}
        </div>
      ) : null}

      {c.status === 'contraindicado' ? (
        <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger-soft px-4 py-3">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-danger" />
          <div className="text-sm text-ink">
            <p className="font-semibold text-danger">Formato conjunto contraindicado</p>
            <p className="mt-0.5 text-ink-soft">{c.contraindicationReason}</p>
          </div>
        </div>
      ) : null}

      {/* Encuadre del caso */}
      <Card className="space-y-4">
        <h3 className="text-base font-bold text-ink">Encuadre del caso</h3>

        {/* 1. Política de secretos */}
        <div className="rounded-lg border border-line bg-bg/40 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Lock size={15} className="text-primary dark:text-accent-2" />
            <span className="text-sm font-semibold text-ink">Política de secretos</span>
            {c.secretsPolicy ? (
              <Badge tone="success">Acordada</Badge>
            ) : (
              <Badge tone="warning">Pendiente</Badge>
            )}
          </div>
          {c.secretsPolicy ? (
            <p className="text-sm text-ink-soft">{SECRETS_LABEL[c.secretsPolicy]}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink-soft">
                Decídela <strong>antes</strong> de las sesiones individuales. No tener política es lo
                único indefendible.
              </p>
              <form action={setSecretsPolicyAction.bind(null, id, caseId)} className="flex flex-col gap-2 sm:flex-row">
                <select
                  name="policy"
                  defaultValue=""
                  required
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                >
                  <option value="" disabled>
                    Elige la política…
                  </option>
                  <option value="no_secretos">Sin secretos</option>
                  <option value="confidencialidad_limitada">Confidencialidad limitada</option>
                </select>
                <Button type="submit">
                  Acordar política
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Estado del encuadre */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${everyConsent ? 'border-success bg-success-soft text-success' : 'border-line text-ink-soft'}`}>
            {everyConsent ? <Check size={12} /> : null} Consentimiento doble
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${c.secretsPolicy ? 'border-success bg-success-soft text-success' : 'border-line text-ink-soft'}`}>
            {c.secretsPolicy ? <Check size={12} /> : null} Política de secretos
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${everyScreened ? 'border-success bg-success-soft text-success' : 'border-line text-ink-soft'}`}>
            {everyScreened ? <Check size={12} /> : null} Cribado de violencia
          </span>
        </div>
        {c.status === 'contraindicado' ? null : (
          <p className="text-xs text-ink-soft">
            {canIndividual
              ? 'Encuadre listo: ya puedes iniciar las sesiones individuales (cribado de violencia por separado).'
              : 'Acuerda la política de secretos para habilitar las sesiones individuales.'}
          </p>
        )}
      </Card>

      {/* Evaluación del sistema (núcleo relacional del caso) */}
      <Card className="space-y-3">
        <h3 className="text-base font-bold text-ink">Evaluación del sistema</h3>
        <form action={setSystemEvalAction.bind(null, id, caseId)} className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-ink">Etapa del ciclo vital familiar</span>
            <textarea
              name="lifeCycleStage"
              rows={2}
              defaultValue={c.profile.systemEval.lifeCycleStage}
              placeholder="p. ej. familia con hijos adolescentes; nido vacío; pareja sin hijos…"
              className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Estructura (límites, jerarquías, alianzas y coaliciones)</span>
            <textarea
              name="structure"
              rows={2}
              defaultValue={c.profile.systemEval.structure}
              placeholder="Subsistemas, límites (rígidos/difusos), quién manda, alianzas y coaliciones…"
              className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Patrones de comunicación</span>
            <textarea
              name="communication"
              rows={2}
              defaultValue={c.profile.systemEval.communication}
              placeholder="Secuencias circulares, escaladas, triangulaciones, comunicación analógica…"
              className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-ink">Motivo de consulta del sistema</span>
            <textarea
              name="systemMotive"
              rows={2}
              defaultValue={c.profile.systemEval.systemMotive}
              placeholder="El motivo tal como lo plantea el sistema (distinto del de cada miembro)…"
              className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
          <Button type="submit">
            Guardar evaluación del sistema
          </Button>
        </form>
      </Card>

      {/* Objetivos (sistémicos) del caso */}
      <Card className="space-y-3">
        <h3 className="text-base font-bold text-ink">Objetivos del caso</h3>
        <form action={setCaseObjectivesAction.bind(null, id, caseId)} className="space-y-2">
          <textarea
            name="objectives"
            rows={3}
            defaultValue={c.profile.objectives}
            placeholder="Objetivos terapéuticos compartidos del sistema (no de un solo miembro)…"
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
          <Button type="submit">
            Guardar objetivos
          </Button>
        </form>
      </Card>

      <datalist id="role-suggestions">
        {ROLE_SUGGESTIONS.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>

      {/* Miembros: consentimiento + cribado por separado */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink-soft">Miembros (consentimiento y cribado por separado)</h3>
        {members.map((m) => {
          const screen = SCREENING_LABEL[m.screeningStatus] ?? SCREENING_LABEL.pendiente;
          return (
            <Card key={m.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg text-ink-soft">
                    <Users size={15} />
                  </span>
                  <span className="font-semibold text-ink">{m.patientName}</span>
                  {m.role ? <span className="text-xs text-ink-soft">· {m.role}</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {m.isIdentifiedPatient ? <Badge tone="primary">Paciente identificado</Badge> : null}
                  <Badge tone={m.consentStatus === 'otorgado' ? 'success' : 'warning'}>
                    {m.consentStatus === 'otorgado' ? 'Consentimiento otorgado' : 'Consentimiento pendiente'}
                  </Badge>
                  <Badge tone={screen.tone}>{screen.label}</Badge>
                </span>
              </div>

              {/* Rol/parentesco + paciente identificado */}
              <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
                <form action={setMemberRoleAction.bind(null, id, caseId, m.id)} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-xs text-ink-soft">
                    Rol / parentesco en el sistema
                    <input
                      type="text"
                      name="role"
                      list="role-suggestions"
                      defaultValue={m.role}
                      placeholder="p. ej. Madre"
                      className="mt-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
                  >
                    Guardar rol
                  </button>
                </form>
                <form action={setIdentifiedPatientAction.bind(null, id, caseId, m.id, !m.isIdentifiedPatient)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
                  >
                    {m.isIdentifiedPatient ? 'Quitar paciente identificado' : 'Marcar paciente identificado'}
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
                {m.consentStatus !== 'otorgado' ? (
                  <form action={grantConsentAction.bind(null, id, caseId, m.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
                    >
                      <Check size={14} /> Marcar consentimiento otorgado
                    </button>
                  </form>
                ) : null}

                <form action={recordScreeningAction.bind(null, id, caseId, m.id)} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-xs text-ink-soft">
                    Cribado de violencia (en sesión individual)
                    <select
                      name="status"
                      defaultValue=""
                      required
                      className="mt-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none"
                    >
                      <option value="" disabled>
                        Registrar resultado…
                      </option>
                      <option value="sin_hallazgos">Sin hallazgos</option>
                      <option value="violencia_situacional">Violencia situacional</option>
                      <option value="violencia_coercitiva">Violencia coercitiva (contraindica)</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2"
                  >
                    Registrar cribado
                  </button>
                </form>
              </div>
            </Card>
          );
        })}

        {/* Familia: añadir más miembros al caso (con búsqueda + alta rápida) */}
        {c.kind === 'familia' && c.status === 'activo' ? (
          <form
            action={addCaseMemberAction.bind(null, id, caseId)}
            className="space-y-3 rounded-card border border-dashed border-line bg-bg/40 p-4"
          >
            <p className="text-xs font-medium text-ink-soft">Añadir familiar al caso (otro paciente tuyo)</p>
            <PatientPicker
              patients={availableToAdd.map((patient) => ({ id: patient.id, fullName: patient.fullName }))}
              mode="single"
              fieldName="newPatientId"
              placeholder="Busca a un paciente por nombre…"
              emptyHint="No tienes más pacientes para añadir. Crea uno rápido aquí."
            />
            <Button type="submit">
              Añadir miembro
            </Button>
          </form>
        ) : null}
      </div>

      {/* Mapa de relaciones entre miembros */}
      {members.length >= 2 ? (
        <Card className="space-y-3">
          <h3 className="text-base font-bold text-ink">Mapa de relaciones</h3>
          {c.profile.relations.length > 0 ? (
            <ul className="space-y-1.5">
              {c.profile.relations.map((rel) => {
                const a = nameByMember.get(rel.aMemberId) ?? 'Miembro';
                const b = nameByMember.get(rel.bMemberId) ?? 'Miembro';
                return (
                  <li key={rel.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg/40 px-3 py-1.5 text-sm">
                    <span className="flex flex-wrap items-center gap-2 text-ink">
                      <span className="font-medium">
                        {a} — {b}
                      </span>
                      <Badge tone="neutral">{MEMBER_RELATION_LABELS[rel.quality]}</Badge>
                      {rel.note ? <span className="text-xs text-ink-soft">{rel.note}</span> : null}
                    </span>
                    <form action={removeMemberRelationAction.bind(null, id, caseId, rel.id)}>
                      <button type="submit" className="text-xs text-ink-soft hover:text-danger">
                        Quitar
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Aún no has registrado vínculos entre los miembros.</p>
          )}
          <form action={upsertMemberRelationAction.bind(null, id, caseId)} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <select name="aMemberId" defaultValue="" required className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none">
              <option value="" disabled>Miembro…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.patientName}</option>
              ))}
            </select>
            <span className="pb-1.5 text-xs text-ink-soft">y</span>
            <select name="bMemberId" defaultValue="" required className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none">
              <option value="" disabled>Miembro…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.patientName}</option>
              ))}
            </select>
            <select name="quality" defaultValue="cercano" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none">
              {MEMBER_RELATION_QUALITIES.map((q) => (
                <option key={q} value={q}>{MEMBER_RELATION_LABELS[q]}</option>
              ))}
            </select>
            <input type="text" name="note" placeholder="Nota (opcional)" className="min-w-[8rem] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none" />
            <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2">
              Guardar vínculo
            </button>
          </form>
        </Card>
      ) : null}

      {/* Línea de tiempo del sistema */}
      <Card className="space-y-3">
        <h3 className="text-base font-bold text-ink">Línea de tiempo del sistema</h3>
        {c.profile.events.length > 0 ? (
          <ol className="space-y-1.5">
            {[...c.profile.events]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((ev) => (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-bg/40 px-3 py-1.5 text-sm">
                  <span className="text-ink">
                    {ev.date ? <span className="font-mono text-xs text-ink-soft">{ev.date}</span> : null}{' '}
                    <span className="font-medium">{ev.title}</span>
                    {ev.note ? <span className="text-xs text-ink-soft"> — {ev.note}</span> : null}
                  </span>
                  <form action={removeCaseEventAction.bind(null, id, caseId, ev.id)}>
                    <button type="submit" className="text-xs text-ink-soft hover:text-danger">
                      Quitar
                    </button>
                  </form>
                </li>
              ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-soft">Sin eventos registrados (duelos, separaciones, nacimientos, crisis…).</p>
        )}
        <form action={addCaseEventAction.bind(null, id, caseId)} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <input type="text" name="date" placeholder="Fecha (2019, 2020-03…)" className="w-36 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none" />
          <input type="text" name="title" placeholder="Evento (p. ej. separación)" className="min-w-[10rem] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none" />
          <input type="text" name="note" placeholder="Nota (opcional)" className="min-w-[8rem] flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-primary focus:outline-none" />
          <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2">
            Añadir evento
          </button>
        </form>
      </Card>

      {/* Sesiones del caso: conjuntas (compartidas) e individuales (privadas/confidenciales) */}
      <Card className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <MessagesSquare size={17} className="text-primary dark:text-accent-2" /> Sesiones del caso
        </h3>

        {c.status === 'activo' ? (
          <form action={addJointSessionAction.bind(null, id, caseId)} className="space-y-2 rounded-lg border border-line bg-bg/40 p-4">
            <div className="flex items-center gap-2">
              <Badge tone="primary">Conjunta</Badge>
              <span className="text-xs text-ink-soft">Compartida con todo el caso</span>
            </div>
            <input
              type="text"
              name="title"
              placeholder="Título (p. ej. Sesión conjunta 1)"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
            <textarea
              name="content"
              rows={2}
              placeholder="El ciclo de interacción observado, acuerdos, tareas…"
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
            />
            {members.length > 0 ? (
              <fieldset className="rounded-lg border border-line bg-surface p-2.5">
                <legend className="px-1 text-xs font-medium text-ink-soft">
                  ¿Quién asistió? (subsistema; vacío = todos)
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-1.5 text-sm text-ink">
                      <input type="checkbox" name="attendees" value={m.id} className="accent-[var(--color-primary)]" />
                      {m.patientName}
                      {m.role ? <span className="text-xs text-ink-soft">({m.role})</span> : null}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <Button type="submit">
              Registrar sesión conjunta
            </Button>
          </form>
        ) : null}

        {canIndividual
          ? members.map((m) => (
              <form
                key={m.id}
                action={addIndividualSessionAction.bind(null, id, caseId, m.id)}
                className="space-y-2 rounded-lg border border-line bg-bg/40 p-4"
              >
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">Individual</Badge>
                  <span className="text-xs text-ink-soft">{m.patientName}</span>
                </div>
                <input
                  type="text"
                  name="title"
                  placeholder="Título"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                />
                <textarea
                  name="content"
                  rows={2}
                  placeholder="Historia personal, cribado en privado, ambivalencia, terceros…"
                  className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
                />
                <label className="flex items-start gap-2 text-xs text-ink-soft">
                  <input type="checkbox" name="confidential" className="mt-0.5 accent-[var(--color-primary)]" />
                  Marcar como confidencial: NUNCA se incluye en el export del caso ni se comparte con la otra persona.
                </label>
                <button type="submit" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary hover:text-primary dark:hover:text-accent-2">
                  Registrar sesión individual de {m.patientName}
                </button>
              </form>
            ))
          : c.status === 'activo'
            ? <p className="text-xs text-ink-soft">Acuerda la política de secretos para registrar sesiones individuales.</p>
            : null}

        {sessions.length === 0 ? (
          <p className="text-sm text-ink-soft">Aún no hay sesiones registradas en el caso.</p>
        ) : (
          <ol className="space-y-2">
            {sessions.map((s) => {
              const badge = VISIBILITY_BADGE[s.visibility] ?? VISIBILITY_BADGE.compartido;
              const who = s.patientId ? nameByPatient.get(s.patientId) ?? '' : '';
              const attendeeNames = s.attendees
                .map((memberId) => nameByMember.get(memberId))
                .filter((name): name is string => Boolean(name));
              return (
                <li key={s.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={badge.tone}>
                        {badge.label}
                        {who ? ` · ${who}` : ''}
                      </Badge>
                      <span className="font-semibold text-ink">{s.title}</span>
                    </span>
                    <span className="text-xs text-ink-soft">
                      {format(new Date(s.createdAt), 'd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                  {attendeeNames.length > 0 ? (
                    <p className="mt-1 text-xs text-ink-soft">Asistieron: {attendeeNames.join(', ')}</p>
                  ) : null}
                  {s.content ? (
                    <p className="mt-1 text-sm text-ink-soft">
                      {s.content.length > 160 ? `${s.content.slice(0, 160)}…` : s.content}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <p className="flex items-start gap-2 rounded-card border border-line bg-bg/40 px-4 py-3 text-xs text-ink-soft">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />
        El cribado de violencia se hace SIEMPRE por separado, nunca con la otra persona presente. Un
        patrón de control coercitivo contraindica el formato conjunto: corresponde atención individual
        por vías separadas y derivación a protección.
      </p>
    </div>
  );
}
