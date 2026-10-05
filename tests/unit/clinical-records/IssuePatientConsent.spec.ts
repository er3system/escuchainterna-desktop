import { describe, expect, it } from 'vitest';
import { IssuePatientConsent } from '@/contexts/clinical-records/application/issue-patient-consent/IssuePatientConsent';
import { SignPatientConsent } from '@/contexts/clinical-records/application/sign-patient-consent/SignPatientConsent';
import { SignPatientConsentMessage } from '@/contexts/clinical-records/application/sign-patient-consent/SignPatientConsentMessage';
import { ConsentTemplate } from '@/contexts/clinical-records/domain/ConsentTemplate';
import { PatientConsent } from '@/contexts/clinical-records/domain/PatientConsent';
import { ConsentAlreadySignedError } from '@/contexts/clinical-records/domain/errors/ConsentAlreadySignedError';
import { MinorRequiresGuardianError } from '@/contexts/clinical-records/domain/errors/MinorRequiresGuardianError';
import { InvalidConsentSignatureError } from '@/contexts/clinical-records/domain/errors/InvalidConsentSignatureError';
import type { ConsentByTokenRepository } from '@/contexts/clinical-records/domain/repositories/ConsentByTokenRepository';
import type { ConsentTemplateRepository } from '@/contexts/clinical-records/domain/repositories/ConsentTemplateRepository';
import type { PatientConsentRepository } from '@/contexts/clinical-records/domain/repositories/PatientConsentRepository';
import type {
  PatientDirectory,
  PatientSummary,
} from '@/contexts/clinical-records/domain/repositories/PatientDirectory';
import type {
  ProfessionalIdentity,
  ProfessionalIdentityReader,
} from '@/contexts/clinical-records/domain/repositories/ProfessionalIdentityReader';

class InMemoryConsents implements PatientConsentRepository, ConsentByTokenRepository {
  private readonly byId = new Map<string, PatientConsent>();

  public async save(consent: PatientConsent): Promise<void> {
    this.byId.set(consent.consentId(), consent);
  }

  public async findById(id: string): Promise<PatientConsent | null> {
    return this.byId.get(id) ?? null;
  }

  public async findLatestByPatient(patientId: string): Promise<PatientConsent | null> {
    const all = await this.listByPatient(patientId);
    return all[0] ?? null;
  }

  public async listByPatient(patientId: string): Promise<PatientConsent[]> {
    return [...this.byId.values()]
      .filter((consent) => consent.belongsTo(patientId))
      .sort((a, b) => b.toPrimitives().createdAt.localeCompare(a.toPrimitives().createdAt));
  }

  public async findByToken(token: string): Promise<PatientConsent | null> {
    return [...this.byId.values()].find((consent) => consent.toPrimitives().token === token) ?? null;
  }
}

class InMemoryTemplates implements ConsentTemplateRepository {
  private template: ConsentTemplate | null = null;

  public async find(): Promise<ConsentTemplate | null> {
    return this.template;
  }

  public async save(template: ConsentTemplate): Promise<void> {
    this.template = template;
  }
}

const ANA: PatientSummary = {
  id: 'pac-1',
  fullName: 'Ana López',
  email: 'ana@example.com',
  phone: '+57 3001234567',
  birthDate: null,
  gender: '',
  consultationReason: '',
  therapyStartDate: null,
  emergencyContactName: '',
  emergencyContactPhone: '',
  notes: '',
  tags: [],
  documentType: '',
  documentNumber: '',
  guardianName: '',
  guardianRelationship: '',
  guardianDocument: '',
  currentMedication: '',
  medicalHistory: '',
  sessionFrequency: '',
  sessionModality: '',
  processStatus: 'activo',
  treatmentEndDate: null,
  treatmentEndReason: '',
  insuranceName: '',
  insurancePolicyNumber: '',
  referralSource: '',
  customFields: [],
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const directory: PatientDirectory = {
  findSummary: (patientId) => Promise.resolve(patientId === 'pac-1' ? ANA : null),
  updateSummary: () => Promise.resolve(undefined),
  findDuplicateByDocument: () => Promise.resolve(null),
};

const identity: ProfessionalIdentityReader = {
  read: (): Promise<ProfessionalIdentity> =>
    Promise.resolve({
      fullName: 'Dra. Marta Ruiz',
      professionalLicense: 'TP-998877',
      email: 'marta@example.com',
      contactPhone: '',
      contactAddress: '',
      organizationName: null,
      organizationLogoDataUri: null,
    }),
};

function makeUseCase(consents: InMemoryConsents, templates: InMemoryTemplates): IssuePatientConsent {
  return new IssuePatientConsent(consents, templates, directory, identity);
}

describe('IssuePatientConsent', () => {
  it('crea la plantilla base al primer uso y congela paciente/profesional/cédula en el snapshot', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const issued = await makeUseCase(consents, templates).execute('pac-1');

    expect(await templates.find()).not.toBeNull();
    expect(issued.resent).toBe(false);
    expect(issued.consent.status).toBe('pendiente');
    expect(issued.consent.token.length).toBeGreaterThanOrEqual(20);
    expect(issued.consent.templateBody).toContain('Ana López');
    expect(issued.consent.templateBody).toContain('Dra. Marta Ruiz');
    expect(issued.consent.templateBody).toContain('TP-998877');
    // {{fecha}} queda viva: se resuelve con la fecha de firma al mostrar.
    expect(issued.consent.templateBody).toContain('{{fecha}}');
  });

  it('si ya hay liga pendiente la reutiliza como reenvío (mismo token)', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const useCase = makeUseCase(consents, templates);
    const first = await useCase.execute('pac-1');
    const second = await useCase.execute('pac-1');

    expect(second.resent).toBe(true);
    expect(second.consent.token).toBe(first.consent.token);
    expect(await consents.listByPatient('pac-1')).toHaveLength(1);
  });

  it('no emite otra liga si el paciente ya firmó', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const useCase = makeUseCase(consents, templates);
    const issued = await useCase.execute('pac-1');

    await new SignPatientConsent(consents).execute(
      new SignPatientConsentMessage({
        token: issued.consent.token,
        signedName: 'Ana López',
        accepted: true,
      }),
    );

    await expect(useCase.execute('pac-1')).rejects.toThrow(ConsentAlreadySignedError);
  });
});

