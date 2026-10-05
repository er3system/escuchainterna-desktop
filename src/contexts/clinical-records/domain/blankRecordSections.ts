import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';

/**
 * Secciones del formulario cuando la historia se inicia "en blanco" (sin plantilla).
 * Compartidas por el formulario de llenado y la exportación.
 */
export const BLANK_RECORD_SECTIONS: ClinicalSection[] = [
  {
    id: 'historia-libre',
    title: 'Historia clínica',
    description: 'Historia clínica de formato libre.',
    fields: [
      { id: 'motivo-consulta', label: 'Motivo de consulta', type: 'texto_largo' },
      { id: 'contenido', label: 'Contenido', type: 'texto_largo', placeholder: 'Escribe aquí la historia clínica...' },
      { id: 'observaciones', label: 'Observaciones clínicas generales', type: 'texto_largo' },
    ],
  },
];
