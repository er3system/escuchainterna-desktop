import { revalidatePath } from 'next/cache';
import { DomainError } from '@/shared/domain/DomainError';
import { forbidAssistantRole, isProfessorUser } from '@/shared/infrastructure/auth/dataOwner';
import { createAssistantUseCases } from '@/contexts/assistant/infrastructure/createAssistantUseCases';
import { SendChatMessageMessage } from '@/contexts/assistant/application/send-chat-message/SendChatMessageMessage';

// Depende de la sesión (cookies) y produce un stream: nunca se cachea.
export const dynamic = 'force-dynamic';

/** El contenido tope es 2000 chars; 32 KB cubre el JSON con holgura (anti-abuso). */
const MAX_BODY_BYTES = 32_768;

/**
 * Tope de streams CONCURRENTES por dueño (por instancia). Doble propósito:
 * (1) anti-abuso básico de una ruta costosa (cada stream quema tokens), y
 * (2) mitiga el TOCTOU de la puerta de presupuesto: N streams paralelos pasan
 * todos el gate ANTES de que ninguno registre uso; acotar N acota el exceso.
 * En multi-instancia el tope es por instancia (mitigación, no límite global).
 */
const MAX_STREAMS_PER_OWNER = 2;
const activeStreams = new Map<string, number>();

function acquireStreamSlot(ownerUserId: string): boolean {
  const current = activeStreams.get(ownerUserId) ?? 0;
  if (current >= MAX_STREAMS_PER_OWNER) return false;
  activeStreams.set(ownerUserId, current + 1);
  return true;
}

function releaseStreamSlot(ownerUserId: string): void {
  const current = activeStreams.get(ownerUserId) ?? 0;
  if (current <= 1) activeStreams.delete(ownerUserId);
  else activeStreams.set(ownerUserId, current - 1);
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * Chat del asistente en STREAMING (NDJSON). Reusa EXACTAMENTE los mismos
 * guardrails que el camino no-streaming porque delega en
 * `SendChatMessage.executeStream`, que comparte prepare()/finalize() con
 * execute() (alcance, consentimiento-IA en el retriever, traza de habeas data,
 * persistencia). Cada línea del cuerpo es un frame JSON:
 *   {"type":"delta","text":"…"}                     ← trozo para pintar en vivo
 *   {"type":"done","result":{…SendMessageResultDto}} ← DTO persistido (autoritativo)
 *   {"type":"error","error":"…"}                     ← fallo a mitad de stream
 *
 * Desconexión del cliente: el siguiente enqueue falla → se corta el bucle, y el
 * return() del generador dispara los finally de la cadena (persistencia del
 * turno parcial en el caso de uso + medición garantizada en el motor medido).
 */
export async function POST(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) return jsonError('Cuerpo demasiado grande.', 413);

  let ownerUserId: string;
  try {
    ownerUserId = await forbidAssistantRole();
  } catch {
    return jsonError('No autorizado.', 403);
  }
  // El profesor supervisa, no atiende: sin asistente IA. Paridad con la página
  // /asistente (que aplica forbidProfessorRole); aquí como 403 JSON, no redirect.
  if (await isProfessorUser(ownerUserId)) return jsonError('No autorizado.', 403);

  let body: { threadId?: unknown; patientId?: unknown; content?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonError('Cuerpo de la solicitud inválido.', 400);
  }

  // La construcción valida longitud/vacío (guardrail nº 3). Se hace ANTES del
  // stream para devolver un 400 limpio en vez de un frame de error.
  let message: SendChatMessageMessage;
  try {
    message = new SendChatMessageMessage({
      threadId: typeof body.threadId === 'string' ? body.threadId : null,
      patientId: typeof body.patientId === 'string' ? body.patientId : null,
      content: typeof body.content === 'string' ? body.content : '',
    });
  } catch (error) {
    return jsonError(error instanceof DomainError ? error.message : 'Mensaje inválido.', 400);
  }

  const useCases = await createAssistantUseCases(ownerUserId);

  if (!acquireStreamSlot(ownerUserId)) {
    return jsonError('Ya hay respuestas del asistente en curso. Espera a que terminen.', 429);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let clientGone = false;
      // enqueue lanza cuando el cliente ya se desconectó (stream cancelado):
      // se marca y se deja de emitir en vez de propagar el TypeError.
      const send = (frame: unknown): boolean => {
        if (clientGone) return false;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
          return true;
        } catch {
          clientGone = true;
          return false;
        }
      };
      try {
        for await (const frame of useCases.sendChatMessage.executeStream(message)) {
          // Cliente desconectado: cortar el bucle dispara iterator.return() y con
          // él los finally del caso de uso (persistencia) y del medidor (uso).
          if (!send(frame)) break;
        }
        // Paridad con la server action no-streaming (que hacía revalidatePath):
        // el RSC de /asistente no debe servir hilos desactualizados al navegar.
        try {
          revalidatePath('/asistente');
        } catch {
          // Fuera de un contexto revalidable no es fatal: el cliente ya reconcilió.
        }
      } catch (error) {
        // DomainError (hilo inexistente, paciente ajeno): mensaje al usuario. Otro
        // error: se traza en el servidor y se responde el mensaje genérico.
        if (!(error instanceof DomainError)) console.error('Error del asistente (stream):', error);
        send({
          type: 'error',
          error: error instanceof DomainError ? error.message : 'No pudimos procesar tu mensaje. Inténtalo de nuevo.',
        });
      } finally {
        releaseStreamSlot(ownerUserId);
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            // El stream pudo cancelarse entre el último send y aquí: inofensivo.
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
