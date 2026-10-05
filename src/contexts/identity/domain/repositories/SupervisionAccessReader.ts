import type { SupervisionCaseData } from '@/contexts/clinical-records/domain/SessionInsights';

/** Nota del supervisado alcanzable para retroalimentación del supervisor. */
export interface ReviewableNote {
  sessionNoteId: string;
  noteTitle: string;
  patientId: string;
  supervisedUserId: string;
}

/**
 * Lecturas de supervisión ACTIVA. Regla crítica: todo se resuelve a través de
 * un vínculo de supervisión vigente (JOIN estructural con `supervision_links`
 * en la query, nunca un if posterior). Si no hay vínculo con el alcance
 * necesario, se devuelve null y el caso de uso falla con
 * SupervisionLinkRequiredError.
 *
 * `SupervisionCaseData` es el tipo del puerto SessionInsights (contexto
 * clinical-records); se importa SOLO como tipo para no acoplar valores.
 */
export interface SupervisionAccessReader {
  /**
   * La nota existe Y su dueño es supervisado por `supervisorUserId` con
   * alcance de notas. Null en cualquier otro caso (sin revelar existencia).
   */
  findReviewableNote(sessionNoteId: string, supervisorUserId: string): Promise<ReviewableNote | null>;
  /**
   * Contexto del caso para el resumen IA del supervisor: paciente, notas
   * (según alcance de notas), historias (según alcance de historias) y
   * diagnósticos. Null si no hay vínculo vigente o el paciente no pertenece
   * al supervisado.
   */
  loadCase(
    supervisorUserId: string,
    supervisedUserId: string,
    patientId: string,
  ): Promise<SupervisionCaseData | null>;
}
