/**
 * Configuración de plataforma (tabla platform_settings, clave → JSON).
 * La administra exclusivamente el rol admin: proveedores de plataforma,
 * plantillas de permisos, etc.
 */
export interface PlatformSettingsRepository {
  /** Devuelve el JSON crudo guardado bajo la clave, o null si no existe. */
  get(key: string): Promise<string | null>;
  set(key: string, valueJson: string): Promise<void>;
}
