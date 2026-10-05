import type { ClinicalRecord } from '../../domain/ClinicalRecord';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';

/** Qué se sella al abrir un expediente nuevo. */
export type SealScope =
  /** Nuevo episodio que COEXISTE: no sella nada (el anterior sigue abierto). */
  | 'none'
  /** Nuevo episodio cerrando la etapa: sella el expediente vigente (el más reciente abierto). */
  | 'current'
  /** Relevo ("recibí este paciente"): sella TODOS los expedientes abiertos. */
  | 'all';

/**
 * Prepara la apertura de un expediente nuevo según el motivo:
 *
 * - 'none'    → nuevo episodio que coexiste: NO sella; el flujo crea otra primaria
 *               (vía StartNewEpisode) que pasa a ser la vigente, y la anterior queda
 *               abierta y editable como "otro expediente abierto".
 * - 'current' → nuevo episodio cerrando la etapa: sella el expediente vigente.
 * - 'all'     → relevo: sella TODOS los expedientes abiertos (el tratante entrante
 *               arranca limpio); tras esto no hay primaria abierta y el flujo crea la
 *               primera.
 *
 * NO crea la nueva primaria (eso lo hace el selector de modelo). Idempotente respecto
 * del sellado. Devuelve los ids sellados.
 */
export class OpenNewExpediente {
  public constructor(private readonly records: ClinicalRecordRepository) {}

  public async execute(patientId: string, opts: { sealScope: SealScope; label?: string }): Promise<string[]> {
    if (opts.sealScope === 'none') return [];

    const label = opts.label?.trim();
    let toSeal: ClinicalRecord[];
    if (opts.sealScope === 'all') {
      const all = await this.records.listByPatient(patientId);
      toSeal = all.filter((record) => record.isPrimaryHistory() && !record.isSealed());
    } else {
      const current = await this.records.findPrimaryHistory(patientId);
      toSeal = current ? [current] : [];
    }

    const sealedIds: string[] = [];
    for (const record of toSeal) {
      if (label) record.rename(label);
      record.seal();
      await this.records.save(record);
      sealedIds.push(record.recordId());
    }
    return sealedIds;
  }
}
