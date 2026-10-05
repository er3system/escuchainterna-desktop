import type { PlatformSettingsRepository } from '../../domain/repositories/PlatformSettingsRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

export const PLATFORM_PROVIDERS_KEY = 'platform_providers';

export type ProviderStatus = 'simulado' | 'configurado';

export interface ProviderState {
  status: ProviderStatus;
  config: Record<string, string>;
  updatedAt: string | null;
}

export type PlatformProvidersState = Record<string, ProviderState>;

/** Lee y normaliza el estado de proveedores guardado en platform_settings. */
export function parseProvidersState(json: string | null): PlatformProvidersState {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const state: PlatformProvidersState = {};
    for (const [providerId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as Partial<ProviderState>;
      const config: Record<string, string> = {};
      if (entry.config && typeof entry.config === 'object') {
        for (const [key, fieldValue] of Object.entries(entry.config)) {
          if (typeof fieldValue === 'string') config[key] = fieldValue;
        }
      }
      state[providerId] = {
        status: entry.status === 'configurado' ? 'configurado' : 'simulado',
        config,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null,
      };
    }
    return state;
  } catch {
    return {};
  }
}

/**
 * Guarda la configuración de UN proveedor de plataforma (WhatsApp Business,
 * email transaccional, IA, pasarela, almacenamiento). El estado pasa a
 * 'configurado' cuando hay al menos una credencial no vacía; si se borran
 * todas vuelve a 'simulado'. Solo el admin configura proveedores. Auditado.
 */
export class AdminConfigureProvider {
  public constructor(
    private readonly settings: PlatformSettingsRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async configure(actorUserId: string, providerId: string, config: Record<string, string>): Promise<ProviderState> {
    const id = providerId.trim();
    if (!id) throw new Error('Identificador de proveedor vacío.');

    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) cleaned[key] = value.trim();
    const configured = Object.values(cleaned).some((value) => value.length > 0);

    const state = parseProvidersState(await this.settings.get(PLATFORM_PROVIDERS_KEY));
    const entry: ProviderState = {
      status: configured ? 'configurado' : 'simulado',
      config: cleaned,
      updatedAt: new Date().toISOString(),
    };
    state[id] = entry;
    await this.settings.set(PLATFORM_PROVIDERS_KEY, JSON.stringify(state));

    await this.audit.record({
      actorUserId,
      action: 'configurar_proveedor',
      target: id,
      // Por higiene NUNCA se vuelcan credenciales al log: solo las claves tocadas.
      details: { status: entry.status, fields: Object.keys(cleaned) },
    });
    return entry;
  }
}
