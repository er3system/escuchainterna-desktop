import type { SupervisionCaseData } from '@/contexts/clinical-records/domain/SessionInsights';

/**
 * Puerto del resumen de caso para supervisión académica. Lo satisface
 * estructuralmente el puerto SessionInsights del contexto clinical-records
 * (método homónimo en sus adaptadores Anthropic y local); aquí solo se
 * declara la porción que identity necesita, sin acoplar valores.
 */
export interface SupervisionCaseSummarizer {
  summarizeCaseForSupervision(caseData: SupervisionCaseData): Promise<string>;
}
