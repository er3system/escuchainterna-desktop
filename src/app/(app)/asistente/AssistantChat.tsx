'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BookOpenText,
  Info,
  Loader2,
  MessageSquarePlus,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import type {
  ChatMessageDto,
  PatientOptionDto,
  SendMessageResultDto,
  ThreadDetailDto,
  ThreadSummaryDto,
} from '@/contexts/assistant/application/AssistantReadModels';
import { parseAssistantMessage } from '@/contexts/assistant/domain/caseEvidence';
import { Button } from '@/components/ui';
import { anclarPaciente, cargarHilo } from './actions';

/** Frame del stream NDJSON del chat (ver /api/asistente/stream). */
type ChatStreamFrame =
  | { type: 'delta'; text: string }
  | { type: 'done'; result: SendMessageResultDto }
  | { type: 'error'; error: string };

const MAX_LENGTH = 2000;

const GENERIC_SEND_ERROR = 'No pudimos procesar tu mensaje. Inténtalo de nuevo.';

/**
 * Error con mensaje pensado para el usuario (viene del servidor o de un caso
 * conocido). Cualquier otro error (JSON.parse, red…) se sustituye por el
 * genérico: nunca se le enseña al usuario un mensaje técnico crudo.
 */
class KnownChatError extends Error {}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'd MMM yyyy', { locale: es });
}

function timeOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'HH:mm', { locale: es });
}

const CITATION_SPLIT = /(\[\d+\])/g;
const CITATION_ONE = /^\[\d+\]$/;

/** Resalta las marcas de cita [1], [2]… dentro del cuerpo de la respuesta. */
function withCitationMarks(text: string): React.ReactNode {
  return text.split(CITATION_SPLIT).map((segment, index) =>
    CITATION_ONE.test(segment) ? (
      <sup key={index} className="mx-0.5 font-medium text-primary dark:text-accent-2">
        {segment}
      </sup>
    ) : (
      <span key={index}>{segment}</span>
    ),
  );
}

/**
 * Burbuja del asistente con citas a la fuente + huecos: separa el cuerpo (con
 * marcas [n] resaltadas), la lista numerada de "Fuentes" y, en estilo sutil,
 * "Lo que no consta en el expediente". Reusa el parseo PURO de caseEvidence.
 */
