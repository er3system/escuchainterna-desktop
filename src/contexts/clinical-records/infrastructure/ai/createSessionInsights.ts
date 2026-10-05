import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { aiCloudEnabled } from '@/shared/infrastructure/ai-billing/aiCloudGate';
import { SessionInsights } from '../../domain/SessionInsights';
import { AnthropicSessionInsights } from './AnthropicSessionInsights';
import { LocalSessionInsights } from './LocalSessionInsights';
import { MeteredSessionInsights } from './MeteredSessionInsights';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';

export interface SessionInsightsMetering {
  /** Dueño en sesión: a su nombre se registran los eventos de uso de IA. */
  ownerUserId: string;
  /** Modelo RESUELTO por la puerta de presupuesto (resolveAiAccess). */
  model: string;
}

/** Nombre del profesional (perfil) para personalizar el tono (v3 §13). */
async function readProfessionalName(ownerUserId: string): Promise<string> {
  const row = await getDatabaseAdapter().queryRow<{ full_name?: string }>(
    'SELECT full_name FROM practitioner_profile WHERE user_id = ?',
    [ownerUserId],
  );
  return (row?.full_name ?? '').trim();
}

/**
 * Fábrica del puerto de inteligencia clínica. SIEMPRE medida: el adaptador
 * real (Anthropic con ANTHROPIC_API_KEY, local sin red en caso contrario) va
 * envuelto en MeteredSessionInsights, que registra cada interacción en
 * `ai_usage_events` con el modelo resuelto — en modo local, el que se habría
 * usado, para que los límites y el dashboard sean realistas.
 *
 * Ambos adaptadores reciben el nombre del profesional para el tono
 * personalizado (v3 §13).
 */
export async function createSessionInsights(
  metering: SessionInsightsMetering,
): Promise<SessionInsights> {
  const professionalName = await readProfessionalName(metering.ownerUserId);
  if (isDesktopEdition()) {
    const config = await aiCloudEnabled() ? await new SqlitePersonalProviderRepository().find(metering.ownerUserId, 'anthropic') : null;
    const inner = config ? new AnthropicSessionInsights(config.api_key, config.model, professionalName) : new LocalSessionInsights(professionalName);
    return new MeteredSessionInsights(inner, metering.ownerUserId, config?.model ?? metering.model);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Kill-switch global: si la IA en nube está apagada, se fuerza el adaptador LOCAL aunque haya clave.
  const useCloud = apiKey !== undefined && apiKey.trim().length > 0 && (await aiCloudEnabled());
  const inner: SessionInsights = useCloud
    ? new AnthropicSessionInsights(apiKey.trim(), metering.model, professionalName)
    : new LocalSessionInsights(professionalName);
  return new MeteredSessionInsights(inner, metering.ownerUserId, metering.model);
}

/**
 * Solo informativo para la UI (badge "Claude" / "IA local"); no mide nada.
 * MISMA condición que la fábrica del motor (clave presente Y kill-switch de IA
 * en nube encendido): con el kill-switch apagado se sirve el adaptador local
 * aunque haya clave, y el badge debe decir lo mismo que hace el motor.
 */
export async function sessionInsightsProviderName(ownerUserId?: string): Promise<'anthropic' | 'local'> {
  if (isDesktopEdition()) return ownerUserId && await aiCloudEnabled() && await new SqlitePersonalProviderRepository().find(ownerUserId, 'anthropic') ? 'anthropic' : 'local';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey && apiKey.trim().length > 0 && (await aiCloudEnabled()) ? 'anthropic' : 'local';
}
