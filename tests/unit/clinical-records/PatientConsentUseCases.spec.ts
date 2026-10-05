import { describe, expect, it } from 'vitest';
import { AttachPaperConsent } from '@/contexts/clinical-records/application/attach-paper-consent/AttachPaperConsent';
import { AttachPaperConsentMessage } from '@/contexts/clinical-records/application/attach-paper-consent/AttachPaperConsentMessage';
import { GetConsentByToken } from '@/contexts/clinical-records/application/get-consent-by-token/GetConsentByToken';
import { RevokePatientConsent } from '@/contexts/clinical-records/application/revoke-patient-consent/RevokePatientConsent';
import { UpdateConsentTemplate } from '@/contexts/clinical-records/application/update-consent-template/UpdateConsentTemplate';
import { UpdateConsentTemplateMessage } from '@/contexts/clinical-records/application/update-consent-template/UpdateConsentTemplateMessage';
import { ConsentTemplate } from '@/contexts/clinical-records/domain/ConsentTemplate';
import { PatientConsent } from '@/contexts/clinical-records/domain/PatientConsent';
import type { PatientFileStorage } from '@/contexts/clinical-records/domain/PatientFileStorage';
import { ConsentAlreadySignedError } from '@/contexts/clinical-records/domain/errors/ConsentAlreadySignedError';
import { ConsentNotFoundError } from '@/contexts/clinical-records/domain/errors/ConsentNotFoundError';
import { InvalidConsentTemplateError } from '@/contexts/clinical-records/domain/errors/InvalidConsentTemplateError';
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

// --- Dobles en memoria (mismo patrón que IssuePatientConsent.spec.ts) ---

class InMemoryConsents implements PatientConsentRepository, ConsentByTokenRepository {
  private readonly byId = new Map<string, PatientConsent>();

  public async save(consent: PatientConsent): Promise<void> {
    this.byId.set(consent.consentId(), consent);
  }

  public async findById(id: string): Promise<PatientConsent | null> {
    return this.byId.get(id) ?? null;
  }

