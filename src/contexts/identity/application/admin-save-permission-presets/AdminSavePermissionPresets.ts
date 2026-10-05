import {
  MembershipPermissions,
  type MembershipPermissionsPrimitives,
} from '../../domain/value-objects/MembershipPermissions';
import type { PlatformSettingsRepository } from '../../domain/repositories/PlatformSettingsRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';

export const PERMISSION_PRESETS_KEY = 'permission_presets';

/** Plantilla de permisos reutilizable al crear miembros de organización. */
export interface PermissionPreset {
  name: string;
  permissions: MembershipPermissionsPrimitives;
}

/** Lee y normaliza las plantillas guardadas en platform_settings. */
export function parsePermissionPresets(json: string | null): PermissionPreset[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is { name: string; permissions: MembershipPermissionsPrimitives } =>
          Boolean(item) && typeof (item as { name?: unknown }).name === 'string',
      )
      .map((item) => ({
        name: item.name,
        permissions: MembershipPermissions.fromPrimitives(item.permissions).toPrimitives(),
      }));
  } catch {
    return [];
  }
}

/**
 * Guarda el catálogo completo de plantillas de permisos (clave
 * `permission_presets` de platform_settings), validando cada plantilla con el
 * VO MembershipPermissions. Registra auditoría.
 */
export class AdminSavePermissionPresets {
  public constructor(
    private readonly settings: PlatformSettingsRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async save(actorUserId: string, presets: PermissionPreset[]): Promise<PermissionPreset[]> {
    const validated = presets
      .map((preset) => ({
        name: preset.name.trim(),
        permissions: MembershipPermissions.fromPrimitives(preset.permissions).toPrimitives(),
      }))
      .filter((preset) => preset.name.length > 0);

    await this.settings.set(PERMISSION_PRESETS_KEY, JSON.stringify(validated));
    await this.audit.record({
      actorUserId,
      action: 'guardar_preajustes_permisos',
      target: PERMISSION_PRESETS_KEY,
      details: { count: validated.length, names: validated.map((preset) => preset.name) },
    });
    return validated;
  }
}
