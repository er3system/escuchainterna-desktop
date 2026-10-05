import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import {
  EMPTY_CASE_PROFILE,
  EMPTY_SYSTEM_EVAL,
  relationPairKey,
  type CaseEvent,
  type CaseProfile,
  type MemberRelation,
  type SystemEval,
} from './value-objects/caseProfile';

/** Tipo de vínculo del caso. Se lanza pareja primero; familia después (§10). */
export type RelationalCaseKind = 'pareja' | 'familia';

/**
 * 'activo' = en proceso; 'contraindicado' = el formato conjunto está
 * desaconsejado (p. ej. violencia coercitiva, §8/§10) y NO debe seguir como
 * conjunto; 'cerrado' = caso finalizado.
 */
export type RelationalCaseStatus = 'activo' | 'contraindicado' | 'cerrado';

/**
 * Política de secretos del caso (terapia-pareja §"política de secretos"): debe
 * acordarse ANTES de la 1ª sesión individual. '' = aún sin definir.
 */
export type SecretsPolicy = '' | 'no_secretos' | 'confidencialidad_limitada';

const SECRETS_POLICIES: SecretsPolicy[] = ['no_secretos', 'confidencialidad_limitada'];

export function isSecretsPolicy(value: unknown): value is SecretsPolicy {
  return value === '' || (SECRETS_POLICIES as string[]).includes(value as string);
}

export interface RelationalCasePrimitives {
  id: string;
  ownerUserId: string;
  kind: RelationalCaseKind;
  title: string;
  status: RelationalCaseStatus;
  secretsPolicy: SecretsPolicy;
  secretsPolicySetAt: string | null;
  contraindicationReason: string;
  /** Perfil clínico del caso: evaluación del sistema, objetivos, eventos y relaciones. */
  profile: CaseProfile;
  createdAt: string;
  updatedAt: string;
}

/**
 * Caso relacional (pareja/familia): agrupa a varios pacientes bajo un proceso
 * compartido. El "paciente" es el vínculo, pero los derechos (consentimiento,
 * confidencialidad) son de cada persona por separado — de ahí la política de
 * secretos y el consentimiento doble que rigen el caso.
 */
export class RelationalCase extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly ownerUserId: string,
    private readonly kind: RelationalCaseKind,
    private title: string,
    private status: RelationalCaseStatus,
    private secretsPolicy: SecretsPolicy,
    private secretsPolicySetAt: Date | null,
    private contraindicationReason: string,
    private profile: CaseProfile,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  public static open(input: {
    id: string;
    ownerUserId: string;
    kind: RelationalCaseKind;
    title: string;
  }): RelationalCase {
    const now = new Date();
    return new RelationalCase(
      input.id,
      input.ownerUserId,
      input.kind,
      input.title.trim() || 'Caso de pareja',
      'activo',
      '',
      null,
      '',
      { ...EMPTY_CASE_PROFILE, systemEval: { ...EMPTY_SYSTEM_EVAL }, events: [], relations: [] },
      now,
      now,
    );
  }

  public static fromPrimitives(primitives: RelationalCasePrimitives): RelationalCase {
    return new RelationalCase(
      primitives.id,
      primitives.ownerUserId,
      primitives.kind,
      primitives.title,
      primitives.status,
      primitives.secretsPolicy,
      primitives.secretsPolicySetAt ? new Date(primitives.secretsPolicySetAt) : null,
      primitives.contraindicationReason,
      primitives.profile ?? { ...EMPTY_CASE_PROFILE, systemEval: { ...EMPTY_SYSTEM_EVAL }, events: [], relations: [] },
      new Date(primitives.createdAt),
      new Date(primitives.updatedAt),
    );
  }

  // ---- Perfil del caso (evaluación del sistema, objetivos, eventos, relaciones) ----

  public caseProfile(): CaseProfile {
    return {
      systemEval: { ...this.profile.systemEval },
      objectives: this.profile.objectives,
      events: this.profile.events.map((e) => ({ ...e })),
      relations: this.profile.relations.map((r) => ({ ...r })),
    };
  }

  public setSystemEval(systemEval: SystemEval): void {
    this.profile = { ...this.profile, systemEval: { ...systemEval } };
    this.touch();
  }

  public setObjectives(objectives: string): void {
    this.profile = { ...this.profile, objectives };
    this.touch();
  }

  public addEvent(event: CaseEvent): void {
    this.profile = { ...this.profile, events: [...this.profile.events, { ...event }] };
    this.touch();
  }

  public removeEvent(eventId: string): void {
    this.profile = { ...this.profile, events: this.profile.events.filter((e) => e.id !== eventId) };
    this.touch();
  }

  /** Inserta o actualiza la relación de un PAR de miembros (clave no ordenada). */
  public upsertRelation(relation: MemberRelation): void {
    const key = relationPairKey(relation.aMemberId, relation.bMemberId);
    const existing = this.profile.relations.find(
      (r) => relationPairKey(r.aMemberId, r.bMemberId) === key,
    );
    const relations = existing
      ? this.profile.relations.map((r) =>
          r.id === existing.id ? { ...relation, id: existing.id } : r,
        )
      : [...this.profile.relations, { ...relation }];
    this.profile = { ...this.profile, relations };
    this.touch();
  }

  public removeRelation(relationId: string): void {
    this.profile = {
      ...this.profile,
      relations: this.profile.relations.filter((r) => r.id !== relationId),
    };
    this.touch();
  }

  public caseId(): string {
    return this.id;
  }

  public belongsToOwner(ownerUserId: string): boolean {
    return this.ownerUserId === ownerUserId;
  }

  public isActive(): boolean {
    return this.status === 'activo';
  }

  public isContraindicated(): boolean {
    return this.status === 'contraindicado';
  }

  /** Fija la política de secretos (obligatoria antes de la 1ª sesión individual). */
  public setSecretsPolicy(policy: SecretsPolicy): void {
    if (policy !== 'no_secretos' && policy !== 'confidencialidad_limitada') {
      throw new Error('La política de secretos debe ser "no_secretos" o "confidencialidad_limitada".');
    }
    this.secretsPolicy = policy;
    this.secretsPolicySetAt = new Date();
    this.touch();
  }

  /** ¿Está definida la política de secretos del caso? */
  public hasSecretsPolicy(): boolean {
    return this.secretsPolicy !== '';
  }

  /**
   * ¿Se puede iniciar una sesión individual? Requiere caso activo y política de
   * secretos ya acordada (terapia-pareja: "decidirla antes de necesitarla").
   */
  public canStartIndividualSession(): boolean {
    return this.isActive() && this.hasSecretsPolicy();
  }

  /** Marca el caso como contraindicado para el formato conjunto (§8/§10). */
  public contraindicate(reason: string): void {
    this.status = 'contraindicado';
    this.contraindicationReason = reason.trim();
    this.touch();
  }

  public close(): void {
    this.status = 'cerrado';
    this.touch();
  }

  public rename(title: string): void {
    const next = title.trim();
    if (next) {
      this.title = next;
      this.touch();
    }
  }

  private touch(): void {
    this.updatedAt = new Date();
  }

  public toPrimitives(): RelationalCasePrimitives {
    return {
      id: this.id,
      ownerUserId: this.ownerUserId,
      kind: this.kind,
      title: this.title,
      status: this.status,
      secretsPolicy: this.secretsPolicy,
      secretsPolicySetAt: this.secretsPolicySetAt ? this.secretsPolicySetAt.toISOString() : null,
      contraindicationReason: this.contraindicationReason,
      profile: this.caseProfile(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
