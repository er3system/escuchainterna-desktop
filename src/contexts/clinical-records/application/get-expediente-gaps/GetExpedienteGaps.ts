import { expedienteGaps } from '../../domain/expedienteContent';
import {
  assembleExpedienteInput,
  type ExpedienteSources,
} from '../create-expediente-report/assembleExpedienteInput';

/**
 * Calcula los "huecos" del expediente (lo que no consta: diagnóstico, fechas,
 * cédula, sesiones…) para mostrarlos como checklist "Antes de firmar" en la UI
 * de Exportar — ya NO dentro del documento firmable. Determinista, sin IA.
 */
export class GetExpedienteGaps {
  public constructor(private readonly sources: ExpedienteSources) {}

  public async execute(patientId: string): Promise<string[]> {
    const input = await assembleExpedienteInput(this.sources, patientId, new Date().toISOString());
    if (!input) return [];
    return expedienteGaps(input);
  }
}
