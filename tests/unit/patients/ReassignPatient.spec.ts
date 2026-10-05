import { describe, it, expect } from 'vitest';
import { ReassignPatient } from '@/contexts/patients/application/reassign-patient/ReassignPatient';
import { AssignPatient } from '@/contexts/patients/application/assign-patient/AssignPatient';
import { PatientAssignment } from '@/contexts/patients/domain/PatientAssignment';
import type { PatientAssignmentRepository } from '@/contexts/patients/domain/repositories/PatientAssignmentRepository';
import type { PatientOwnerWriter } from '@/contexts/patients/domain/repositories/PatientOwnerWriter';

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
  public async listLiveByTratante(t: string): Promise<PatientAssignment[]> {
    return this.rows.filter((a) => a.isLive() && a.tratante() === t);
  }
  public async listLiveByOrganization(): Promise<PatientAssignment[]> {
    return this.rows.filter((a) => a.isLive());
  }
}

class FakeOwnerWriter implements PatientOwnerWriter {
  public lastOwner: string | null = null;
  public constructor(private readonly belongsToOrg = true) {}
  public async setOwner(
    _patientId: string,
    _organizationId: string,
    newOwnerUserId: string,
  ): Promise<boolean> {
    if (!this.belongsToOrg) return false;
    this.lastOwner = newOwnerUserId;
    return true;
  }
}

async function seedActive(assignments: InMemoryAssignments, patientId: string, tratante: string) {
  await new AssignPatient(assignments).execute({
    patientId,
    organizationId: 'org-1',
    tratanteUserId: tratante,
    assignedBy: 'org-master',
    reason: 'alta',
  });
}

describe('ReassignPatient (§1.2, §3.3)', () => {
  it('reasigna a un nuevo tratante: mueve owner y supersede la asignación viva', async () => {
    const owners = new FakeOwnerWriter();
    const assignments = new InMemoryAssignments();
    await seedActive(assignments, 'pac-1', 'estudiante-1');

    const result = await new ReassignPatient(owners, assignments).execute({
      patientId: 'pac-1',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-2',
      institutionUserId: 'master-1',
      assignedBy: 'master-1',
    });

    expect(result.ok).toBe(true);
    expect(owners.lastOwner).toBe('estudiante-2'); // dueño operativo = nuevo tratante
    const live = (await assignments.findLiveByPatient('pac-1'))!;
    expect(live.tratante()).toBe('estudiante-2');
    expect(live.isHeldByInstitution()).toBe(false);
    expect(await assignments.listByPatient('pac-1')).toHaveLength(2); // historia conservada
    expect(await assignments.listLiveByTratante('estudiante-1')).toHaveLength(0);
  });

  it('retener en la institución: owner = custodio, asignación sin tratante', async () => {
    const owners = new FakeOwnerWriter();
    const assignments = new InMemoryAssignments();
    await seedActive(assignments, 'pac-2', 'estudiante-1');

    const result = await new ReassignPatient(owners, assignments).execute({
      patientId: 'pac-2',
      organizationId: 'org-1',
      tratanteUserId: null,
      institutionUserId: 'master-1',
      assignedBy: 'master-1',
      reason: 'offboarding',
    });

    expect(result.ok).toBe(true);
    expect(owners.lastOwner).toBe('master-1'); // dueño operativo = custodio institucional
    const live = (await assignments.findLiveByPatient('pac-2'))!;
    expect(live.isHeldByInstitution()).toBe(true);
    expect(live.tratante()).toBeNull();
  });

  it('no reasigna si el paciente no pertenece a la organización (no toca asignaciones)', async () => {
    const owners = new FakeOwnerWriter(false); // setOwner devuelve false
    const assignments = new InMemoryAssignments();
    await seedActive(assignments, 'pac-3', 'estudiante-1');

    const result = await new ReassignPatient(owners, assignments).execute({
      patientId: 'pac-3',
      organizationId: 'org-otra',
      tratanteUserId: 'estudiante-2',
      institutionUserId: 'master-1',
      assignedBy: 'master-1',
    });

    expect(result.ok).toBe(false);
    // La asignación original sigue intacta (no se superseo).
    expect((await assignments.findLiveByPatient('pac-3'))!.tratante()).toBe('estudiante-1');
    expect(await assignments.listByPatient('pac-3')).toHaveLength(1);
  });
});
