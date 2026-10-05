// Módulo PURO (sin Node): política de acceso a expedientes en cuentas
// institucionales (docs/cuentas-institucionales-spec.md §2). La INSTITUCIÓN fija el
// preset base; el PROFESOR puede ampliarlo (subir visibilidad) solo si la institución
// lo permite, y NUNCA por debajo de la base. El acceso a un expediente NO asignado
// siempre se traza como 'acceso_cobertura' (habeas data, §2.3).

export type AccessPolicy = 'estricto' | 'intermedio' | 'cobertura';

export interface AccessPolicyDescriptor {
  key: AccessPolicy;
  label: string;
  description: string;
  /** Rango de visibilidad: a mayor número, más amplio. Para comparar/ampliar. */
  rank: number;
}

export const ACCESS_POLICIES: AccessPolicyDescriptor[] = [
  {
    key: 'estricto',
    label: 'Estricto',
    description: 'Cada miembro ve solo los expedientes que tiene asignados.',
    rank: 0,
  },
  {
    key: 'intermedio',
    label: 'Intermedio',
    description: 'El profesor ve los de sus supervisados; el estudiante, solo los suyos.',
    rank: 1,
  },
  {
    key: 'cobertura',
    label: 'Cobertura (colaborativo)',
    description: 'Cualquier miembro puede abrir cualquier expediente de la organización.',
    rank: 2,
  },
];

const BY_KEY = new Map(ACCESS_POLICIES.map((entry) => [entry.key, entry]));

export function isAccessPolicy(value: unknown): value is AccessPolicy {
  return typeof value === 'string' && BY_KEY.has(value as AccessPolicy);
}

export function toAccessPolicy(value: unknown): AccessPolicy {
  return isAccessPolicy(value) ? value : 'estricto';
}

export function accessPolicyRank(policy: AccessPolicy): number {
  return BY_KEY.get(policy)?.rank ?? 0;
}

/**
 * Política EFECTIVA para un miembro. La base de la institución es el piso; si la
 * institución permite ampliar y el profesor fijó una preferencia MÁS amplia, esa
 * gana (nunca puede restringir por debajo de la base ni hace falta que la "estreche").
 * Si no se permite ampliar, manda la base institucional.
 */
export function effectiveAccessPolicy(input: {
  orgPolicy: AccessPolicy;
  professorCanWiden: boolean;
  professorOverride: AccessPolicy | null;
}): AccessPolicy {
  if (!input.professorCanWiden || !input.professorOverride) return input.orgPolicy;
  return accessPolicyRank(input.professorOverride) > accessPolicyRank(input.orgPolicy)
    ? input.professorOverride
    : input.orgPolicy;
}

/**
 * ¿El actor y el objetivo comparten consultorio? (docs/consultorios-spec.md §3).
 * Un consultorio es una sub-unidad OPCIONAL dentro de la organización: dos miembros
 * de la misma org pero de DISTINTO consultorio se tratan como de orgs distintas.
 * `null` = sin consultorio (org_master o org plana) ⇒ pasa siempre (no se le aísla).
 * Puro y conservador: igual id, o cualquiera de los dos sin consultorio.
 */
export function sameConsultorio(
  actorConsultorioId: string | null,
  targetConsultorioId: string | null,
): boolean {
  return (
    actorConsultorioId === null ||
    targetConsultorioId === null ||
    actorConsultorioId === targetConsultorioId
  );
}

/**
 * Núcleo de seguridad de la cobertura (§2.3). Decide si un actor que NO tiene el
 * expediente asignado puede abrirlo igualmente (acceso de cobertura, que SIEMPRE se
 * traza). Fail-closed: ante cualquier duda, deniega. Se invoca SOLO para pacientes
 * institucionales y cuando el actor no es el dueño/tratante.
 *
 * - Distinta organización ⇒ jamás (no se cruza entre instituciones).
 * - Distinto consultorio de la MISMA org ⇒ jamás (aislamiento intra-org, consultorios §3).
 * - 'estricto'   ⇒ nunca (solo lo asignado).
 * - 'intermedio' ⇒ solo si el actor supervisa al tratante actual del paciente.
 * - 'cobertura'  ⇒ cualquier miembro de la misma organización (y mismo consultorio).
 */
export function coverageAllowed(input: {
  effectivePolicy: AccessPolicy;
  sameOrganization: boolean;
  /** Mismo consultorio (o alguno sin consultorio). Si es false, deniega aunque sea misma org. */
  sameConsultorio: boolean;
  actorSupervisesTratante: boolean;
}): boolean {
  if (!input.sameOrganization) return false;
  if (!input.sameConsultorio) return false;
  switch (input.effectivePolicy) {
    case 'estricto':
      return false;
    case 'intermedio':
      return input.actorSupervisesTratante;
    case 'cobertura':
      return true;
    default:
      return false;
  }
}
