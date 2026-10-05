// Modelo PURO del portafolio pseudonimizado del que se va (§3.4). Es su trabajo
// clínico (legítimamente suyo) SIN identificar a los pacientes: código en vez de
// nombre, sin documento ni contacto, con datos estructurados (enfoque, nº de sesiones,
// diagnósticos CIE-11, fechas). NO incluye texto libre clínico (que podría contener
// identificadores y pertenece a la institución).

export interface PortfolioCase {
  /** Código pseudónimo estable dentro del documento (A, B, C…). */
  code: string;
  /** Enfoque/modelo de la historia primaria (título), sin datos del paciente. */
  approach: string;
  sessionCount: number;
  /** Diagnósticos CIE-11 (código + título estándar, no PII). */
  diagnoses: string[];
  /** Rango de fechas del proceso (solo fechas, sin identificadores). */
  firstDate: string | null;
  lastDate: string | null;
}

export interface PortfolioInput {
  generatedAt: string;
  professionalName: string;
  organizationName: string;
  cases: PortfolioCase[];
}

function shortDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}

/** Letra de código por índice: A…Z, luego A1, B1… (estable y anónimo). */
export function portfolioCode(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  const round = Math.floor(index / 26);
  return round === 0 ? letter : `${letter}${round}`;
}

/**
 * Markdown DETERMINISTA del portafolio pseudonimizado. Sin nombres, documento ni
 * contacto de pacientes; sin texto libre clínico. Solo estructura y fechas.
 */
export function buildPortfolioMarkdown(input: PortfolioInput): string {
  const lines: string[] = [];
  lines.push('# Portafolio de casos (pseudonimizado)');
  lines.push('');
  lines.push(`**Profesional:** ${input.professionalName || '[completar]'}`);
  if (input.organizationName) lines.push(`**Organización:** ${input.organizationName}`);
  lines.push(`**Generado:** ${shortDate(input.generatedAt)}`);
  lines.push('');
  lines.push(
    'Documento anonimizado del trabajo clínico propio: los pacientes se identifican con un código, sin nombre, documento ni datos de contacto, y sin contenido clínico en texto libre.',
  );
  lines.push('');
  lines.push(`## Casos atendidos: ${input.cases.length}`);

  if (input.cases.length === 0) {
    lines.push('');
    lines.push('Sin casos registrados.');
    return lines.join('\n');
  }

  for (const c of input.cases) {
    lines.push('');
    lines.push(`### Paciente ${c.code}`);
    lines.push(`- **Enfoque:** ${c.approach || 'Sin historia primaria'}`);
    lines.push(`- **Sesiones:** ${c.sessionCount}`);
    lines.push(
      `- **Diagnósticos (CIE-11):** ${c.diagnoses.length > 0 ? c.diagnoses.join('; ') : 'sin diagnóstico registrado'}`,
    );
    lines.push(`- **Periodo:** ${shortDate(c.firstDate)} → ${shortDate(c.lastDate)}`);
  }

  return lines.join('\n');
}
