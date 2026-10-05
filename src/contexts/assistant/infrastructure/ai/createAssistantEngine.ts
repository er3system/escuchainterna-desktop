import type { AiAccess } from '@/shared/infrastructure/ai-billing/AiBudgetGate';
import { AI_BUDGET_BLOCKED_MESSAGE } from '@/shared/infrastructure/ai-billing/AiBudgetGate';
import { aiCloudEnabled } from '@/shared/infrastructure/ai-billing/aiCloudGate';
import { getAiCosting } from '@/shared/infrastructure/persistence/PlanCatalog';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { AssistantEngine } from '../../domain/AssistantEngine';
import type { ModelCandidates } from '../../domain/intentRouter';
import { AnthropicAssistantEngine } from './AnthropicAssistantEngine';
import { LocalAssistantEngine } from './LocalAssistantEngine';
import { MeteredAssistantEngine } from './MeteredAssistantEngine';
import { BlockedAssistantEngine } from './BlockedAssistantEngine';
import { OpenAiAssistantEngine } from './OpenAiAssistantEngine';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';

/** Nombre del profesional (perfil) para personalizar el tono (v3 §13). */
async function readProfessionalName(ownerUserId: string): Promise<string> {
  const row = await getDatabaseAdapter().queryRow<{ full_name?: string }>(
    'SELECT full_name FROM practitioner_profile WHERE user_id = ?',
    [ownerUserId],
  );
  return (row?.full_name ?? '').trim();
}

/**
 * Fábrica del motor del chat, gobernada por la puerta de presupuesto:
 * - acceso bloqueado (tope duro del plan alcanzado) → BlockedAssistantEngine,
 *   que responde el mensaje de límite como respuesta del asistente;
 * - con ANTHROPIC_API_KEY → motor remoto con el MODELO RESUELTO por plan;
 *   sin clave → motor local. Ambos van envueltos en MeteredAssistantEngine,
 *   que registra cada interacción en ai_usage_events.
 * Todos quedan detrás del MISMO clasificador de alcance y del MISMO retriever
 * acotado por owner_user_id (los arma createAssistantUseCases).
 *
 * Ambos motores reciben el nombre del profesional para el tono personalizado
 * (v3 §13: clínico, cálido, por su nombre de pila).
 */
export async function createAssistantEngine(
  ownerUserId: string,
  access: AiAccess,
): Promise<AssistantEngine> {
  if (!access.allowed) {
    return new BlockedAssistantEngine(access.blockedMessage ?? AI_BUDGET_BLOCKED_MESSAGE);
  }
  const professionalName = await readProfessionalName(ownerUserId);
  if (isDesktopEdition()) {
    const config = await aiCloudEnabled() ? await new SqlitePersonalProviderRepository().activeAi(ownerUserId) : null;
    const models = { premium: config?.model ?? access.model, economico: config?.model ?? access.model, riesgo: config?.model ?? access.model };
    const engine = !config ? new LocalAssistantEngine(professionalName) : config.provider === 'openai'
      ? new OpenAiAssistantEngine(config.api_key, config.model, professionalName)
      : new AnthropicAssistantEngine(config.api_key, models, professionalName);
    return new MeteredAssistantEngine(engine, ownerUserId, models);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Kill-switch global: si la IA en nube está apagada, se fuerza el motor LOCAL aunque haya API key.
  const useCloud = apiKey !== undefined && apiKey.trim().length > 0 && (await aiCloudEnabled());

  // Candidatos para el ruteo por intención, ACOTADOS por el techo del plan:
  // - si el plan da el premium (Profesional bajo umbral, admin), el chat puede
  //   degradar a económico lo trivial-logístico y reservar el premium para
  //   riesgo y razonamiento clínico;
  // - si el plan ya sirve el económico (Esencial, o sobre el umbral suave), no
  //   hay headroom para subir: premium y económico son el modelo que dio el
  //   plan… EXCEPTO el candidato de RIESGO, que siempre es el premium real —
  //   una pregunta de crisis nunca se responde con el modelo débil (mismo
  //   precedente que PREMIUM_ALWAYS_KINDS; consume el presupuesto del plan y el
  //   tope duro agotado sigue bloqueando todo vía BlockedAssistantEngine).
  const costing = await getAiCosting();
  const candidates: ModelCandidates =
    access.model === costing.modeloPremium
      ? { premium: costing.modeloPremium, economico: costing.modeloEconomico, riesgo: costing.modeloPremium }
      : { premium: access.model, economico: access.model, riesgo: costing.modeloPremium };

  const inner: AssistantEngine = useCloud
    ? new AnthropicAssistantEngine(apiKey.trim(), candidates, professionalName)
    : new LocalAssistantEngine(professionalName);
  return new MeteredAssistantEngine(inner, ownerUserId, candidates);
}
