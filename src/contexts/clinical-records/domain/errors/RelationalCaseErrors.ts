import { DomainError } from '@/shared/domain/DomainError';

export class RelationalCaseNotFoundError extends DomainError {
  public constructor(caseId: string) {
    super(`No se encontró el caso relacional ${caseId}.`);
  }
}

export class CaseMemberLimitReachedError extends DomainError {
  public constructor() {
    super('Un caso de pareja admite exactamente dos miembros.');
  }
}

export class PatientAlreadyMemberError extends DomainError {
  public constructor() {
    super('Este paciente ya es miembro del caso.');
  }
}

export class CaseMemberNotFoundError extends DomainError {
  public constructor(memberId: string) {
    super(`No se encontró el miembro del caso ${memberId}.`);
  }
}

export class SecretsPolicyRequiredError extends DomainError {
  public constructor() {
    super('Acuerda la política de secretos del caso antes de iniciar sesiones individuales.');
  }
}

export class CaseContraindicatedError extends DomainError {
  public constructor() {
    super('El formato conjunto está contraindicado o el caso no está activo: no admite nuevas sesiones.');
  }
}
