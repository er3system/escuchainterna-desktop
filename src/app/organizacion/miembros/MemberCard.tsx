'use client';

import { startTransition, useActionState, useState, useTransition } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  FileDown,
  LogOut,
  Save,
  UserCheck,
  UserX,
} from 'lucide-react';
import type { MembershipPermissionsPrimitives } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { Button } from '@/components/ui';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import {
  assignMemberConsultorioAction,
  offboardMemberAction,
  setMemberActiveAction,
  updateMemberPermissionsAction,
  type UpdatePermissionsState,
} from '../actions';
import { PermissionsFields } from './PermissionsFields';

export interface MemberCardData {
  userId: string;
  fullName: string;
  email: string;
  /** Tarjeta profesional: si está vacía, el miembro no puede firmar/certificar documentos. */
  professionalLicense: string;
  memberRole: 'master' | 'professor' | 'psychologist';
  status: 'activo' | 'suspendido';
  permissions: MembershipPermissionsPrimitives;
  patientCount: number;
  /** Consultorio del miembro (null = sin consultorio). Fase 1: solo pertenencia. */
  consultorioId: string | null;
  consultorioName: string | null;
}

export interface ConsultorioOption {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<MemberCardData['memberRole'], string> = {
  master: 'Perfil maestro',
  professor: 'Profesor/a',
  psychologist: 'Psicólogo/a',
};

function permissionSummary(permissions: MembershipPermissionsPrimitives): string {
  const parts: string[] = [];
  if (permissions.paymentsDisabled || !permissions.canCharge) parts.push('sin pagos');
  else {
    if (permissions.retentionPercent > 0)
      parts.push(`liquidación interna ${permissions.retentionPercent}%`);
    if (permissions.forceAppPayments) parts.push('pago al agendar');
  }
  if (permissions.canSupervisePatients) parts.push('supervisor/a');
  if (!permissions.canConfigurePayments) parts.push('tarifas fijadas por la org');
  return parts.length > 0 ? parts.join(' · ') : 'permisos estándar';
}

/** Fila/expandible de un miembro: resumen, editor de permisos y activar/desactivar. */
export function MemberCard({
  member,
  institutional = false,
  consultorios = [],
  desktopEdition = false,
}: {
  member: MemberCardData;
  /** true = cuenta institucional: ofrece "Dar de baja" (reasignar cartera + desactivar). */
  institutional?: boolean;
  /** Consultorios de la org para asignar al miembro (Fase 1: solo pertenencia). */
  consultorios?: ConsultorioOption[];
  desktopEdition?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UpdatePermissionsState, FormData>(
    updateMemberPermissionsAction.bind(null, member.userId),
    {},
  );
  const [togglingStatus, startStatusTransition] = useTransition();
  const [offboarding, startOffboardTransition] = useTransition();
  const [assigningConsultorio, startConsultorioTransition] = useTransition();
  const [offboardMsg, setOffboardMsg] = useState<string | null>(null);
  const isMaster = member.memberRole === 'master';

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{member.fullName || member.email}</p>
            <span className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
              {ROLE_LABELS[member.memberRole]}
            </span>
            {member.status === 'suspendido' ? (
              <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">
                Desactivado
              </span>
            ) : null}
            {/* Tarjeta profesional: la institución necesita saber quién puede firmar/certificar. */}
            {member.professionalLicense.trim() !== '' ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
                title={`Tarjeta profesional: ${member.professionalLicense}`}
              >
                <BadgeCheck size={12} /> Tarjeta {member.professionalLicense}
              </span>
            ) : !isMaster ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning"
                title="Sin tarjeta profesional registrada: no puede firmar ni certificar documentos clínico-legales."
              >
                <AlertTriangle size={12} /> Sin tarjeta profesional
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {member.email} · {member.patientCount} pacientes · {permissionSummary(member.permissions)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isMaster && consultorios.length > 0 ? (
            <select
              aria-label="Consultorio del miembro"
              title="Consultorio del miembro"
              defaultValue={member.consultorioId ?? ''}
              disabled={assigningConsultorio}
              onChange={(event) => {
                const formData = new FormData();
                formData.set('consultorioId', event.target.value);
                startConsultorioTransition(() =>
                  assignMemberConsultorioAction(member.userId, formData),
                );
              }}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft focus:border-primary focus:outline-none disabled:opacity-60"
            >
              <option value="">Sin consultorio</option>
              {consultorios.map((consultorio) => (
                <option key={consultorio.id} value={consultorio.id}>
                  {consultorio.name}
                </option>
              ))}
            </select>
          ) : null}
          {institutional && !isMaster ? (
            <a
              href={`/api/organizacion/portafolio/${member.userId}/pdf`}
              target={desktopEdition ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-bg hover:text-ink"
              title="Portafolio pseudonimizado de sus casos (sin datos identificatorios)"
            >
              <FileDown size={14} /> {desktopEdition ? 'Portafolio para imprimir' : 'Portafolio'}
            </a>
          ) : null}
          {institutional && !isMaster && member.status === 'activo' ? (
            <button
              type="button"
              disabled={offboarding}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Dar de baja a ${member.fullName || member.email}? Sus expedientes se reasignarán a su supervisor activo (o a la institución si no tiene), y la cuenta se desactivará. No se borra ningún dato.`,
                  )
                ) {
                  return;
                }
                setOffboardMsg(null);
                startOffboardTransition(async () => {
                  const result = await offboardMemberAction(member.userId);
                  setOffboardMsg(result.error ?? result.summary ?? null);
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/50 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning-soft disabled:opacity-60"
            >
              <LogOut size={14} /> {offboarding ? 'Dando de baja…' : 'Dar de baja'}
            </button>
          ) : null}
          {!isMaster ? (
            <button
              type="button"
              disabled={togglingStatus}
              onClick={() => {
                const activating = member.status === 'suspendido';
                if (
                  !activating &&
                  !window.confirm(
                    `¿Desactivar la cuenta de ${member.fullName || member.email}? No podrá iniciar sesión hasta reactivarla.`,
                  )
                ) {
                  return;
                }
                startStatusTransition(() => setMemberActiveAction(member.userId, activating));
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                member.status === 'suspendido'
                  ? 'border-success/40 text-success hover:bg-success-soft'
                  : 'border-line text-ink-soft hover:bg-bg hover:text-danger'
              }`}
            >
              {member.status === 'suspendido' ? (
                <>
                  <UserCheck size={14} /> Reactivar
                </>
              ) : (
                <>
                  <UserX size={14} /> Desactivar
                </>
              )}
            </button>
          ) : null}
          {!isMaster ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-bg hover:text-ink"
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Permisos
            </button>
          ) : null}
        </div>
      </div>

      {offboardMsg ? (
        <p className="border-t border-line px-5 py-2 text-xs font-medium text-ink-soft">{offboardMsg}</p>
      ) : null}

      {open && !isMaster ? (
        <form
          action={formAction}
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);
            submitFormWithoutNativeReset(event, () => {
              startTransition(() => formAction(formData));
            });
          }}
          className="space-y-4 border-t border-line px-5 py-4"
        >
          <PermissionsFields defaults={member.permissions} idPrefix={`miembro-${member.userId}`} />
          {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
          {state.ok ? <p className="text-sm font-medium text-success">Permisos guardados.</p> : null}
          <Button type="submit" disabled={pending}>
            <Save size={16} /> {pending ? 'Guardando…' : 'Guardar permisos'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
