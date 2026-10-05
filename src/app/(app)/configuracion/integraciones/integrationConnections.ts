import { createHash, randomUUID } from 'node:crypto';
import { GoogleCalendarCredentials } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarCredentials';
import { isIntegrationSecretKey } from '@/contexts/practitioner/domain/integrationCredentials';
import {
  decryptIntegrationConfig,
  encryptIntegrationConfig,
  IntegrationConfigEncryptionError,
  type IntegrationConfigContext,
} from '@/shared/infrastructure/crypto/IntegrationConfigEncryption';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Acceso a integration_connections para la pantalla de Integraciones.
 * Nota de arquitectura: este acceso debería vivir como SqliteIntegrationConnectionRepository
 * dentro del contexto practitioner (dueño de las integraciones); se deja aquí para no
 * invadir archivos de otro agente. Mover cuando el contexto practitioner esté completo.
 *
 * v2 §6.4: aquí SOLO viven las pasarelas personales del profesional (Stripe,
 * PayPal, Mercado Pago) y Google Calendar. WhatsApp, correo e IA son proveedores
 * de plataforma y se administran en /admin/proveedores.
 */
export type IntegrationProvider = 'stripe' | 'paypal' | 'mercado_pago' | 'google_calendar';

export type IntegrationStatus = 'desconectado' | 'conectado' | 'simulado';

export interface IntegrationConnection {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  config: Record<string, string>;
  connectedAt: string | null;
}

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  'stripe',
  'paypal',
  'mercado_pago',
  'google_calendar',
];

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as string[]).includes(value);
}

/**
 * Revisión opaca para reconciliar formularios cliente sin incluir credenciales
 * en el key de React ni en atributos del DOM.
 */
export function integrationConfigurationRevision(
  connection: IntegrationConnection | undefined,
): string {
  const configShape = Object.entries(connection?.config ?? {})
    .map(([key, value]) => ({ key, present: value.trim() !== '' }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return createHash('sha256')
    .update(
      JSON.stringify({
        provider: connection?.provider ?? '',
        status: connection?.status ?? 'desconectado',
        connectedAt: connection?.connectedAt ?? null,
        configShape,
      }),
    )
    .digest('hex');
}

export function effectiveIntegrationStatus(
  provider: IntegrationProvider,
  storedStatus: IntegrationStatus,
  config: Record<string, string>,
): IntegrationStatus {
  if (provider === 'google_calendar' && !GoogleCalendarCredentials.areComplete(config)) {
    return 'desconectado';
  }
  return storedStatus;
}

interface ConnectionRow {
  id: string;
  provider: IntegrationProvider;
  owner_user_id: string;
  status: IntegrationStatus;
  config_json: string;
  connected_at: string | null;
}

function contextOf(row: ConnectionRow): IntegrationConfigContext {
  return { id: row.id, provider: row.provider, ownerUserId: row.owner_user_id };
}

async function ensureIntegrationRows(db: DatabaseAdapter, ownerUserId: string): Promise<void> {
  for (const provider of INTEGRATION_PROVIDERS) {
    await db.execute(
      `INSERT INTO integration_connections (id, provider, owner_user_id, status)
       VALUES (?, ?, ?, 'desconectado')
       ON CONFLICT DO NOTHING`,
      [randomUUID(), provider, ownerUserId],
    );
  }
}

async function integrationRow(
  db: DatabaseAdapter,
  provider: IntegrationProvider,
  ownerUserId: string,
): Promise<ConnectionRow> {
  await ensureIntegrationRows(db, ownerUserId);
  const row = await db.queryRow<ConnectionRow>(
    `SELECT id, provider, owner_user_id, status, config_json, connected_at
       FROM integration_connections WHERE provider = ? AND owner_user_id = ?`,
    [provider, ownerUserId],
  );
  if (!row) throw new Error('No se pudo preparar la fila de la integración.');
  return row;
}

export async function listIntegrationConnections(
  ownerUserId: string,
  db: DatabaseAdapter = getDatabaseAdapter(),
): Promise<IntegrationConnection[]> {
  // Las integraciones personales son POR PROFESIONAL (migración v6);
  // aseguramos sus filas la primera vez (UNIQUE(provider, owner), idempotente).
  await ensureIntegrationRows(db, ownerUserId);

  const rows = (await db.query(
    `SELECT id, provider, owner_user_id, status, config_json, connected_at
       FROM integration_connections WHERE owner_user_id = ?`,
    [ownerUserId],
  )) as unknown as ConnectionRow[];
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return INTEGRATION_PROVIDERS.flatMap((provider) => {
    const row = byProvider.get(provider);
    if (!row) return [];
    let config: Record<string, string> = {};
    let storedStatus = row.status;
    try {
      config = decryptIntegrationConfig(row.config_json, contextOf(row));
    } catch (error) {
      if (!(error instanceof IntegrationConfigEncryptionError)) throw error;
      storedStatus = 'desconectado';
      console.error(
        `[seguridad] La configuración cifrada de ${provider} no está disponible; se mostró desconectada.`,
      );
    }
    return [
      {
        provider,
        status: effectiveIntegrationStatus(provider, storedStatus, config),
        config,
        connectedAt: row.connected_at,
      },
    ];
  });
}

export async function saveIntegrationCredentials(
  provider: IntegrationProvider,
  config: Record<string, string>,
  ownerUserId: string,
  db: DatabaseAdapter = getDatabaseAdapter(),
): Promise<IntegrationStatus> {
  const row = await integrationRow(db, provider, ownerUserId);
  const current = decryptIntegrationConfig(row.config_json, contextOf(row));
  const merged = { ...current };
  for (const [key, value] of Object.entries(config)) {
    if (isIntegrationSecretKey(key) && value.trim() === '') continue;
    merged[key] = value;
  }
  const hasCredentials =
    provider === 'google_calendar'
      ? GoogleCalendarCredentials.create(merged) !== null
      : Object.values(merged).some((value) => value.trim() !== '');
  const status: IntegrationStatus = hasCredentials ? 'conectado' : 'desconectado';
  await db.execute(
    'UPDATE integration_connections SET status = ?, config_json = ?, connected_at = ? WHERE id = ?',
    [
      status,
      encryptIntegrationConfig(merged, contextOf(row)),
      hasCredentials ? new Date().toISOString() : null,
      row.id,
    ],
  );
  return status;
}

export async function clearIntegrationCredentials(
  provider: IntegrationProvider,
  ownerUserId: string,
  db: DatabaseAdapter = getDatabaseAdapter(),
): Promise<void> {
  const row = await integrationRow(db, provider, ownerUserId);
  await db.execute(
    `UPDATE integration_connections
        SET status = 'desconectado', config_json = '{}', connected_at = NULL
      WHERE id = ?`,
    [row.id],
  );
}

// Nota: la escritura de pasarelas de cobro (manual + vinculación OAuth
// simulada) vive en el contexto practitioner:
// SqlitePaymentGatewayRepository (saveManualConfig/linkAccount/unlinkAccount).
