'use client';

import { Fragment, useState, useTransition } from 'react';
import { Ban, CheckCircle2, ChevronDown, ChevronUp, Download, Eye, KeyRound, LockOpen, Pencil, Search, ShieldOff, SlidersHorizontal, Timer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AdminAccountRow } from '@/contexts/identity/domain/repositories/AdminDirectoryReader';
import { formatCop } from '@/shared/domain/orgSeatPricing';
import { impersonateAction } from '@/app/admin/impersonationActions';
import {
  activateSubscriptionAction,
  deleteUserAction,
  disableTotpAction,
  extendTrialAction,
  resetUserPasswordAction,
  setUserLimitsAction,
  setUserStatusAction,
  unlockLoginAction,
  updateUserAction,
  type AccountActionResult,
} from './actions';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** Campo de override → número ≥ 0 o null (vacío = usar el plan). */
function toOverrideNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  org_master: 'Maestro de org.',
  professor: 'Professor',
  psychologist: 'Psicólogo/a',
  assistant: 'Asistente',
};

/** Roles asignables al editar una cuenta (assistant se gestiona desde la consulta del titular). */
const EDIT_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'psychologist', label: 'Psicólogo/a' },
  { value: 'org_master', label: 'Maestro de organización' },
  { value: 'professor', label: 'Supervisión académica' },
  { value: 'admin', label: 'Administración de la plataforma' },
];

const PLAN_OPTIONS: { id: string; name: string }[] = [
  { id: 'esencial', name: 'Esencial' },
  { id: 'profesional', name: 'Profesional' },
  { id: 'organizacion', name: 'Organizaciones' },
];

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  return format(new Date(iso), 'd MMM yyyy', { locale: es });
}

function subscriptionLabel(account: AdminAccountRow): { text: string; tone: string } {
  switch (account.subscriptionStatus) {
    case 'activa':
      return {
        text: `Activa hasta ${shortDate(account.currentPeriodEnd)}`,
        tone: 'bg-success-soft text-success',
      };
    case 'trial':
      return { text: `Trial hasta ${shortDate(account.trialEndsAt)}`, tone: 'bg-warning-soft text-warning' };
    case 'vencida':
      return { text: 'Vencida', tone: 'bg-danger-soft text-danger' };
    case 'cancelada':
      return { text: 'Cancelada', tone: 'bg-danger-soft text-danger' };
    default:
      return { text: 'Sin suscripción', tone: 'bg-bg text-ink-soft border border-line' };
  }
}

