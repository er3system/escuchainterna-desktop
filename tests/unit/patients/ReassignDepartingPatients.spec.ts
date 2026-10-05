import { describe, it, expect } from 'vitest';
import { ReassignDepartingPatients, type ActiveSupervisorResolver } from '@/contexts/patients/application/offboard-member/ReassignDepartingPatients';
import { AssignPatient } from '@/contexts/patients/application/assign-patient/AssignPatient';
import { PatientAssignment } from '@/contexts/patients/domain/PatientAssignment';
import type { PatientAssignmentRepository } from '@/contexts/patients/domain/repositories/PatientAssignmentRepository';
import type { PatientOwnerWriter } from '@/contexts/patients/domain/repositories/PatientOwnerWriter';
import type { InstitutionalPatientReader } from '@/contexts/patients/domain/repositories/InstitutionalPatientReader';

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
  public readonly owners = new Map<string, string>();
  public async setOwner(
    patientId: string,
    _organizationId: string,
    newOwnerUserId: string,
  ): Promise<boolean> {
    this.owners.set(patientId, newOwnerUserId);
    return true;
  }
}

class FakePatients implements InstitutionalPatientReader {
  public constructor(private readonly ids: string[]) {}
  public async listInstitutionalPatientIds(): Promise<string[]> {
    return this.ids;
  }
}

function supervisorResolver(value: string | null): ActiveSupervisorResolver {
  return { findActiveSupervisor: () => Promise.resolve(value) };
}

async function seed(assignments: InMemoryAssignments, patientId: string, tratante: string) {
  await new AssignPatient(assignments).execute({
    patientId,
    organizationId: 'org-1',
    tratanteUserId: tratante,
    assignedBy: 'org-master',
    reason: 'alta',
  });
}

describe('ReassignDepartingPatients — offboarding (§3.2)', () => {
  it('con supervisor activo: TODA la cartera pasa al supervisor', async () => {
    const assignments = new InMemoryAssignments();
    const owners = new FakeOwnerWriter();
    await seed(assignments, 'pac-1', 'estudiante-1');
    await seed(assignments, 'pac-2', 'estudiante-1');

    const result = await new ReassignDepartingPatients(
      new FakePatients(['pac-1', 'pac-2']),
      owners,
      assignments,
      supervisorResolver('profe-1'),
    ).execute({ organizationId: 'org-1', leavingUserId: 'estudiante-1', institutionUserId: 'master-1', actorUserId: 'master-1' });

    expect(result.reassignedCount).toBe(2);
    expect(result.target).toBe('supervisor');
    expect(owners.owners.get('pac-1')).toBe('profe-1');
    expect(owners.owners.get('pac-2')).toBe('profe-1');
    expect((await assignments.findLiveByPatient('pac-1'))!.tratante()).toBe('profe-1');
    expect(await assignments.listLiveByTratante('estudiante-1')).toHaveLength(0); // ya no tiene ninguno
  });

  it('SIN supervisor activo: la cartera se retiene en la institución (ningún huérfano)', async () => {
    const assignments = new InMemoryAssignments();
    const owners = new FakeOwnerWriter();
    await seed(assignments, 'pac-3', 'estudiante-2');

    const result = await new ReassignDepartingPatients(
      new FakePatients(['pac-3']),
      owners,
      assignments,
      supervisorResolver(null),
    ).execute({ organizationId: 'org-1', leavingUserId: 'estudiante-2', institutionUserId: 'master-1', actorUserId: 'master-1' });

    expect(result.target).toBe('institucion');
    expect(owners.owners.get('pac-3')).toBe('master-1'); // custodio institucional
    const live = (await assignments.findLiveByPatient('pac-3'))!;
    expect(live.isHeldByInstitution()).toBe(true);
    expect(live.tratante()).toBeNull();
  });

  it('sin pacientes: no reasigna nada (cuenta 0)', async () => {
    const result = await new ReassignDepartingPatients(
      new FakePatients([]),
      new FakeOwnerWriter(),
      new InMemoryAssignments(),
      supervisorResolver('profe-1'),
    ).execute({ organizationId: 'org-1', leavingUserId: 'estudiante-9', institutionUserId: 'master-1', actorUserId: 'master-1' });
    expect(result.reassignedCount).toBe(0);
  });
});
