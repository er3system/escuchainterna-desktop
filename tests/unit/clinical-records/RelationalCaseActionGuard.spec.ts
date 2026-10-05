import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  caseExists: true,
  anchorIsMember: true,
  memberPatientIds: ['anchor-patient', 'other-patient'],
  assertWritablePatient: vi.fn(),
  setObjectives: vi.fn(),
  upsertRelation: vi.fn(),
  addJointSession: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  requireClinicalRecordWriteAccess: vi.fn().mockResolvedValue('owner-1'),
  assertPatientNotInInstitutionalCustody: harness.assertWritablePatient,
}));
vi.mock(
  '@/contexts/clinical-records/infrastructure/persistence/SqliteRelationalCaseRepository',
  () => ({
    SqliteRelationalCaseRepository: class {
      public async findById(): Promise<object | null> {
        return harness.caseExists ? {} : null;
      }
    },
  }),
);
vi.mock(
  '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseMemberRepository',
  () => ({
    SqliteCaseMemberRepository: class {
      public async findByCaseAndPatient(): Promise<object | null> {
        return harness.anchorIsMember ? {} : null;
      }

      public async listByCase(): Promise<Array<{ toPrimitives: () => { id: string; patientId: string } }>> {
        return harness.memberPatientIds.map((patientId) => ({
          toPrimitives: () => ({ id: `${patientId}-member`, patientId }),
        }));
      }
    },
  }),
);
vi.mock('@/contexts/clinical-records/application/relational-cases/EditCaseProfile', () => ({
  EditCaseProfile: class {
    public async setObjectives(caseId: string, objectives: string): Promise<void> {
      await harness.setObjectives(caseId, objectives);
    }

    public async upsertRelation(caseId: string, relation: object): Promise<void> {
      await harness.upsertRelation(caseId, relation);
    }
  },
}));
vi.mock('@/contexts/clinical-records/application/relational-cases/AddJointSession', () => ({
  AddJointSession: class {
    public async execute(input: object): Promise<void> {
      await harness.addJointSession(input);
    }
  },
}));

import {
  addJointSessionAction,
  setCaseObjectivesAction,
  upsertMemberRelationAction,
} from '@/app/(app)/pacientes/[id]/vinculos/actions';

describe('guard de escritura de casos relacionales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.caseExists = true;
    harness.anchorIsMember = true;
    harness.memberPatientIds = ['anchor-patient', 'other-patient'];
    harness.assertWritablePatient.mockResolvedValue(undefined);
  });

  it('comprueba todos los pacientes del caso antes de mutar contenido compartido', async () => {
    const formData = new FormData();
    formData.set('objectives', 'objetivo sistémico');

    await setCaseObjectivesAction('anchor-patient', 'case-1', formData);

    expect(harness.assertWritablePatient).toHaveBeenNthCalledWith(1, 'anchor-patient', 'owner-1');
    expect(harness.assertWritablePatient).toHaveBeenNthCalledWith(2, 'other-patient', 'owner-1');
    expect(harness.setObjectives).toHaveBeenCalledWith('case-1', 'objetivo sistémico');
  });

  it('no permite usar como ancla un paciente que no pertenece al caso', async () => {
    harness.anchorIsMember = false;

    await expect(
      setCaseObjectivesAction('unrelated-patient', 'case-1', new FormData()),
    ).rejects.toThrow('NOT_FOUND');
    expect(harness.setObjectives).not.toHaveBeenCalled();
  });

  it('bloquea todo el caso si cualquiera de sus miembros está en custodia', async () => {
    harness.assertWritablePatient.mockImplementation(async (patientId: string) => {
      if (patientId === 'other-patient') throw new Error('CUSTODY_READ_ONLY');
    });

    await expect(
      setCaseObjectivesAction('anchor-patient', 'case-1', new FormData()),
    ).rejects.toThrow('CUSTODY_READ_ONLY');
    expect(harness.setObjectives).not.toHaveBeenCalled();
  });

  it('rechaza relaciones que referencian un miembro ajeno al caso', async () => {
    const formData = new FormData();
    formData.set('aMemberId', 'anchor-patient-member');
    formData.set('bMemberId', 'member-from-another-case');
    formData.set('quality', 'cercano');

    await expect(
      upsertMemberRelationAction('anchor-patient', 'case-1', formData),
    ).rejects.toThrow('NOT_FOUND');
    expect(harness.upsertRelation).not.toHaveBeenCalled();
  });

  it('rechaza asistentes de sesión conjunta que no sean miembros del caso', async () => {
    const formData = new FormData();
    formData.set('title', 'Sesión');
    formData.set('content', 'Contenido compartido');
    formData.append('attendees', 'anchor-patient-member');
    formData.append('attendees', 'member-from-another-case');

    await expect(
      addJointSessionAction('anchor-patient', 'case-1', formData),
    ).rejects.toThrow('NOT_FOUND');
    expect(harness.addJointSession).not.toHaveBeenCalled();
  });
});
