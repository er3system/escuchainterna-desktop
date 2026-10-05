import { describe, it, expect } from 'vitest';
import { AssignPatient } from '@/contexts/patients/application/assign-patient/AssignPatient';
import { CreatePatient } from '@/contexts/patients/application/create-patient/CreatePatient';
import { CreatePatientMessage } from '@/contexts/patients/application/create-patient/CreatePatientMessage';
import { PatientAssignment } from '@/contexts/patients/domain/PatientAssignment';
import type { PatientAssignmentRepository } from '@/contexts/patients/domain/repositories/PatientAssignmentRepository';
import { InMemoryPatientRepository } from './InMemoryPatientRepository';

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

describe('CreatePatient · propiedad institucional (§1)', () => {
  it('coloca al paciente bajo la organización cuando el mensaje la trae', async () => {
    const repo = new InMemoryPatientRepository();
    const id = await new CreatePatient(repo).create(
      new CreatePatientMessage({ fullName: 'Ana', organizationId: 'org-1' }),
    );
    expect((await repo.findById(id))!.toPrimitives().organizationId).toBe('org-1');
  });

  it('sin organización el paciente es individual (organizationId null)', async () => {
    const repo = new InMemoryPatientRepository();
    const id = await new CreatePatient(repo).create(new CreatePatientMessage({ fullName: 'Ana' }));
    expect((await repo.findById(id))!.toPrimitives().organizationId).toBeNull();
  });
});

describe('AssignPatient (capa de acceso §1.2)', () => {
  it('crea una asignación viva con tratante y supervisor', async () => {
    const repo = new InMemoryAssignments();
    await new AssignPatient(repo).execute({
      patientId: 'pac-1',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-1',
      supervisorUserId: 'profe-1',
      assignedBy: 'estudiante-1',
      reason: 'alta',
    });
    const live = (await repo.findLiveByPatient('pac-1'))!;
    expect(live.tratante()).toBe('estudiante-1');
    expect(live.supervisor()).toBe('profe-1');
    expect(live.isHeldByInstitution()).toBe(false);
  });

  it('reasignar supersede la asignación viva previa (UNA sola viva + historia)', async () => {
    const repo = new InMemoryAssignments();
    const assign = new AssignPatient(repo);
    await assign.execute({
      patientId: 'pac-1',
      organizationId: 'org-1',
      tratanteUserId: 'estudiante-1',
      assignedBy: 'org-master',
      reason: 'alta',
    });
    await assign.execute({
      patientId: 'pac-1',
      organizationId: 'org-1',
      tratanteUserId: 'profe-1',
      assignedBy: 'org-master',
      reason: 'offboarding',
    });
    expect((await repo.findLiveByPatient('pac-1'))!.tratante()).toBe('profe-1');
    expect(await repo.listByPatient('pac-1')).toHaveLength(2); // historia conservada
    expect(await repo.listLiveByTratante('estudiante-1')).toHaveLength(0);
    expect(await repo.listLiveByTratante('profe-1')).toHaveLength(1);
  });

  it('sin tratante (null) la asignación queda retenida por la institución', async () => {
    const repo = new InMemoryAssignments();
    await new AssignPatient(repo).execute({
      patientId: 'pac-2',
      organizationId: 'org-1',
      tratanteUserId: null,
      assignedBy: 'org-master',
      reason: 'offboarding',
    });
    expect((await repo.findLiveByPatient('pac-2'))!.isHeldByInstitution()).toBe(true);
  });
});
