import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { ChatThread, ChatThreadPrimitives } from '../../domain/ChatThread';
import { ChatMessage, ChatMessagePrimitives, ChatRole } from '../../domain/ChatMessage';
import type { ChatThreadRepository, ChatThreadSummary } from '../../domain/repositories/ChatThreadRepository';

interface ThreadRow {
  id: string;
  title: string;
  patient_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ThreadSummaryRow extends ThreadRow {
  patient_name: string | null;
}

interface MessageRow {
  id: string;
  thread_id: string;
  role: string;
  content: string;
  created_at: string;
}

function rowToThread(row: ThreadRow): ChatThread {
  const primitives: ChatThreadPrimitives = {
    id: row.id,
    // El título es un extracto de la primera pregunta clínica: cifrado at-rest
    // (pase v6 de clinicalEncryption). decryptField tolera valores legados en claro.
    title: decryptField(row.title),
    patientId: row.patient_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return ChatThread.fromPrimitives(primitives);
}

function rowToMessage(row: MessageRow): ChatMessage {
  const primitives: ChatMessagePrimitives = {
    id: row.id,
    threadId: row.thread_id,
    role: row.role as ChatRole,
    // Cifrado at-rest (v3 §1.1): los mensajes del chat clínico se descifran al leer.
    content: decryptField(row.content),
    createdAt: row.created_at,
  };
  return ChatMessage.fromPrimitives(primitives);
}

/**
 * Repositorio SQLite de hilos/mensajes del asistente, acotado al dueño en
 * sesión: TODA lectura y escritura filtra por owner_user_id en la propia
 * consulta SQL. Un dueño no puede leer, listar, sobrescribir ni añadir
 * mensajes a hilos de otro dueño.
 */
export class SqliteChatThreadRepository implements ChatThreadRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(thread: ChatThread): Promise<void> {
    const p = thread.toPrimitives();
    await this.db.execute(
      `INSERT INTO ai_chat_threads (id, owner_user_id, title, patient_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           patient_id = excluded.patient_id,
           updated_at = excluded.updated_at
         WHERE ai_chat_threads.owner_user_id = excluded.owner_user_id`,
      [p.id, this.ownerUserId, encryptField(p.title), p.patientId, p.createdAt, p.updatedAt],
    );
  }

  public async findById(threadId: string): Promise<ChatThread | null> {
    const row = await this.db.queryRow<ThreadRow>(
      'SELECT * FROM ai_chat_threads WHERE id = ? AND owner_user_id = ?',
      [threadId, this.ownerUserId],
    );
    return row ? rowToThread(row) : null;
  }

  public async listSummaries(): Promise<ChatThreadSummary[]> {
    const rows = await this.db.query<ThreadSummaryRow>(
      `SELECT t.id, t.title, t.patient_id, t.created_at, t.updated_at, p.full_name AS patient_name
         FROM ai_chat_threads t
         LEFT JOIN patients p ON p.id = t.patient_id AND p.owner_user_id = t.owner_user_id
         WHERE t.owner_user_id = ?
         ORDER BY t.updated_at DESC`,
      [this.ownerUserId],
    );

    return rows.map((row) => ({
      id: row.id,
      title: decryptField(row.title),
      patientId: row.patient_id,
      patientName: row.patient_name,
      updatedAt: row.updated_at,
    }));
  }

  public async appendMessage(message: ChatMessage): Promise<void> {
    const p = message.toPrimitives();
    // INSERT condicionado: solo si el hilo pertenece al dueño en sesión.
    await this.db.execute(
      `INSERT INTO ai_chat_messages (id, thread_id, role, content, created_at)
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM ai_chat_threads WHERE id = ? AND owner_user_id = ?)`,
      [p.id, p.threadId, p.role, encryptField(p.content), p.createdAt, p.threadId, this.ownerUserId],
    );
  }

  public async listMessages(threadId: string): Promise<ChatMessage[]> {
    // Desempate por rol: los dos mensajes de un turno pueden compartir created_at
    // (mismo milisegundo al persistir juntos) y el id es un UUID aleatorio — sin
    // esto, al recargar el hilo la respuesta podía pintarse ANTES que su pregunta.
    const rows = await this.db.query<MessageRow>(
      `SELECT m.id, m.thread_id, m.role, m.content, m.created_at
         FROM ai_chat_messages m
         JOIN ai_chat_threads t ON t.id = m.thread_id
         WHERE m.thread_id = ? AND t.owner_user_id = ?
         ORDER BY m.created_at ASC, CASE m.role WHEN 'usuario' THEN 0 ELSE 1 END ASC, m.id ASC`,
      [threadId, this.ownerUserId],
    );
    return rows.map(rowToMessage);
  }
}
