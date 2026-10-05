'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '@/shared/domain/DomainError';
import { forbidAssistantRole, forbidProfessorRole } from '@/shared/infrastructure/auth/dataOwner';
import { createAssistantUseCases } from '@/contexts/assistant/infrastructure/createAssistantUseCases';
import { parseAssistantMessage } from '@/contexts/assistant/domain/caseEvidence';
import type {
  PatientOptionDto,
  ThreadDetailDto,
  ThreadSummaryDto,
} from '@/contexts/assistant/application/AssistantReadModels';

export interface AssistantBootstrapDto {
  threads: ThreadSummaryDto[];
  patients: PatientOptionDto[];
  latestThread: ThreadDetailDto | null;
}

/**
 * Guard común del asistente: veda al rol asistente (v3 §4) Y al profesor
 * (supervisa, no atiende — paridad con la página /asistente, que ya aplicaba
 * forbidProfessorRole; sin esto las actions eran alcanzables por invocación
 * directa aunque la página rebotara).
 */
async function requireAssistantAccess(): Promise<string> {
  const userId = await forbidAssistantRole();
  await forbidProfessorRole();
  return userId;
}

/** Estado inicial del asistente (hilos + pacientes + último hilo). Lo usa el launcher flotante. */
export async function cargarAsistente(): Promise<AssistantBootstrapDto> {
  const ownerUserId = await requireAssistantAccess();
  const useCases = await createAssistantUseCases(ownerUserId);
  const threads = await useCases.listThreads.list();
  return {
    threads,
    patients: await useCases.listPatientOptions.list(),
    latestThread: threads.length > 0 ? await useCases.getThreadDetail.get(threads[0].id) : null,
  };
}

/** Detalle de un hilo propio (null si no existe o es de otro dueño). */
export async function cargarHilo(threadId: string): Promise<ThreadDetailDto | null> {
  const ownerUserId = await requireAssistantAccess();
  return (await createAssistantUseCases(ownerUserId)).getThreadDetail.get(threadId);
}

// El envío de mensajes vive en /api/asistente/stream (NDJSON): la server action
// `enviarMensaje` se retiró al quedar sin consumidores — mantener dos superficies
// de envío con los mismos guardrails era duplicación que podía divergir.

export type BriefingResult =
  | { ok: true; available: boolean; body: string; sources: string[]; gaps: string[] }
  | { ok: false; error: string };

/**
 * Briefing pre-sesión de un paciente PROPIO. Reusa el retriever consent-gated del asistente: si el
 * paciente no autorizó IA (o no es del dueño / está en custodia), `available` vuelve false sin tocar
 * el motor. Se parsea aquí (servidor) en cuerpo/fuentes/huecos → el cliente solo renderiza. El
 * briefing es solo-sugerir: el psicólogo lee y decide.
 */
export async function generarBriefing(patientId: string): Promise<BriefingResult> {
  const ownerUserId = await requireAssistantAccess();
  try {
    const result = await (await createAssistantUseCases(ownerUserId)).generateSessionBriefing.execute(patientId);
    if (!result.available) return { ok: true, available: false, body: '', sources: [], gaps: [] };
    const parsed = parseAssistantMessage(result.text);
    return { ok: true, available: true, body: parsed.body, sources: parsed.sources, gaps: parsed.gaps };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error('Error al generar briefing:', error);
    return { ok: false, error: 'No pudimos generar el briefing. Inténtalo de nuevo.' };
  }
}

export type AnclarPacienteResult = { ok: true } | { ok: false; error: string };

/** Ancla (o desancla con null) un paciente propio a un hilo propio. */
export async function anclarPaciente(threadId: string, patientId: string | null): Promise<AnclarPacienteResult> {
  const ownerUserId = await requireAssistantAccess();
  try {
    await (await createAssistantUseCases(ownerUserId)).anchorThreadPatient.anchor(threadId, patientId);
    revalidatePath('/asistente');
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    console.error('Error al anclar paciente:', error);
    return { ok: false, error: 'No pudimos actualizar el paciente del hilo.' };
  }
}