export function AccountsTable({
  accounts,
  currentAdminId,
  initialQuery = '',
}: {
  accounts: AdminAccountRow[];
  currentAdminId: string;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState(7);
  const [results, setResults] = useState<Record<string, AccountActionResult>>({});
  const [pending, startTransition] = useTransition();

  // Estado de la fila en gestión (solo una abierta a la vez).
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('psychologist');
  const [actPlan, setActPlan] = useState('profesional');
  const [actPeriod, setActPeriod] = useState(30);

  // Override de topes por cuenta (strings: vacío = usar el plan).
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [ovAiHard, setOvAiHard] = useState('');
  const [ovAiSoft, setOvAiSoft] = useState('');
  const [ovWa, setOvWa] = useState('');
  const [ovStorage, setOvStorage] = useState('');

  // Borrado de cuenta (habeas data): doble confirmación escribiendo el correo.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const asField = (value: number | null) => (value == null ? '' : String(value));

  function toggleManage(account: AdminAccountRow) {
    if (expandedId === account.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(account.id);
    setEditOpen(false);
    setLimitsOpen(false);
    setDeleteOpen(false);
    setDeleteConfirm('');
    setEditName(account.fullName ?? '');
    setEditEmail(account.email);
    setEditRole(account.role);
    setActPlan(account.plan ?? 'profesional');
    setActPeriod(30);
    setOvAiHard(asField(account.overrides.aiMonthlyBudgetCop));
    setOvAiSoft(asField(account.overrides.aiSoftBudgetCop));
    setOvWa(asField(account.overrides.waMonthlyLimit));
    setOvStorage(asField(account.overrides.storageLimitGb));
  }

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? accounts.filter((account) =>
        [account.email, account.fullName, account.organizationName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(normalized),
      )
    : accounts;

  function run(userId: string, action: () => Promise<AccountActionResult>) {
    startTransition(async () => {
      const result = await action();
      setResults((previous) => ({ ...previous, [userId]: result }));
    });
  }

  const actionButton =
    'inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-bg disabled:opacity-50';

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-3">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por correo, nombre u organización…"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">Correo</th>
              <th className="px-3 py-3 font-medium">Nombre</th>
              <th className="px-3 py-3 font-medium">Rol</th>
              <th className="px-3 py-3 font-medium">Organización</th>
              <th className="px-3 py-3 font-medium">Estado</th>
              <th className="px-3 py-3 font-medium">Suscripción</th>
              <th className="px-3 py-3 font-medium">Alta</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-ink-soft">
                  No hay cuentas que coincidan con la búsqueda.
                </td>
              </tr>
            ) : null}
            {filtered.map((account) => {
              const expanded = expandedId === account.id;
              const subscription = subscriptionLabel(account);
              const result = results[account.id];
              const isSelf = account.id === currentAdminId;
              return (
                <Fragment key={account.id}>
                  <tr className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3 font-medium text-ink">{account.email}</td>
                    <td className="px-3 py-3 text-ink">{account.fullName || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-primary-light px-2.5 py-0.5 text-xs font-medium text-primary">
                        {ROLE_LABELS[account.role] ?? account.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{account.organizationName ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          account.status === 'activo'
                            ? 'bg-success-soft text-success'
                            : 'bg-danger-soft text-danger'
                        }`}
                      >
                        {account.status === 'activo' ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${subscription.tone}`}>
                        {subscription.text}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{shortDate(account.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleManage(account)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary dark:text-accent-2 hover:bg-primary-light"
                      >
                        Gestionar
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-line bg-bg last:border-b-0">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {!isSelf ? (
                            <button
                              type="button"
                              disabled={pending}
                              title="Inicia una sesión de soporte viendo la app como este usuario (queda auditado)"
                              onClick={() => run(account.id, () => impersonateAction(account.id))}
                              className={actionButton}
                            >
                              <Eye size={13} className="text-primary dark:text-accent-2" />
                              Ver como usuario
                            </button>
                          ) : null}

                          {account.status === 'activo' ? (
                            <button
                              type="button"
                              disabled={pending || isSelf}
                              title={isSelf ? 'No puedes suspender tu propia cuenta' : undefined}
                              onClick={() => run(account.id, () => setUserStatusAction(account.id, 'suspendido'))}
                              className={actionButton}
                            >
                              <Ban size={13} className="text-danger" />
                              Suspender
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(account.id, () => setUserStatusAction(account.id, 'activo'))}
                              className={actionButton}
                            >
                              <CheckCircle2 size={13} className="text-success" />
                              Reactivar
                            </button>
                          )}

                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
                            <Timer size={13} className="text-ink-soft" />
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={trialDays}
                              onChange={(event) => setTrialDays(Number(event.target.value) || 1)}
                              className="w-14 bg-transparent text-xs text-ink outline-none"
                              aria-label="Días de extensión del trial"
                            />
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => run(account.id, () => extendTrialAction(account.id, trialDays))}
                              className="text-xs font-medium text-primary dark:text-accent-2 hover:underline disabled:opacity-50"
                            >
                              Extender trial
                            </button>
                          </span>

                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
                            <select
                              value={actPlan}
                              onChange={(event) => setActPlan(event.target.value)}
                              aria-label="Plan a activar"
                              className="bg-transparent text-xs font-medium text-ink outline-none"
                            >
                              {PLAN_OPTIONS.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={actPeriod}
                              onChange={(event) => setActPeriod(Number(event.target.value))}
                              aria-label="Periodo"
                              className="bg-transparent text-xs font-medium text-ink outline-none"
                            >
                              <option value={30}>30 días</option>
                              <option value={365}>12 meses</option>
                            </select>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(account.id, () =>
                                  activateSubscriptionAction(account.id, actPlan, actPeriod),
                                )
                              }
                              className="text-xs font-medium text-primary dark:text-accent-2 hover:underline disabled:opacity-50"
                            >
                              Activar / cambiar plan
                            </button>
                          </span>

                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(account.id, () => resetUserPasswordAction(account.id))}
                            className={actionButton}
                          >
                            <KeyRound size={13} className="text-warning" />
                            Resetear contraseña
                          </button>

                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setEditOpen((value) => !value)}
                            className={actionButton}
                          >
                            <Pencil size={13} className="text-primary dark:text-accent-2" />
                            Editar datos
                          </button>

                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setLimitsOpen((value) => !value)}
                            className={actionButton}
                          >
                            <SlidersHorizontal size={13} className="text-primary dark:text-accent-2" />
                            Topes y uso
                          </button>

                          <a
                            href={`/api/admin/cuentas/${account.id}/export`}
                            title="Descarga TODOS los datos de la cuenta en JSON (habeas data)"
                            className={actionButton}
                          >
                            <Download size={13} className="text-primary dark:text-accent-2" />
                            Exportar datos
                          </a>

                          {!isSelf ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => setDeleteOpen((value) => !value)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-surface px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-50"
                            >
                              <Trash2 size={13} />
                              Eliminar cuenta
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={pending}
                            title="Limpia el bloqueo por intentos fallidos de login"
                            onClick={() => run(account.id, () => unlockLoginAction(account.id))}
                            className={actionButton}
                          >
                            <LockOpen size={13} className="text-primary dark:text-accent-2" />
                            Desbloquear acceso
                          </button>

                          <button
                            type="button"
                            disabled={pending}
                            title="Reset administrativo del 2FA (autenticador perdido)"
                            onClick={() => run(account.id, () => disableTotpAction(account.id))}
                            className={actionButton}
                          >
                            <ShieldOff size={13} className="text-danger" />
                            Desactivar 2FA
                          </button>
                        </div>

                        {editOpen ? (
                          <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-3 sm:grid-cols-3">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-ink-soft">Nombre</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(event) => setEditName(event.target.value)}
                                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-ink-soft">Correo</label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(event) => setEditEmail(event.target.value)}
                                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-ink-soft">
                                Rol {isSelf ? '(no editable en tu cuenta)' : ''}
                              </label>
                              <select
                                value={editRole}
                                disabled={isSelf}
                                onChange={(event) => setEditRole(event.target.value)}
                                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary-light disabled:opacity-50"
                              >
                                {EDIT_ROLE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-3">
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  run(account.id, () =>
                                    updateUserAction(account.id, {
                                      fullName: editName,
                                      email: editEmail,
                                      role: isSelf ? undefined : editRole,
                                    }),
                                  )
                                }
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
                              >
                                Guardar datos
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {limitsOpen ? (
                          <div className="mt-3 rounded-lg border border-line bg-surface p-3">
                            <p className="mb-2 text-xs text-ink-soft">
                              IA este mes:{' '}
                              <span className="font-semibold text-ink">{formatCop(account.aiSpentCop)}</span>
                              {' · '}Almacenamiento:{' '}
                              <span className="font-semibold text-ink">
                                {formatBytes(account.storageUsedBytes)}
                                {account.storageLimitBytes != null
                                  ? ` de ${formatBytes(account.storageLimitBytes)}`
                                  : ' (sin límite)'}
                              </span>
                            </p>
                            <p className="mb-2 text-[11px] text-ink-soft">
                              Topes por cuenta — vacío = usar el plan. Para dejar sin tope, cambia el plan.
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              {[
                                { label: 'Tope IA/mes (COP)', value: ovAiHard, set: setOvAiHard },
                                { label: 'Umbral IA suave (COP)', value: ovAiSoft, set: setOvAiSoft },
                                { label: 'WhatsApp/mes', value: ovWa, set: setOvWa },
                                { label: 'Almacenamiento (GB)', value: ovStorage, set: setOvStorage },
                              ].map((field) => (
                                <div key={field.label}>
                                  <label className="mb-1 block text-[11px] font-medium text-ink-soft">
                                    {field.label}
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={field.value}
                                    placeholder="Plan"
                                    onChange={(event) => field.set(event.target.value)}
                                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
                                  />
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(account.id, () =>
                                  setUserLimitsAction(account.id, {
                                    aiMonthlyBudgetCop: toOverrideNumber(ovAiHard),
                                    aiSoftBudgetCop: toOverrideNumber(ovAiSoft),
                                    waMonthlyLimit: toOverrideNumber(ovWa),
                                    storageLimitGb: toOverrideNumber(ovStorage),
                                  }),
                                )
                              }
                              className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
                            >
                              Guardar topes
                            </button>
                          </div>
                        ) : null}

                        {deleteOpen ? (
                          <div className="mt-3 rounded-lg border border-danger/40 bg-danger-soft/40 p-3">
                            <p className="text-xs font-semibold text-danger">
                              Eliminar definitivamente esta cuenta
                            </p>
                            <p className="mt-1 text-[11px] text-ink-soft">
                              Acción irreversible: borra la cuenta y todos sus datos. Se bloquea si la cuenta
                              conserva expedientes bajo retención (expórtalos o transfiere la custodia antes).
                              Escribe <span className="font-medium text-ink">{account.email}</span> para confirmar.
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="email"
                                value={deleteConfirm}
                                onChange={(event) => setDeleteConfirm(event.target.value)}
                                placeholder={account.email}
                                className="min-w-[14rem] flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-danger focus:ring-2 focus:ring-danger/30"
                              />
                              <button
                                type="button"
                                disabled={
                                  pending || deleteConfirm.trim().toLowerCase() !== account.email.toLowerCase()
                                }
                                onClick={() => run(account.id, () => deleteUserAction(account.id, deleteConfirm))}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 size={13} />
                                Eliminar definitivamente
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {result?.error ? (
                          <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{result.error}</p>
                        ) : null}
                        {result?.ok ? (
                          <div className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
                            <p>{result.ok}</p>
                            {result.resetUrl ? (
                              <p className="mt-1 break-all">
                                <code className="rounded bg-white/70 px-1.5 py-0.5">{result.resetUrl}</code>
                                <span className="ml-1 text-success/80">
                                  (modo local: este enlace llegaría por correo)
                                </span>
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
