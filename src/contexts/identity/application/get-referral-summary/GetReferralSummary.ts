import type { PlatformSettingsRepository } from '../../domain/repositories/PlatformSettingsRepository';
import type { ReferralRepository } from '../../domain/repositories/ReferralRepository';
import {
  parseReferralProgramConfig,
  referralDiscountPercent,
  REFERRAL_PROGRAM_SETTINGS_KEY,
  type ReferralProgramConfig,
} from '../../domain/value-objects/referralProgram';

/** Read model del programa de referidos para Mi suscripción (v3 §11). */
export interface ReferralSummary {
  /** Código del usuario (se crea perezosamente al consultarlo por primera vez). */
  code: string;
  registeredCount: number;
  activeCount: number;
  /** Descuento vigente: activos × descuentoPorcentaje, topado en maxPorcentaje. */
  discountPercent: number;
  config: ReferralProgramConfig;
}

export class GetReferralSummary {
  public constructor(
    private readonly referrals: ReferralRepository,
    private readonly settings: PlatformSettingsRepository,
  ) {}

  public async get(userId: string): Promise<ReferralSummary> {
    const config = parseReferralProgramConfig(await this.settings.get(REFERRAL_PROGRAM_SETTINGS_KEY));
    const activeCount = await this.referrals.countActiveFor(userId);
    return {
      code: await this.referrals.getOrCreateCode(userId),
      registeredCount: await this.referrals.countRegisteredFor(userId),
      activeCount,
      discountPercent: referralDiscountPercent(activeCount, config),
      config,
    };
  }
}
