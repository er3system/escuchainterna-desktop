import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  decryptIntegrationConfig,
  encryptIntegrationConfig,
  IntegrationConfigEncryptionError,
  type IntegrationConfigContext,
} from '@/shared/infrastructure/crypto/IntegrationConfigEncryption';
import {
  isIntegrationSecretKey,
  REDACTED_INTEGRATION_SECRET,
} from '../../domain/integrationCredentials';
import {
  PAYMENT_GATEWAY_PROVIDERS,
  isGatewayActiveForPatients,
  parsePaymentGatewaySettings,
  type PaymentGatewayProvider,
  type PaymentGatewaySettings,
} from '../../domain/paymentGateways';
import type { PaymentGatewayRepository } from '../../domain/repositories/PaymentGatewayRepository';

interface GatewayRow {
  id: string;
  provider: string;
  owner_user_id: string;
  config_json: string;
}

/**
 * Pasarelas de cobro POR PROFESIONAL (migración v6): integration_connections
 * lleva owner_user_id; las filas con owner_user_id = '' son los proveedores
 * globales de plataforma (whatsapp, email) y no se tocan aquí.
 *
 * Estados que escribe este repo (modo local): 'simulado' cuando la pasarela
 * queda configurada (vinculada por OAuth simulado o con credenciales
 * manuales) y 'desconectado' cuando no. En producción, 'conectado' lo pondrá
 * el backend real de cada pasarela tras validar la conexión.
 */
export class SqlitePaymentGatewayRepository implements PaymentGatewayRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async find(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
  ): Promise<PaymentGatewaySettings | null> {
    const row = await this.connection(provider, ownerUserId);
    if (!row) return null;
    try {
      return parsePaymentGatewaySettings(provider, this.configOf(row));
    } catch (error) {
      if (error instanceof IntegrationConfigEncryptionError) {
        console.error(
          `[seguridad] La configuración cifrada de ${provider} no está disponible; se bloqueó el checkout.`,
        );
        return null;
      }
      throw error;
    }
  }

  public async listActiveForPatients(ownerUserId: string): Promise<PaymentGatewaySettings[]> {
    const active: PaymentGatewaySettings[] = [];
    for (const provider of PAYMENT_GATEWAY_PROVIDERS) {
      const settings = await this.find(provider, ownerUserId);
      if (settings && isGatewayActiveForPatients(settings)) active.push(settings);
    }
    return active;
  }

  public async saveManualConfig(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
    config: Record<string, string>,
  ): Promise<PaymentGatewaySettings> {
    // Merge clave a clave: el formulario manual no conoce (ni debe borrar)
    // los campos de vinculación linked_account_id/linked_at/link_method.
    const merged = { ...(await this.readConfig(provider, ownerUserId)) };
    for (const [key, value] of Object.entries(config)) {
      if (
        isIntegrationSecretKey(key) &&
        (value.trim() === '' || value === REDACTED_INTEGRATION_SECRET)
      ) {
        continue;
      }
      merged[key] = value;
    }
    return this.writeConfig(provider, ownerUserId, merged);
  }

  public async linkAccount(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
    linkedAccountId: string,
  ): Promise<PaymentGatewaySettings> {
    const current = await this.readConfig(provider, ownerUserId);
    const merged: Record<string, string> = {
      ...current,
      linked_account_id: linkedAccountId,
      linked_at: new Date().toISOString(),
      link_method: 'oauth',
      // Por defecto el botón de pago queda visible al vincular; se respeta
      // un 'false' explícito que el dueño hubiera guardado antes.
      show_payment_button: current.show_payment_button === 'false' ? 'false' : 'true',
    };
    return this.writeConfig(provider, ownerUserId, merged);
  }

  public async unlinkAccount(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
  ): Promise<PaymentGatewaySettings> {
    const current = await this.readConfig(provider, ownerUserId);
    delete current.linked_account_id;
    delete current.linked_at;
    delete current.link_method;
    return this.writeConfig(provider, ownerUserId, current);
  }

  private async readConfig(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
  ): Promise<Record<string, string>> {
    const row = await this.connection(provider, ownerUserId);
    return row ? this.configOf(row) : {};
  }

  private async writeConfig(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
    config: Record<string, string>,
  ): Promise<PaymentGatewaySettings> {
    const settings = parsePaymentGatewaySettings(provider, config);
    const status = settings.configured ? 'simulado' : 'desconectado';
    const row = await this.connection(provider, ownerUserId);
    if (!row) throw new Error('No se pudo preparar la fila de la pasarela.');
    await this.db.execute(
      'UPDATE integration_connections SET status = ?, config_json = ?, connected_at = ? WHERE id = ?',
      [
        status,
        encryptIntegrationConfig(config, SqlitePaymentGatewayRepository.contextOf(row)),
        settings.configured ? new Date().toISOString() : null,
        row.id,
      ],
    );
    return settings;
  }

  /** Crea (idempotente) las filas de pasarela del dueño la primera vez. */
  private async ensureRows(ownerUserId: string): Promise<void> {
    for (const provider of PAYMENT_GATEWAY_PROVIDERS) {
      await this.db.execute(
        `INSERT INTO integration_connections (id, provider, owner_user_id, status)
         VALUES (?, ?, ?, 'desconectado')
         ON CONFLICT DO NOTHING`,
        [randomUUID(), provider, ownerUserId],
      );
    }
  }

  private async connection(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
  ): Promise<GatewayRow | null> {
    await this.ensureRows(ownerUserId);
    return this.db.queryRow<GatewayRow>(
      `SELECT id, provider, owner_user_id, config_json
         FROM integration_connections WHERE provider = ? AND owner_user_id = ?`,
      [provider, ownerUserId],
    );
  }

  private configOf(row: GatewayRow): Record<string, string> {
    return decryptIntegrationConfig(row.config_json, SqlitePaymentGatewayRepository.contextOf(row));
  }

  private static contextOf(row: GatewayRow): IntegrationConfigContext {
    return { id: row.id, provider: row.provider, ownerUserId: row.owner_user_id };
  }
}