describe('IssuePatientConsent · menor de edad', () => {
  // Menor (nacido en 2015) con representante legal: el cuerpo congelado debe nombrar al
  // representante y declarar que otorga el consentimiento en nombre del menor.
  const MENOR: PatientSummary = {
    ...ANA,
    id: 'pac-menor',
    fullName: 'Mateo Niño',
    birthDate: '2015-05-10',
    guardianName: 'Laura Madre',
    guardianRelationship: 'madre',
    guardianDocument: 'CC 123',
  };

  const minorDirectory: PatientDirectory = {
    findSummary: (patientId) =>
      Promise.resolve(patientId === 'pac-menor' ? MENOR : patientId === 'pac-1' ? ANA : null),
    updateSummary: () => Promise.resolve(undefined),
    findDuplicateByDocument: () => Promise.resolve(null),
  };

  it('antepone el aviso del representante legal y nombra al acudiente + parentesco', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const issued = await new IssuePatientConsent(consents, templates, minorDirectory, identity).execute(
      'pac-menor',
    );

    expect(issued.consent.templateBody).toContain('AVISO PARA PACIENTE MENOR DE EDAD');
    expect(issued.consent.templateBody).toContain('Laura Madre');
    expect(issued.consent.templateBody).toContain('(madre)');
    expect(issued.consent.templateBody).toContain('Mateo Niño');
    // El cuerpo base (1ª persona) se conserva tras el aviso.
    expect(issued.consent.templateBody).toContain('Mateo Niño, en pleno uso de mis facultades');
  });

  it('paciente menor SIN representante: SE NIEGA a emitir (Ley 1581, no degrada a flujo de adulto)', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const sinRepDirectory: PatientDirectory = {
      findSummary: () =>
        Promise.resolve({ ...MENOR, guardianName: '', guardianRelationship: '', guardianDocument: '' }),
      updateSummary: () => Promise.resolve(undefined),
      findDuplicateByDocument: () => Promise.resolve(null),
    };

    // Antes emitía un consentimiento de adulto que el propio menor firmaba (documento nulo).
    await expect(
      new IssuePatientConsent(consents, templates, sinRepDirectory, identity).execute('pac-menor'),
    ).rejects.toThrow(MinorRequiresGuardianError);
    // Y no se creó ninguna liga.
    expect(await consents.listByPatient('pac-menor')).toHaveLength(0);
  });

  it('paciente ADULTO con datos de representante: no añade el aviso (comportamiento actual)', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const adultoConRep: PatientDirectory = {
      findSummary: () =>
        Promise.resolve({
          ...ANA,
          birthDate: '1990-01-01',
          guardianName: 'Alguien',
          guardianRelationship: 'cónyuge',
          guardianDocument: 'CC 9',
        }),
      updateSummary: () => Promise.resolve(undefined),
      findDuplicateByDocument: () => Promise.resolve(null),
    };
    const issued = await new IssuePatientConsent(consents, templates, adultoConRep, identity).execute('pac-1');

    expect(issued.consent.templateBody).not.toContain('AVISO PARA PACIENTE MENOR DE EDAD');
  });
});

describe('SignPatientConsent', () => {
  it('exige la casilla de aceptación y registra la firma una sola vez', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const issued = await makeUseCase(consents, templates).execute('pac-1');
    const sign = new SignPatientConsent(consents);

    expect(
      () => new SignPatientConsentMessage({ token: issued.consent.token, signedName: 'Ana López', accepted: false }),
    ).toThrow(InvalidConsentSignatureError);

    const result = await sign.execute(
      new SignPatientConsentMessage({ token: issued.consent.token, signedName: 'Ana López', accepted: true }),
    );
    expect(result.status).toBe('firmado');

    // Idempotente: una segunda firma no pisa la primera.
    const again = await sign.execute(
      new SignPatientConsentMessage({ token: issued.consent.token, signedName: 'Otra Persona', accepted: true }),
    );
    expect(again.signedName).toBe('Ana López');
  });
});
