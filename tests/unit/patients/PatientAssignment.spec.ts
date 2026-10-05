import { describe, it, expect } from 'vitest';
import {
  PatientAssignment,
  isAssignmentReason,
} from '@/contexts/patients/domain/PatientAssignment';
import type { PatientAssignmentRepository } from '@/contexts/patients/domain/repositories/PatientAssignmentRepository';

/** Fake en memoria de la capa de asignación (convención del proyecto para tests de dominio). */
class InMemoryAssignments implements PatientAssignmentRepository {
  public readonly rows: PatientAssignment[] = [];
  public async save(a: PatientAssignment): Promise<void> {
    const i = this.rows.findIndex((x) => x.assignmentId() === a.assignmentId());
    if (i >= 0) this.rows[i] = a;
    else this.rows.push(a);
  }
  public async findLiveByPatient(patientId: string): Promise<PatientAssignment | null> {
    const live = this.rows.filter((a) => a.assignedPatientId() === patientId && a.isLive());
    return live.length ? live[live.length - 1] : null;
  }
  public async listByPatient(patientId: string): Promise<PatientAssignment[]> {
    return this.rows.filter((a) => a.assignedPatientId() === patientId);
  }
  public async listLiveByTratante(tratanteUserId: string): Promise<PatientAssignment[]> {
    return this.rows.filter((a) => a.isLive() && a.tratante() === tratanteUserId);
  }
  public async listLiveByOrganization(): Promise<PatientAssignment[]> {
    return this.rows.filter((a) => a.isLive());
  }
}

describe('PatientAssignment (capa de acceso institucional §1.2)', () => {
  it('con tratante humano queda "activa" y viva, no retenida por la institución', () => {
    const a = PatientAssignment.assign({
      id: 'a1',
      patientId: 'pac-1',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-1',
      supervisorUserId: 'profe-1',
      assignedBy: 'org-master',
      reason: 'alta',
    });
    expect(a.isLive()).toBe(true);
    expect(a.isHeldByInstitution()).toBe(false);
    expect(a.tratante()).toBe('estudiante-1');
    expect(a.supervisor()).toBe('profe-1');
    expect(a.toPrimitives().status).toBe('activa');
  });

  it('sin tratante (o cadena vacía) queda "institucion": retenida por la organización', () => {
    const sinTratante = PatientAssignment.assign({
      id: 'a2',
      patientId: 'pac-2',
      organizationId: 'org-1',
      tratanteUserId: null,
      assignedBy: 'org-master',
      reason: 'offboarding',
    });
    expect(sinTratante.isHeldByInstitution()).toBe(true);
    expect(sinTratante.isLive()).toBe(true);
    expect(sinTratante.tratante()).toBeNull();
    expect(sinTratante.toPrimitives().status).toBe('institucion');

    // Cadena vacía se normaliza a null (mismo resultado): no se cuela un tratante falso.
    const vacio = PatientAssignment.assign({
      id: 'a3',
      patientId: 'pac-3',
      organizationId: 'org-1',
      tratanteUserId: '   ',
      assignedBy: 'org-master',
      reason: 'manual',
    });
    expect(vacio.isHeldByInstitution()).toBe(true);
    expect(vacio.tratante()).toBeNull();
  });

  it('supersede() cierra la fila (deja de estar viva) sin perder el resto del dato', () => {
    const a = PatientAssignment.assign({
      id: 'a4',
      patientId: 'pac-4',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-1',
      assignedBy: 'org-master',
      reason: 'alta',
    });
    a.supersede();
    expect(a.isLive()).toBe(false);
    expect(a.toPrimitives().status).toBe('reasignada');
    expect(a.tratante()).toBe('estudiante-1'); // historia conservada
  });

  it('round-trip de primitivos preserva la identidad de la asignación', () => {
    const original = PatientAssignment.assign({
      id: 'a5',
      patientId: 'pac-5',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-2',
      supervisorUserId: 'profe-2',
      assignedBy: 'org-master',
      reason: 'reasignacion',
    });
    const clone = PatientAssignment.fromPrimitives(original.toPrimitives());
    expect(clone.toPrimitives()).toEqual(original.toPrimitives());
  });

  it('reasignar mantiene UNA sola fila viva y conserva la historia de custodia', async () => {
    const repo = new InMemoryAssignments();
    const first = PatientAssignment.assign({
      id: 'a6',
      patientId: 'pac-6',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-1',
      supervisorUserId: 'profe-1',
      assignedBy: 'org-master',
      reason: 'alta',
    });
    await repo.save(first);
    expect((await repo.findLiveByPatient('pac-6'))?.tratante()).toBe('estudiante-1');

    // Reasignar: cerrar la viva e insertar otra (al supervisor, p. ej. offboarding).
    first.supersede();
    await repo.save(first);
    const second = PatientAssignment.assign({
      id: 'a7',
      patientId: 'pac-6',
      organizationId: 'org-1',
      tratanteUserId: 'profe-1',
      assignedBy: 'org-master',
      reason: 'offboarding',
    });
    await repo.save(second);

    expect((await repo.findLiveByPatient('pac-6'))?.tratante()).toBe('profe-1');
    expect(await repo.listByPatient('pac-6')).toHaveLength(2); // historia íntegra
    expect(await repo.listLiveByTratante('estudiante-1')).toHaveLength(0); // ya no la tiene
    expect(await repo.listLiveByTratante('profe-1')).toHaveLength(1);
  });

  it('retener en la institución deja al paciente sin tratante pero nunca huérfano', async () => {
    const repo = new InMemoryAssignments();
    const held = PatientAssignment.assign({
      id: 'a8',
      patientId: 'pac-7',
      organizationId: 'org-1',
      tratanteUserId: null,
      assignedBy: 'org-master',
      reason: 'offboarding',
    });
    await repo.save(held);
    const live = await repo.findLiveByPatient('pac-7');
    expect(live).not.toBeNull();
    expect(live!.isHeldByInstitution()).toBe(true);
  });

  it('isAssignmentReason valida el vocabulario de motivos', () => {
    expect(isAssignmentReason('alta')).toBe(true);
    expect(isAssignmentReason('offboarding')).toBe(true);
    expect(isAssignmentReason('borrar')).toBe(false);
    expect(isAssignmentReason('')).toBe(false);
  });
});