  public async findLatestByPatient(patientId: string): Promise<PatientConsent | null> {
    return (await this.listByPatient(patientId))[0] ?? null;
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

/** Espía de almacenamiento: registra cada save para verificar que NO se invoca antes de tiempo. */
class SpyStorage implements PatientFileStorage {
  public readonly saves: Array<{ patientId: string; name: string; bytes: number }> = [];

  public async save(patientId: string, sanitizedName: string, data: Uint8Array): Promise<string> {
    this.saves.push({ patientId, name: sanitizedName, bytes: data.byteLength });
    return `${patientId}/${sanitizedName}`;
  }

  public async read(): Promise<Uint8Array | null> {
    return null;
  }

  public async delete(): Promise<void> {
    // no-op en memoria
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

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function paperMessage(): AttachPaperConsentMessage {
  return new AttachPaperConsentMessage({
    patientId: 'pac-1',
    filename: 'firmado.png',
    mime: 'image/png',
    data: pngBytes(),
  });
}

describe('GetConsentByToken (lectura pública)', () => {
  it('token vacío o solo espacios → null sin lanzar', async () => {
    const useCase = new GetConsentByToken(new InMemoryConsents());
    expect(await useCase.execute('')).toBeNull();
    expect(await useCase.execute('   ')).toBeNull();
  });

  it('token inexistente → null (no filtra existencia)', async () => {
    const useCase = new GetConsentByToken(new InMemoryConsents());
    expect(await useCase.execute('token-que-no-existe')).toBeNull();
  });

  it('token válido → primitives del consentimiento', async () => {
    const consents = new InMemoryConsents();
    const consent = PatientConsent.issue({
      id: 'con-1',
      patientId: 'pac-1',
      token: 'tok-publico-abcdef123456',
      templateTitle: 'Consentimiento informado',
      templateBody: 'Texto del consentimiento.',
    });
    await consents.save(consent);

    const result = await new GetConsentByToken(consents).execute('  tok-publico-abcdef123456  ');
    expect(result).not.toBeNull();
    expect(result?.token).toBe('tok-publico-abcdef123456');
    expect(result?.patientId).toBe('pac-1');
    expect(result?.status).toBe('pendiente');
  });
});

describe('AttachPaperConsent (integridad/orden)', () => {
  it('si ya está firmado → ConsentAlreadySignedError ANTES de tocar el almacenamiento', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const storage = new SpyStorage();

    const signed = PatientConsent.issue({
      id: 'con-firmado',
      patientId: 'pac-1',
      token: 'tok-firmado-abcdef123456',
      templateTitle: 'Consentimiento informado',
      templateBody: 'Texto.',
    });
    signed.signDigitally('Ana López');
    await consents.save(signed);

    const useCase = new AttachPaperConsent(consents, templates, directory, identity, storage);

    await expect(useCase.execute(paperMessage())).rejects.toThrow(ConsentAlreadySignedError);
    // No deja archivos huérfanos: el espía nunca se invocó.
    expect(storage.saves).toHaveLength(0);
  });

  it('si no existía consentimiento, lo crea con snapshot y queda en papel_adjunto', async () => {
    const consents = new InMemoryConsents();
    const templates = new InMemoryTemplates();
    const storage = new SpyStorage();

    const useCase = new AttachPaperConsent(consents, templates, directory, identity, storage);
    const result = await useCase.execute(paperMessage());

    expect(result.status).toBe('papel_adjunto');
    expect(result.signatureKind).toBe('papel');
    expect(result.filePath).not.toBeNull();
    // Snapshot congelado del paciente/profesional.
    expect(result.templateBody).toContain('Ana López');
    expect(result.templateBody).toContain('Dra. Marta Ruiz');
    // Esta vez sí se guardó exactamente una vez.
    expect(storage.saves).toHaveLength(1);
    expect(storage.saves[0]?.patientId).toBe('pac-1');
    // Quedó persistido como el último consentimiento del paciente.
    expect((await consents.findLatestByPatient('pac-1'))?.toPrimitives().status).toBe('papel_adjunto');
  });
});

describe('RevokePatientConsent', () => {
  it('sin consentimiento del paciente → ConsentNotFoundError', async () => {
    const consents = new InMemoryConsents();
    await expect(new RevokePatientConsent(consents).execute('pac-1')).rejects.toThrow(ConsentNotFoundError);
  });

  it('pendiente → revocado', async () => {
    const consents = new InMemoryConsents();
    await consents.save(
      PatientConsent.issue({
        id: 'con-1',
        patientId: 'pac-1',
        token: 'tok-pendiente-abcdef1234',
        templateTitle: 'Consentimiento informado',
        templateBody: 'Texto.',
      }),
    );

    await new RevokePatientConsent(consents).execute('pac-1');

    expect((await consents.findLatestByPatient('pac-1'))?.toPrimitives().status).toBe('revocado');
  });
});

describe('UpdateConsentTemplate', () => {
  it('persiste título y cuerpo de la plantilla', async () => {
    const templates = new InMemoryTemplates();
    const body = 'A'.repeat(220);
    const message = new UpdateConsentTemplateMessage({ title: 'Mi plantilla', body });

    await new UpdateConsentTemplate(templates).execute(message);

    const saved = await templates.find();
    expect(saved).not.toBeNull();
    expect(saved?.toPrimitives().title).toBe('Mi plantilla');
    expect(saved?.toPrimitives().body).toBe(body);
  });

  it('cuerpo demasiado corto → InvalidConsentTemplateError (y no persiste)', async () => {
    const templates = new InMemoryTemplates();
    // No vacío (pasa el mensaje) pero < 200 caracteres (rechazado por el agregado).
    const message = new UpdateConsentTemplateMessage({ title: 'Mi plantilla', body: 'Muy corto.' });

    await expect(new UpdateConsentTemplate(templates).execute(message)).rejects.toThrow(
      InvalidConsentTemplateError,
    );
    expect(await templates.find()).toBeNull();
  });
});