function AssistantBubble({ content, streaming }: { content: string; streaming: boolean }) {
  // Mientras la respuesta se escribe en vivo NO se parsean Fuentes/huecos: el
  // texto parcial haría aparecer y desaparecer secciones a medio armar
  // (parpadeo). Se muestra el crudo con las marcas [n] resaltadas; el parseo
  // completo llega al reconciliar con el mensaje persistido.
  if (streaming) {
    return <p className="whitespace-pre-wrap leading-relaxed">{withCitationMarks(content)}</p>;
  }

  const { body, sources, gaps } = parseAssistantMessage(content);

  return (
    <div className="space-y-2.5">
      <p className="whitespace-pre-wrap leading-relaxed">{withCitationMarks(body)}</p>

      {sources.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface px-3 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            <BookOpenText size={12} className="text-primary dark:text-accent-2" /> Fuentes
          </p>
          <ol className="space-y-0.5">
            {sources.map((label, index) => (
              <li key={`${index}-${label}`} className="flex gap-1.5 text-xs text-ink-soft">
                <span className="font-medium text-primary dark:text-accent-2">[{index + 1}]</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {gaps.length > 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-bg px-3 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
            <Info size={12} /> Lo que no consta en el expediente
          </p>
          <ul className="space-y-0.5">
            {gaps.map((gap, index) => (
              <li key={`${index}-${gap}`} className="text-xs text-ink-soft">
                · {gap}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Chat del asistente de IA. Lo comparten la página /asistente (con lista de
 * hilos) y el panel lateral del botón flotante (variant="panel").
 * Solo importa tipos puros + server actions: nada de módulos de Node.
 */
export function AssistantChat({
  patients,
  initialThreads,
  initialThread,
  variant,
}: {
  patients: PatientOptionDto[];
  initialThreads: ThreadSummaryDto[];
  initialThread: ThreadDetailDto | null;
  variant: 'pagina' | 'panel';
}) {
  const [threads, setThreads] = useState<ThreadSummaryDto[]>(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(initialThread?.id ?? null);
  const [messages, setMessages] = useState<ChatMessageDto[]>(initialThread?.messages ?? []);
  const [anchorId, setAnchorId] = useState<string>(initialThread?.patientId ?? '');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Id de la burbuja del asistente que se está escribiendo en vivo (null hasta el
  // primer token): mientras es null se muestra "Pensando…", luego la burbuja crece.
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // ¿El usuario está (casi) pegado al fondo del hilo? Solo entonces auto-bajamos
  // con cada delta: si subió a leer mientras streamea, no le arrebatamos el scroll.
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  function handleMessagesScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function startNewThread() {
    // Los deltas del stream escriben sobre el estado global de mensajes: cambiar
    // de conversación a mitad de un envío contaminaría la vista nueva con la
    // respuesta del hilo anterior. Mientras se envía, no se cambia de hilo.
    if (sending) return;
    setActiveId(null);
    setMessages([]);
    setAnchorId('');
    setError(null);
  }

  async function selectThread(threadId: string) {
    // `sending`: misma carrera que en startNewThread (el stream escribiría sobre
    // el hilo recién cargado).
    if (threadId === activeId || loadingThread || sending) return;
    setLoadingThread(true);
    setError(null);
    try {
      const detail = await cargarHilo(threadId);
      if (detail) {
        setActiveId(detail.id);
        setMessages(detail.messages);
        setAnchorId(detail.patientId ?? '');
      } else {
        setError('No encontramos esa conversación.');
      }
    } catch {
      // Rechazo de la server action (red caída, sesión expirada…): sin el
      // finally, loadingThread quedaría en true para siempre.
      setError('No pudimos cargar esa conversación. Inténtalo de nuevo.');
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleAnchorChange(value: string) {
    // Anclaje optimista: recordamos el valor previo para revertir si falla.
    const previousAnchorId = anchorId;
    setAnchorId(value);
    if (activeId === null) return; // se usará al crear el hilo
    try {
      const res = await anclarPaciente(activeId, value === '' ? null : value);
      if (!res.ok) {
        setAnchorId(previousAnchorId);
        setError(res.error);
        return;
      }
      const patientName = patients.find((p) => p.id === value)?.fullName ?? null;
      setThreads((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, patientId: value || null, patientName } : t)),
      );
    } catch {
      setAnchorId(previousAnchorId);
      setError('No pudimos anclar el paciente. Inténtalo de nuevo.');
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (content.length === 0 || sending) return;
    setSending(true);
    setError(null);

    const tempId = `temporal-${Date.now()}`;
    const streamId = `stream-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'usuario', content, createdAt: new Date().toISOString() },
    ]);
    setInput('');

    try {
      const res = await fetch('/api/asistente/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          threadId: activeId,
          patientId: activeId === null ? (anchorId === '' ? null : anchorId) : null,
          content,
        }),
      });

      if (!res.ok || res.body === null) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new KnownChatError(data?.error ?? GENERIC_SEND_ERROR);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamedText = '';
      let hasBubble = false;
      let result: SendMessageResultDto | null = null;
      let streamError: string | null = null;

      // Añade/actualiza la burbuja en vivo del asistente (la crea al primer token).
      const applyDelta = (text: string) => {
        streamedText += text;
        if (!hasBubble) {
          hasBubble = true;
          setStreamingId(streamId);
          setMessages((prev) => [
            ...prev,
            { id: streamId, role: 'asistente', content: streamedText, createdAt: new Date().toISOString() },
          ]);
        } else {
          setMessages((prev) => prev.map((m) => (m.id === streamId ? { ...m, content: streamedText } : m)));
        }
      };

      let chunk = await reader.read();
      while (!chunk.done) {
        buffer += decoder.decode(chunk.value, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
          if (line === '') continue;
          // Una línea malformada (chunk cortado por un proxy, basura puntual) se
          // IGNORA en vez de abortar todo el stream; si por eso nunca llega el
          // frame `done`, el error de "respuesta interrumpida" de abajo lo cubre.
          let frame: ChatStreamFrame;
          try {
            frame = JSON.parse(line) as ChatStreamFrame;
          } catch {
            continue;
          }
          if (frame.type === 'delta') applyDelta(frame.text);
          else if (frame.type === 'done') result = frame.result;
          else streamError = frame.error;
        }
        chunk = await reader.read();
      }

      if (streamError !== null) throw new KnownChatError(streamError);
      if (result === null) throw new KnownChatError('La respuesta se interrumpió. Inténtalo de nuevo.');

      // Reconciliación: cambia las burbujas temporales por lo que quedó PERSISTIDO.
      const finalResult = result;
      setStreamingId(null);
      setActiveId(finalResult.threadId);
      setAnchorId(finalResult.patientId ?? '');
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId && m.id !== streamId),
        finalResult.userMessage,
        finalResult.assistantMessage,
      ]);
      setThreads((prev) => [
        {
          id: finalResult.threadId,
          title: finalResult.threadTitle,
          patientId: finalResult.patientId,
          patientName: finalResult.patientName,
          updatedAt: new Date().toISOString(),
        },
        ...prev.filter((t) => t.id !== finalResult.threadId),
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m.id !== streamId));
      setStreamingId(null);
      // Devuelve el texto al composer SOLO si sigue vacío: no pisar un borrador
      // que el usuario haya escrito mientras corría el stream.
      setInput((cur) => (cur.trim() === '' ? content : cur));
      // Solo los mensajes "humanos" conocidos llegan al usuario; cualquier otro
      // error (parseo, red…) se sustituye por el genérico.
      setError(err instanceof KnownChatError ? err.message : GENERIC_SEND_ERROR);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Durante la composición IME (coreano/japonés/chino…) Enter confirma el
    // texto compuesto, no debe enviar el mensaje.
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  const suggestions = [
    ...(patients.length > 0 ? [`¿Qué notas recientes tengo de ${patients[0].fullName}?`] : []),
    ...(patients.length > 0 ? [`¿Cuándo es la próxima cita de ${patients[0].fullName}?`] : []),
    '¿Cómo configuro los recordatorios de sesión en la plataforma?',
  ];

  const chatPanel = (
    <section className="flex min-h-0 flex-1 flex-col rounded-card border border-line bg-surface">
      {/* Encabezado: alcance permitido + paciente anclado */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-ink-soft">
          <ShieldCheck size={14} className="shrink-0 text-success" />
          Solo respondo sobre tus pacientes, tu consulta y la plataforma.
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
          Hablar sobre:
          {/* Deshabilitado durante el stream: el anclaje del envío en curso ya
              quedó fijado y cambiarlo a mitad confundiría a qué paciente
              corresponde la respuesta que se está escribiendo. */}
          <select
            value={anchorId}
            onChange={(event) => void handleAnchorChange(event.target.value)}
            disabled={sending}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Sin paciente anclado</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mensajes. aria-live: el lector de pantalla anuncia las respuestas nuevas. */}
      <div
        ref={scrollRef}
        onScroll={handleMessagesScroll}
        aria-live="polite"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {loadingThread ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 size={16} className="animate-spin" /> Cargando conversación…
          </p>
        ) : messages.length === 0 && !sending ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Sparkles size={28} className="text-primary" />
            <p className="text-sm font-medium text-ink">¿En qué te ayudo con tu consulta?</p>
            <p className="max-w-sm text-xs text-ink-soft">
              Pregúntame por las notas, citas, diagnósticos o historia clínica de tus pacientes, o por el uso
              de la plataforma. Otros temas quedan fuera de mi alcance.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setInput(text)}
                  className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-primary hover:text-primary"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-2 ${message.role === 'usuario' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'asistente' ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light">
                  <Sparkles size={14} className="text-primary" />
                </span>
              ) : null}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === 'usuario'
                    ? 'whitespace-pre-wrap rounded-br-md bg-primary text-white'
                    : 'rounded-bl-md border border-line bg-bg text-ink'
                }`}
              >
                {message.role === 'asistente' ? (
                  <AssistantBubble content={message.content} streaming={message.id === streamingId} />
                ) : (
                  message.content
                )}
                <span
                  className={`mt-1 block text-right text-[10px] ${
                    message.role === 'usuario' ? 'text-white/70' : 'text-ink-soft'
                  }`}
                >
                  {timeOf(message.createdAt)}
                </span>
              </div>
              {message.role === 'usuario' ? (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg">
                  <UserIcon size={14} className="text-ink-soft" />
                </span>
              ) : null}
            </div>
          ))
        )}
        {sending && streamingId === null ? (
          <div className="flex items-end gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light">
              <Sparkles size={14} className="text-primary" />
            </span>
            <div className="rounded-2xl rounded-bl-md border border-line bg-bg px-3.5 py-2.5 text-sm text-ink-soft">
              <span className="animate-pulse">Pensando…</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Composer */}
      <div className="border-t border-line px-4 py-3">
        {error ? (
          <p role="alert" className="mb-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={variant === 'panel' ? 2 : 2}
            maxLength={MAX_LENGTH}
            aria-label="Mensaje para el asistente"
            placeholder="Escribe tu pregunta… (Enter para enviar)"
            className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || input.trim().length === 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar mensaje"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
          </button>
        </div>
      </div>
    </section>
  );

  if (variant === 'panel') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 px-1">
          {/* Deshabilitados durante el stream: los deltas escriben sobre el estado
              global de mensajes y cambiar de hilo a mitad contaminaría la vista
              nueva con la respuesta del hilo anterior (los handlers también lo
              cortan, esto es la señal visual). */}
          <select
            value={activeId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value === '') startNewThread();
              else void selectThread(value);
            }}
            disabled={sending}
            aria-label="Elegir conversación del asistente"
            className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Nueva conversación</option>
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.title}
                {thread.patientName ? ` · ${thread.patientName}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={startNewThread}
            disabled={sending}
            aria-label="Nueva conversación"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-xs text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:text-ink-soft"
          >
            <MessageSquarePlus size={14} /> Nueva
          </button>
        </div>
        {chatPanel}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      {/* Lista de hilos */}
      <aside className="flex max-h-44 w-full shrink-0 flex-col rounded-card border border-line bg-surface md:max-h-none md:w-64">
        <div className="border-b border-line p-3">
          {/* disabled durante el stream: cambiar de hilo a mitad de un envío
              contaminaría la vista (los deltas escriben el estado global). */}
          <Button type="button" onClick={startNewThread} disabled={sending} className="w-full px-3">
            <MessageSquarePlus size={16} /> Nueva conversación
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {threads.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-ink-soft">
              Aún no tienes conversaciones. Empieza una nueva.
            </p>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => void selectThread(thread.id)}
                disabled={sending}
                className={`block w-full rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  thread.id === activeId ? 'bg-primary-light' : 'hover:bg-bg'
                }`}
              >
                <span
                  className={`block truncate text-sm font-medium ${
                    thread.id === activeId ? 'text-primary' : 'text-ink'
                  }`}
                >
                  {thread.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-soft">
                  {thread.patientName ? `${thread.patientName} · ` : ''}
                  {shortDate(thread.updatedAt)}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
      {chatPanel}
    </div>
  );
}
