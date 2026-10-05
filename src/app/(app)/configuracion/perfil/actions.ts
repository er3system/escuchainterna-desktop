'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getFileStorage } from '@/shared/infrastructure/files/getFileStorage';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { forbidAssistantRole, sessionCanConfigurePayments } from '@/shared/infrastructure/auth/dataOwner';
import { findPhoneCountry } from '@/shared/domain/phoneCountryCodes';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';

export interface PerfilFormState {
  ok?: string;
  error?: string;
}

const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MODALITIES = ['presencial', 'virtual', 'ambas'] as const;
const PAYMENT_MODES = ['manual', 'requerido'] as const;

/** Devuelve la lada solo si pertenece al catálogo de países soportados. */
function parseDialCode(raw: FormDataEntryValue | null, fallback: string): string {
  const value = String(raw ?? '').trim();
  return findPhoneCountry(value) ? value : fallback;
}

/** Monto de tarifa: número ≥ 0; si el campo no llegó o es inválido conserva el anterior. */
function parseFeeAmount(raw: FormDataEntryValue | null, fallback: number): number {
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

type WeeklyAvailability = Array<{ day: number; ranges: Array<{ from: string; to: string }> }>;

function parseAvailability(raw: string): WeeklyAvailability {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  const result: WeeklyAvailability = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const { day, ranges } = item as { day?: unknown; ranges?: unknown };
    if (typeof day !== 'number' || day < 0 || day > 6 || !Array.isArray(ranges)) continue;
    const validRanges = ranges
      .filter(
        (range): range is { from: string; to: string } =>
          typeof range === 'object' &&
          range !== null &&
          timePattern.test(String((range as { from?: unknown }).from)) &&
          timePattern.test(String((range as { to?: unknown }).to)),
      )
      .map((range) => ({ from: range.from, to: range.to }));
    if (validRanges.length > 0) result.push({ day, ranges: validRanges });
  }
  return result;
}

export async function updateProfileAction(
  _prev: PerfilFormState,
  formData: FormData,
): Promise<PerfilFormState> {
  const repository = new SqlitePractitionerProfileRepository();
  const userId = await forbidAssistantRole();
  const profile = await repository.findByUserId(userId);
  if (!profile) return { error: 'No se encontró el perfil del profesional.' };
  // Este formulario mezcla datos profesionales con tarifas. Un miembro cuya
  // organización fija los pagos puede actualizar su perfil, pero los campos
  // financieros se preservan con los valores leídos del servidor.
  const canConfigurePayments = await sessionCanConfigurePayments();

  try {
    let photoPath = profile.photoPath;
    const photo = formData.get('foto');
    if (photo instanceof File && photo.size > 0) {
      const extension = PHOTO_EXTENSIONS[photo.type];
      if (!extension) return { error: 'La foto debe ser una imagen JPG, PNG o WebP.' };
      if (photo.size > 5 * 1024 * 1024) return { error: 'La foto no puede pesar más de 5 MB.' };
      const key = `perfil/foto-${randomUUID().slice(0, 8)}${extension}`;
      await getFileStorage().save(key, new Uint8Array(await photo.arrayBuffer()));
      photoPath = key;
    }

    const rawModality = String(formData.get('modalidad') ?? profile.modality);
    const modality = (MODALITIES as readonly string[]).includes(rawModality) ? rawModality : profile.modality;
    const rawPaymentMode = String(formData.get('modo_pago') ?? profile.paymentMode);
    const paymentMode =
      canConfigurePayments && (PAYMENT_MODES as readonly string[]).includes(rawPaymentMode)
        ? rawPaymentMode
        : profile.paymentMode;
    const defaultPrice = Number(formData.get('precio') ?? profile.defaultPrice);
    const rawCurrency = String(formData.get('moneda') ?? profile.currency).trim();
    const currency =
      canConfigurePayments && SUPPORTED_CURRENCIES.some((item) => item.code === rawCurrency)
        ? rawCurrency
        : profile.currency;

    // Teléfono de contacto: se guarda en formato internacional «+52 2221234567».
    const contactDialCode = parseDialCode(formData.get('lada_contacto'), '+52');
    const contactNumber = String(formData.get('telefono_contacto') ?? '').trim();

    await repository.update({
      ...profile,
      fullName: String(formData.get('nombre') ?? '').trim(),
      phone: String(formData.get('telefono') ?? '').trim(),
      phoneCountryCode: parseDialCode(formData.get('lada'), profile.phoneCountryCode),
      description: String(formData.get('descripcion') ?? '').trim(),
      photoPath,
      modality,
      address: String(formData.get('direccion') ?? '').trim(),
      mapsUrl: String(formData.get('maps_url') ?? '').trim(),
      currency,
      defaultPrice:
        canConfigurePayments && Number.isFinite(defaultPrice) && defaultPrice >= 0
          ? defaultPrice
          : profile.defaultPrice,
      paymentMode,
      showPrice: canConfigurePayments ? formData.get('mostrar_precio') === '1' : profile.showPrice,
      paymentPolicies: canConfigurePayments
        ? String(formData.get('politicas') ?? '').slice(0, 390)
        : profile.paymentPolicies,
      availability: parseAvailability(String(formData.get('disponibilidad') ?? '[]')),
      professionalLicense: String(formData.get('cedula') ?? '').trim(),
      contactAddress: String(formData.get('direccion_contacto') ?? '').trim().slice(0, 390),
      contactPhone: contactNumber ? `${contactDialCode} ${contactNumber}` : '',
      noShowFeeEnabled: canConfigurePayments
        ? formData.get('tarifa_inasistencia_activa') === '1'
        : profile.noShowFeeEnabled,
      noShowFeeAmount: canConfigurePayments
        ? parseFeeAmount(formData.get('tarifa_inasistencia_monto'), profile.noShowFeeAmount)
        : profile.noShowFeeAmount,
      lateCancelFeeEnabled: canConfigurePayments
        ? formData.get('tarifa_cancelacion_activa') === '1'
        : profile.lateCancelFeeEnabled,
      lateCancelFeeAmount: canConfigurePayments
        ? parseFeeAmount(formData.get('tarifa_cancelacion_monto'), profile.lateCancelFeeAmount)
        : profile.lateCancelFeeAmount,
    });

    revalidatePath('/configuracion/perfil');
    return { ok: '¡Se ha guardado exitosamente!' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar el perfil.' };
  }
}
