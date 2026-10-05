import { estimateTokens, recordUsage } from '@/shared/infrastructure/ai-billing/AiUsageRecorder';
import type { AiUsageKind } from '@/shared/infrastructure/ai-billing/AiBudgetGate';
import type {
  PatientReportData,
  RecordSnapshot,
  RecordUpdateProposal,
  SessionInsights,
  SessionReport,
  SupervisionCaseData,
} from '../../domain/SessionInsights';

/**
 * Decorador de medición: delega en el adaptador real (Anthropic o local) y
 * registra DESPUÉS cada interacción en `ai_usage_events` con tokens estimados
 * (~4 caracteres por token sobre prompt y respuesta) y el modelo RESUELTO por
 * la puerta de presupuesto — en modo local, el que se habría usado. No toca la
 * lógica clínica: solo observa entradas y salidas.
 */
export class MeteredSessionInsights implements SessionInsights {
  public constructor(
    private readonly inner: SessionInsights,
    private readonly ownerUserId: string,
    private readonly model: string,
  ) {}

  public providerName(): 'anthropic' | 'local' {
    return this.inner.providerName();
  }

  public async answerQuestion(notes: string, question: string): Promise<string> {
    const response = await this.inner.answerQuestion(notes, question);
    await this.record('pregunta_nota', `${notes}\n${question}`, response);
    return response;
  }

  public async generateSessionReport(notes: string): Promise<SessionReport> {
    const report = await this.inner.generateSessionReport(notes);
    await this.record('reporte_sesion', notes, JSON.stringify(report));
    return report;
  }

  public async suggestRecordUpdates(notes: string, record: RecordSnapshot): Promise<RecordUpdateProposal[]> {
    const proposals = await this.inner.suggestRecordUpdates(notes, record);
    await this.record('sugerencias_historia', `${notes}\n${JSON.stringify(record)}`, JSON.stringify(proposals));
    return proposals;
  }

  public async draftPatientReport(
    kind: string,
    patientData: PatientReportData,
    countryGuidelines: string,
  ): Promise<string> {
    const content = await this.inner.draftPatientReport(kind, patientData, countryGuidelines);
    await this.record('borrador_reporte', `${JSON.stringify(patientData)}\n${countryGuidelines}`, content);
    return content;
  }

  public async polishNote(notes: string): Promise<string> {
    const draft = await this.inner.polishNote(notes);
    await this.record('pulir_nota', notes, draft);
    return draft;
  }

  public async summarizeCaseForSupervision(caseData: SupervisionCaseData): Promise<string> {
    const summary = await this.inner.summarizeCaseForSupervision(caseData);
    // El gasto queda a nombre del ownerUserId del decorador: el SUPERVISOR.
    await this.record('resumen_supervision', JSON.stringify(caseData), summary);
    return summary;
  }

  private async record(kind: AiUsageKind, promptText: string, responseText: string): Promise<void> {
    // Uso real de la API (ajustado por caché) si el adaptador lo expone; si no
    // —modo local, sin red—, se estima por longitud. La fábrica crea una
    // instancia por petición y cada método fija lastUsage antes de medir, así
    // que refleja la operación recién resuelta.
    const actual = this.inner.lastUsage?.();
    await recordUsage({
      ownerUserId: this.ownerUserId,
      kind,
      model: this.model,
      inputTokens: actual ? actual.inputTokens : estimateTokens(promptText),
      outputTokens: actual ? actual.outputTokens : estimateTokens(responseText),
    });
  }
}
