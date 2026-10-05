'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  requireClinicalConfigAccess,
  requirePaymentConfigurationAccess,
  sessionCanConfigurePayments,
} from '@/shared/infrastructure/auth/dataOwner';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { CreateAgendaMessage } from '@/contexts/scheduling/application/create-agenda/CreateAgendaMessage';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { findPhoneCountry } from '@/shared/domain/phoneCountryCodes';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { markIntegrationSimulated } from './localIntegrations';
import type { OnboardingIntegrationProvider } from './localIntegrations';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export interface OnboardingData {
  fullName: string;
  phone: string;
  /** Indicativo del país del celular (v2 §6.1, p. ej. «+52»). */
  phoneCountryCode: string;
  /** Cédula / tarjeta profesional (v2 §6.8, encabezado de exportables). */
  professionalLicense: string;
  description: string;
  modality: string;
  address: string;
  mapsUrl: string;
  availability: Array<{ day: number; ranges: Array<{ from: string; to: string }> }>;
  defaultPrice: number;
  /** Moneda de las tarifas (v2 §6.2, código de SUPPORTED_CURRENCIES). */
  currency: string;
  paymentMode: string;
  showPrice: boolean;
  paymentPolicies: string;
  /** Tarifas por inasistencia / cancelación tardía (v2 §6.3). */
  noShowFeeEnabled: boolean;
  noShowFeeAmount: number;
  lateCancelFeeEnabled: boolean;
  lateCancelFeeAmount: number;
}

export interface OnboardingActionState {
  ok: boolean;
  error?: string;
}

const profiles = new SqlitePractitionerProfileRepository();

/**
 * Guarda lo capturado del wizard y marca el onboarding como completado
 * (tanto al finalizar como al saltar). Crea la primera agenda «Sesión
 * estándar» si todavía no existe ninguna.
 */
export async function finishOnboardingAction(data: OnboardingData): Promise<OnboardingActionState> {
  const userId = await requireClinicalConfigAccess();
  const canConfigurePayments = await sessionCanConfigurePayments();

  try {
    await getDatabaseAdapter().transaction(async () => {
      let profile = await profiles.findByUserId(userId);
      if (!profile) {
        await profiles.createEmptyProfileFor(userId);
        profile = await profiles.findByUserId(userId);
      }
      if (!profile) {
        throw new Error('No encontramos tu perfil. Vuelve a iniciar sesión.');
      }

      const modality =
        data.modality === 'presencial' || data.modality === 'virtual' || data.modality === 'ambas'
          ? data.modality
          : profile.modality;
      const paymentMode =
        canConfigurePayments && (data.paymentMode === 'manual' || data.paymentMode === 'requerido')
          ? data.paymentMode
          : profile.paymentMode;
      const currency =
        canConfigurePayments && SUPPORTED_CURRENCIES.some((item) => item.code === data.currency)
          ? data.currency
          : profile.currency;
      const phoneCountryCode = findPhoneCountry((data.phoneCountryCode ?? '').trim())
        ? data.phoneCountryCode.trim()
        : profile.phoneCountryCode;
      const feeAmount = (value: number, fallback: number) =>
        Number.isFinite(value) && value >= 0 ? value : fallback;

      await profiles.update({
        ...profile,
        fullName: data.fullName.trim() || profile.fullName,
        phone: data.phone.trim(),
        phoneCountryCode,
        professionalLicense: data.professionalLicense.trim(),
        description: data.description.trim(),
        modality,
        address: data.address.trim(),
        mapsUrl: data.mapsUrl.trim(),
        availability: data.availability,
        defaultPrice:
          canConfigurePayments && Number.isFinite(data.defaultPrice) && data.defaultPrice >= 0
            ? data.defaultPrice
            : profile.defaultPrice,
        currency,
        paymentMode,
        showPrice: canConfigurePayments ? data.showPrice : profile.showPrice,
        paymentPolicies: canConfigurePayments ? data.paymentPolicies : profile.paymentPolicies,
        noShowFeeEnabled: canConfigurePayments ? data.noShowFeeEnabled : profile.noShowFeeEnabled,
        noShowFeeAmount: canConfigurePayments
          ? feeAmount(data.noShowFeeAmount, profile.noShowFeeAmount)
          : profile.noShowFeeAmount,
        lateCancelFeeEnabled: canConfigurePayments ? data.lateCancelFeeEnabled : profile.lateCancelFeeEnabled,
        lateCancelFeeAmount: canConfigurePayments
          ? feeAmount(data.lateCancelFeeAmount, profile.lateCancelFeeAmount)
          : profile.lateCancelFeeAmount,
        onboardingCompleted: true,
      });

      const useCases = createSchedulingUseCases(userId);
      const hasAgendas = (await useCases.listAgendas.list()).length > 0;
      if (!hasAgendas) {
        await useCases.createAgenda.create(
          new CreateAgendaMessage({
            name: 'Sesión estándar',
            color: '#5B5BD6',
            durationMinutes: 60,
          }),
        );
      }
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar tu información.' };
  }

  revalidatePath('/inicio');
  revalidatePath('/agenda');
  redirect('/inicio');
}

export async function connectIntegrationAction(
  provider: OnboardingIntegrationProvider,
): Promise<OnboardingActionState> {
  if (isDesktopEdition()) return { ok: false, error: 'La edición de PC no conecta proveedores mediante una simulación.' };
  try {
    if (provider !== 'stripe' && provider !== 'google_calendar') {
      return { ok: false, error: 'Integración no soportada.' };
    }
    const userId =
      provider === 'stripe'
        ? await requirePaymentConfigurationAccess()
        : await requireClinicalConfigAccess();
    await markIntegrationSimulated(provider, userId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'No se pudo conectar la integración.' };
  }
  revalidatePath('/configuracion/integraciones');
  return { ok: true };
}
