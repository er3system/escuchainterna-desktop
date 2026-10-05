// Módulo puro (sin dependencias de Node) para que los client components
// (p. ej. el panel de filtros de /pacientes) usen las etiquetas de género
// sin arrastrar el agregado Patient ni @haskou/value-objects al bundle del navegador.

export type PatientGenderValue =
  | 'femenino'
  | 'masculino'
  | 'no_binario'
  | 'prefiere_no_decir'
  | 'otro';

export const PATIENT_GENDER_VALUES: PatientGenderValue[] = [
  'femenino',
  'masculino',
  'no_binario',
  'prefiere_no_decir',
  'otro',
];

export const PATIENT_GENDER_LABELS: Record<PatientGenderValue, string> = {
  femenino: 'Femenino',
  masculino: 'Masculino',
  no_binario: 'No binario',
  prefiere_no_decir: 'Prefiere no decir',
  otro: 'Otro',
};

export function allPatientGenders(): Array<{ value: PatientGenderValue; label: string }> {
  return PATIENT_GENDER_VALUES.map((value) => ({ value, label: PATIENT_GENDER_LABELS[value] }));
}
