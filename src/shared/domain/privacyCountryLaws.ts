/**
 * Marco normativo de protección de datos y registro clínico por país (v3 §8).
 * Módulo puro (sin dependencias de Node): lo comparten la sección de
 * privacidad de la landing y /legal/privacidad. Colombia va primero.
 */

export interface CountryLaw {
  /** Nombre oficial corto de la norma. */
  name: string;
  /** Qué cubre respecto a la plataforma, en una frase. */
  scope: string;
}

export interface PrivacyCountry {
  country: string;
  flag: string;
  laws: CountryLaw[];
}

export const PRIVACY_COUNTRY_LAWS: PrivacyCountry[] = [
  {
    country: 'Colombia',
    flag: '🇨🇴',
    laws: [
      {
        name: 'Ley 1581 de 2012 — Habeas Data',
        scope:
          'Régimen general de protección de datos personales: autorización del titular, datos sensibles de salud y derechos de conocer, actualizar, rectificar y suprimir.',
      },
      {
        name: 'Resolución 1995 de 1999 — historia clínica',
        scope:
          'Manejo de la historia clínica: reserva, custodia, integridad y conservación del expediente del paciente.',
      },
      {
        name: 'Ley 1090 de 2006 — secreto profesional',
        scope:
          'Código deontológico del psicólogo: confidencialidad de la información conocida en el ejercicio profesional.',
      },
    ],
  },
  {
    country: 'México',
    flag: '🇲🇽',
    laws: [
      {
        name: 'LFPDPPP',
        scope:
          'Ley Federal de Protección de Datos Personales en Posesión de los Particulares: derechos ARCO y tratamiento de datos sensibles de salud.',
      },
      {
        name: 'NOM-004-SSA3-2012',
        scope: 'Norma oficial del expediente clínico: contenido, confidencialidad y conservación.',
      },
    ],
  },
  {
    country: 'Perú',
    flag: '🇵🇪',
    laws: [
      {
        name: 'Ley 29733',
        scope:
          'Ley de Protección de Datos Personales: consentimiento, datos sensibles y derechos del titular ante el responsable.',
      },
    ],
  },
  {
    country: 'Chile',
    flag: '🇨🇱',
    laws: [
      {
        name: 'Ley 19.628 (act. Ley 21.719)',
        scope:
          'Protección de la vida privada y de los datos personales, actualizada con la nueva Agencia de Protección de Datos y régimen de datos de salud.',
      },
    ],
  },
  {
    country: 'Argentina',
    flag: '🇦🇷',
    laws: [
      {
        name: 'Ley 25.326',
        scope:
          'Ley de Protección de los Datos Personales: habeas data, datos sensibles y registro ante la autoridad de control.',
      },
    ],
  },
  // España/RGPD se retiró a propósito (2026-07-05): esta lista es una AFIRMACIÓN
  // nuestra ("normas que tomamos como referencia") y hoy la plataforma no declara
  // cumplimiento del régimen europeo — el servicio está orientado a Latinoamérica.
  // Las guías de redacción de reportes POR PAÍS del profesional (countryGuidelines)
  // sí conservan España: describen las obligaciones DEL profesional, no las nuestras.
];
