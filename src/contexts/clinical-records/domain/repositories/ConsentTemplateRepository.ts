import type { ConsentTemplate } from '../ConsentTemplate';

/** Plantilla de consentimiento del profesional en sesión (1 por owner). */
export interface ConsentTemplateRepository {
  find(): Promise<ConsentTemplate | null>;
  save(template: ConsentTemplate): Promise<void>;
}
