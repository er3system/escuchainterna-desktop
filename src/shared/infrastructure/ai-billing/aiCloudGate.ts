import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

/**
 * Kill-switch GLOBAL de la IA en NUBE. Cuando un admin lo apaga, NINGUNA superficie de IA envía
 * datos clínicos al proveedor (Anthropic): las fábricas de motores caen al modo LOCAL (sin red),
 * que ya existe como fallback determinista. Es la salvaguarda dura que exige el cumplimiento de
 * Ley 1581 (poder CORTAR la transferencia a un tercero de inmediato ante un incidente, falta de
 * DPA, o decisión legal) sin tumbar el producto.
 *
 * Por defecto HABILITADO (la ausencia del ajuste = nube on) para preservar el comportamiento
 * actual; el interruptor solo sirve para APAGAR. Vive en platform_settings (ajuste de plataforma,
 * no por cuenta) bajo la clave `ai_cloud_enabled`.
 */
const AI_CLOUD_ENABLED_KEY = 'ai_cloud_enabled';

/** ¿La IA en nube está habilitada globalmente? Ausente o ilegible ⇒ true (nube on por defecto). */
export async function aiCloudEnabled(): Promise<boolean> {
  const row = await getDatabaseAdapter().queryRow<{ value_json: string }>(
    'SELECT value_json FROM platform_settings WHERE key = ?',
    [AI_CLOUD_ENABLED_KEY],
  );
  if (!row) return true;
  try {
    const parsed = JSON.parse(row.value_json) as { enabled?: boolean };
    return parsed.enabled !== false;
  } catch {
    return true;
  }
}

/** Enciende/apaga el kill-switch global (consola del admin). */
export async function setAiCloudEnabled(enabled: boolean): Promise<void> {
  await getDatabaseAdapter().execute(
    `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    [AI_CLOUD_ENABLED_KEY, JSON.stringify({ enabled, updatedAt: new Date().toISOString() })],
  );
}
