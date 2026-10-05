import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Read model de la página /configuracion/asistentes: los asistentes del
 * titular con los datos de su cuenta (correo, nombre, estado). Objetos planos
 * listos para client components.
 */
export interface AssistantAccountSummary {
  assistantUserId: string;
  fullName: string;
  email: string;
  status: 'activo' | 'suspendido';
  createdAt: string;
}

interface DirectoryRow {
  assistant_user_id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  created_at: string;
}

export class SqliteAssistantDirectoryReader {
  public async listByOwner(ownerUserId: string): Promise<AssistantAccountSummary[]> {
    const rows = await getDatabaseAdapter().query<DirectoryRow>(
      `SELECT a.assistant_user_id, a.created_at,
              u.email, u.status,
              p.full_name
         FROM assistants a
         LEFT JOIN users u ON u.id = a.assistant_user_id
         LEFT JOIN practitioner_profile p ON p.user_id = a.assistant_user_id
        WHERE a.owner_user_id = ?
        ORDER BY a.created_at ASC`,
      [ownerUserId],
    );

    return rows.map((row) => ({
      assistantUserId: row.assistant_user_id,
      fullName: row.full_name ?? '',
      email: row.email ?? '',
      status: row.status === 'suspendido' ? 'suspendido' : 'activo',
      createdAt: row.created_at,
    }));
  }
}
