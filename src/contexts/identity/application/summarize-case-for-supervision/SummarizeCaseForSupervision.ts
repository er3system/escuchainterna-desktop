import type { SupervisionCaseSummarizer } from '../../domain/SupervisionCaseSummarizer';
import type { SupervisionAccessReader } from '../../domain/repositories/SupervisionAccessReader';
import { SupervisionLinkRequiredError } from '../../domain/errors/SupervisionLinkRequiredError';
import { SummarizeCaseForSupervisionMessage } from './SummarizeCaseForSupervisionMessage';

/**
 * Resumen del caso (IA) para el SUPERVISOR (v3.2): qué se ha trabajado,
 * técnicas/intervenciones registradas, evolución temporal y estado de la
 * historia clínica y diagnósticos del paciente de un supervisado.
 *
 * Seguridad: el contexto del caso lo arma un read model que SOLO accede vía
 * vínculo de supervisión vigente (estructural, en la query); sin vínculo,
 * SupervisionLinkRequiredError. El resultado es material de trabajo del
 * supervisor: NO se persiste en el expediente del estudiante.
 */
export class SummarizeCaseForSupervision {
  public constructor(
    private readonly access: SupervisionAccessReader,
    private readonly summarizer: SupervisionCaseSummarizer,
  ) {}

  public async summarize(message: SummarizeCaseForSupervisionMessage): Promise<string> {
    const caseData = await this.access.loadCase(
      message.supervisorUserId(),
      message.supervisedUserId(),
      message.patientId(),
    );
    if (!caseData) throw new SupervisionLinkRequiredError();
    return this.summarizer.summarizeCaseForSupervision(caseData);
  }
}
