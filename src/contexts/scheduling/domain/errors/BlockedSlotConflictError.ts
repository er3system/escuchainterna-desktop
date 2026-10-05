import { DomainError } from '@/shared/domain/DomainError';

/**
 * El horario solicitado cae sobre un bloqueo manual del profesional (almuerzo, cita
 * personal, vacaciones). Se rechaza al crear o reagendar, igual que FindAvailableSlots
 * oculta esos cupos: un bloqueo significa "no disponible" para todos.
 */
export class BlockedSlotConflictError extends DomainError {
  public constructor(startAt: Date) {
    super(`El horario solicitado cae sobre un espacio bloqueado (${startAt.toISOString()}).`);
  }
}
