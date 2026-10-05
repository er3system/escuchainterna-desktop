// Módulo PURO (sin dependencias de Node): lineamientos normativos breves por
// país que orientan la redacción de reportes clínico-legales. Son referencia
// conceptual basada en los marcos normativos públicos de cada país (las
// publicaciones completas viven en la Biblioteca EscuchaInterna, categoría
// "Marcos normativos"); NO sustituyen asesoría legal.

export interface CountryGuideline {
  code: string;
  name: string;
  guidelines: string;
}

export const COUNTRY_GUIDELINES: CountryGuideline[] = [
  {
    code: 'MX',
    name: 'México',
    guidelines:
      'México — NOM-004-SSA3-2012 (expediente clínico): el informe debe identificar al profesional con nombre completo y cédula profesional, fecha de elaboración y firma autógrafa; el expediente pertenece al establecimiento/profesional pero el paciente tiene derecho a un resumen clínico. LFPDPPP: los datos de salud son sensibles; revela solo lo estrictamente necesario para la finalidad del documento y deja constancia del consentimiento o del fundamento legal (p. ej. requerimiento judicial). Ante una autoridad, responde únicamente lo solicitado citando el número de oficio/expediente y ampárate en el secreto profesional (art. 36 Ley General de Salud y Código de Ética del Psicólogo) para lo no requerido.',
  },
  {
    code: 'CO',
    name: 'Colombia',
    guidelines:
      'Colombia — Ley 1090 de 2006 (ejercicio de la psicología): el informe debe ceñirse al deber de secreto profesional (art. 2.5) y solo puede revelarse información con consentimiento informado o por mandato legal; identifícate con nombre y tarjeta profesional. Ley 1581 de 2012 (habeas data): los datos de salud son sensibles, aplica el principio de finalidad y minimización. La historia clínica es reservada (Ley 23 de 1981 y Resolución 1995 de 1999): a terceros solo se entregan resúmenes o respuestas puntuales, preferiblemente por requerimiento de autoridad competente citando el radicado.',
  },
  {
    code: 'ES',
    name: 'España',
    guidelines:
      'España — Ley 41/2002 de autonomía del paciente: el paciente tiene derecho a la información y al acceso a su historia; los informes deben ser veraces, comprensibles y firmados con nombre y número de colegiado/a. RGPD y LOPDGDD 3/2018: los datos de salud son de categoría especial; aplica minimización y consigna la base jurídica de la comunicación (consentimiento, requerimiento judicial, interés vital). Código Deontológico del COP: distingue hechos observados de inferencias clínicas, evita etiquetas estigmatizantes y limita el informe a la finalidad solicitada.',
  },
  {
    code: 'AR',
    name: 'Argentina',
    guidelines:
      'Argentina — Ley 26.529 (derechos del paciente e historia clínica): la historia clínica es del paciente, que puede solicitar copia; los informes llevan fecha, firma y matrícula del profesional. Ley 26.657 (salud mental): redacta desde un enfoque de derechos, evita diagnósticos como única descripción de la persona y fundamenta cualquier mención de riesgo. Ley 25.326 (protección de datos): los datos de salud son sensibles; ante pedidos judiciales responde solo lo requerido citando la causa y deja constancia del oficio.',
  },
  {
    code: 'CL',
    name: 'Chile',
    guidelines:
      'Chile — Ley 20.584 (derechos y deberes del paciente): la ficha clínica es reservada; terceros solo acceden con autorización del paciente, orden judicial o solicitud fiscal, y el informe debe llevar identificación y firma del profesional. Ley 19.628 (vida privada): los datos de salud son sensibles, comunica el mínimo necesario. Código de Ética del Colegio de Psicólogos: explicita el objetivo de la evaluación, los instrumentos o fuentes usadas y los límites de las conclusiones.',
  },
  {
    code: 'OTRO',
    name: 'Otro país (principios generales)',
    guidelines:
      'Principios generales (APA/OMS): identifica al profesional con nombre, credencial habilitante y datos de contacto; fecha y firma el documento. Limita el contenido a la finalidad solicitada (minimización), distingue hechos observados de hipótesis clínicas, documenta el consentimiento informado o el fundamento legal de la divulgación y protege la información de terceros mencionados. Conserva copia en el expediente.',
  },
];

export function guidelineForCountry(code: string): CountryGuideline {
  return (
    COUNTRY_GUIDELINES.find((country) => country.code === code) ??
    COUNTRY_GUIDELINES[COUNTRY_GUIDELINES.length - 1]
  );
}
