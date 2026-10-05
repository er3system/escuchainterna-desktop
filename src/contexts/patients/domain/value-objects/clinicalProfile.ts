/**
 * Opciones y etiquetas del contexto clínico-médico del paciente (P5):
 * encuadre (frecuencia + modalidad) y estado del proceso. Son uniones de
 * texto (no enums) que viajan como string en el read model; este módulo es
 * la fuente única de sus claves y etiquetas, compartida por el formulario y
 * la ficha de lectura.
 */

export const SESSION_FREQUENCIES = [
  { key: 'semanal', label: 'Semanal' },
  { key: 'quincenal', label: 'Quincenal' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'otra', label: 'Otra' },
] as const;

export type SessionFrequency = (typeof SESSION_FREQUENCIES)[number]['key'];

export const SESSION_MODALITIES = [
  { key: 'presencial', label: 'Presencial' },
  { key: 'online', label: 'En línea' },
  { key: 'mixto', label: 'Mixta' },
] as const;

export type SessionModality = (typeof SESSION_MODALITIES)[number]['key'];

export const PROCESS_STATUSES = [
  { key: 'activo', label: 'Activo' },
  { key: 'pausa', label: 'En pausa' },
  { key: 'alta', label: 'Alta' },
  { key: 'abandono', label: 'Abandono' },
] as const;

export type ProcessStatus = (typeof PROCESS_STATUSES)[number]['key'];

/** Estado por defecto de un expediente (coincide con el DEFAULT de la migración v20). */
export const DEFAULT_PROCESS_STATUS: ProcessStatus = 'activo';

function labelFrom(options: readonly { key: string; label: string }[], value: string): string {
  return options.find((option) => option.key === value)?.label ?? '';
}

export function sessionFrequencyLabel(value: string): string {
  return labelFrom(SESSION_FREQUENCIES, value);
}

export function sessionModalityLabel(value: string): string {
  return labelFrom(SESSION_MODALITIES, value);
}

export function processStatusLabel(value: string): string {
  return labelFrom(PROCESS_STATUSES, value);
}

/** "Semanal · Presencial" a partir de frecuencia y modalidad (omite las vacías). */
export function encuadreLabel(frequency: string, modality: string): string {
  return [sessionFrequencyLabel(frequency), sessionModalityLabel(modality)]
    .filter((part) => part !== '')
    .join(' · ');
}

function isKeyOf(options: readonly { key: string }[], value: string): boolean {
  return options.some((option) => option.key === value);
}

/** Normaliza una frecuencia desconocida a '' (sin especificar). */
export function toSessionFrequency(raw: string): SessionFrequency | '' {
  const value = raw.trim();
  return isKeyOf(SESSION_FREQUENCIES, value) ? (value as SessionFrequency) : '';
}

/** Normaliza una modalidad desconocida a '' (sin especificar). */
export function toSessionModality(raw: string): SessionModality | '' {
  const value = raw.trim();
  return isKeyOf(SESSION_MODALITIES, value) ? (value as SessionModality) : '';
}

/** Normaliza un estado desconocido al valor por defecto ('activo'). */
export function toProcessStatus(raw: string): ProcessStatus {
  const value = raw.trim();
  return isKeyOf(PROCESS_STATUSES, value) ? (value as ProcessStatus) : DEFAULT_PROCESS_STATUS;
}
