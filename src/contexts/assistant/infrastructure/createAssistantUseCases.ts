import { SendChatMessage } from '../application/send-chat-message/SendChatMessage';
import { GenerateSessionBriefing } from '../application/generate-session-briefing/GenerateSessionBriefing';
import { ListThreads } from '../application/list-threads/ListThreads';
import { GetThreadDetail } from '../application/get-thread-detail/GetThreadDetail';
import { ListPatientOptions } from '../application/list-patient-options/ListPatientOptions';
import { AnchorThreadPatient } from '../application/anchor-thread-patient/AnchorThreadPatient';
import { resolveAiAccess } from '@/shared/infrastructure/ai-billing/AiBudgetGate';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { SqliteChatThreadRepository } from './persistence/SqliteChatThreadRepository';
import { SqlitePatientContextRetriever } from './persistence/SqlitePatientContextRetriever';
import { createAssistantEngine } from './ai/createAssistantEngine';

/**
 * Fábrica del contexto assistant. Recibe el owner_user_id de la SESIÓN
 * (jamás de la petición) y arma repos/retriever acotados a ese dueño,
 * de modo que ningún caso de uso pueda tocar datos ajenos.
 *
 * El motor se resuelve con la puerta de presupuesto de IA: modelo por plan,
 * degradación silenciosa sobre el umbral suave y, si el plan alcanzó su tope
 * duro del mes, un motor bloqueado que responde el mensaje de límite.
 */
export async function createAssistantUseCases(ownerUserId: string) {
  const threads = new SqliteChatThreadRepository(ownerUserId);
  const retriever = new SqlitePatientContextRetriever(ownerUserId);
  const engine = await createAssistantEngine(ownerUserId, await resolveAiAccess(ownerUserId, 'chat'));
  // Traza de acceso de IA atada al dueño en sesión (habeas data + auditoría del org_master).
  const auditAiAccess = (patientId: string) =>
    logRecordAccess(ownerUserId, patientId, 'asistente', 'consulta_ia');
  const auditBriefing = (patientId: string) =>
    logRecordAccess(ownerUserId, patientId, 'asistente', 'briefing');

  return {
    sendChatMessage: new SendChatMessage(threads, retriever, engine, auditAiAccess),
    // El briefing reusa el MISMO retriever (consent-gated) y el MISMO motor (medido) del chat.
    generateSessionBriefing: new GenerateSessionBriefing(retriever, engine, auditBriefing),
    listThreads: new ListThreads(threads),
    getThreadDetail: new GetThreadDetail(threads, retriever),
    listPatientOptions: new ListPatientOptions(retriever),
    anchorThreadPatient: new AnchorThreadPatient(threads, retriever),
  };
}
