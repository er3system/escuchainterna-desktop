import { describe, it, expect } from 'vitest';
import { PatientDocument } from '@/contexts/patients/domain/value-objects/PatientDocument';
import {
  documentTypeShort,
  formatPatientDocument,
  isDocumentTypeKey,
} from '@/contexts/patients/domain/value-objects/documentTypes';
import { Patient } from '@/contexts/patients/domain/Patient';
import { PatientName } from '@/contexts/patients/domain/value-objects/PatientName';
import { PatientEmail } from '@/contexts/patients/domain/value-objects/PatientEmail';
import { PatientPhone } from '@/contexts/patients/domain/value-objects/PatientPhone';
import { EmergencyContact } from '@/contexts/patients/domain/value-objects/EmergencyContact';
import { PatientTags } from '@/contexts/patients/domain/value-objects/PatientTags';
import { CreatePatientMessage } from '@/contexts/patients/application/create-patient/CreatePatientMessage';
import { UpdatePatientMessage } from '@/contexts/patients/application/update-patient/UpdatePatientMessage';

describe('catálogo de tipos de documento (§5)', () => {
  it('valida las claves conocidas y rechaza las inventadas', () => {
    expect(isDocumentTypeKey('CC')).toBe(true);
    expect(isDocumentTypeKey('PA')).toBe(true);
    expect(isDocumentTypeKey('RC')).toBe(true);
    expect(isDocumentTypeKey('DNI')).toBe(false);
    expect(isDocumentTypeKey('')).toBe(false);
  });

  it('formatea el documento de forma compacta y vacío cuando no hay número', () => {
    expect(formatPatientDocument('CC', '1234567')).toBe('CC · 1234567');
    expect(formatPatientDocument('PA', 'AB12')).toBe('Pasaporte · AB12');
    expect(formatPatientDocument('', '999')).toBe('999'); // número sin tipo → solo número
    expect(formatPatientDocument('CC', '   ')).toBe(''); // sin número útil → vacío
    expect(documentTypeShort('CC')).toBe('CC');
    expect(documentTypeShort('')).toBe('');
  });
});

describe('PatientDocument', () => {
  it('normaliza tipo desconocido a vacío y recorta el número', () => {
    const doc = PatientDocument.of('DNI', '  1234567  ');
    expect(doc.typeValue()).toBe(''); // tipo desconocido descartado, no lanza
    expect(doc.numberValue()).toBe('1234567');
    expect(doc.hasNumber()).toBe(true);
    expect(doc.isEmpty()).toBe(false);
  });

  it('empty() no tiene tipo ni número', () => {
    const doc = PatientDocument.empty();
    expect(doc.isEmpty()).toBe(true);
    expect(doc.hasNumber()).toBe(false);
    expect(doc.format()).toBe('');
  });

  it('conserva un tipo válido y lo formatea', () => {
    const doc = PatientDocument.of('CC', '1098765');
    expect(doc.typeValue()).toBe('CC');
    expect(doc.format()).toBe('CC · 1098765');
  });
});

function buildPatient(): Patient {
  return Patient.create(
    'pac-doc',
    new PatientName('Ana López'),
    new PatientEmail('ana@ejemplo.com'),
    new PatientPhone('3001234567', '+57'),
    { birthDate: null, gender: 'femenino', consultationReason: '', therapyStartDate: null, notes: '' },
    EmergencyContact.none(),
    PatientTags.none(),
  );
}

describe('Patient · documento de identificación', () => {
  it('nace sin documento y setDocument lo fija en los primitivos', () => {
    const patient = buildPatient();
    expect(patient.toPrimitives().documentType).toBe('');
    expect(patient.toPrimitives().documentNumber).toBe('');

    patient.setDocument(PatientDocument.of('CC', '1098765'));
    expect(patient.toPrimitives().documentType).toBe('CC');
    expect(patient.toPrimitives().documentNumber).toBe('1098765');
  });

  it('round-trip de primitivos conserva el documento', () => {
    const patient = buildPatient();
    patient.setDocument(PatientDocument.of('CE', '55-66-77'));
    const clone = Patient.fromPrimitives(patient.toPrimitives());
    expect(clone.toPrimitives().documentType).toBe('CE');
    expect(clone.toPrimitives().documentNumber).toBe('55-66-77');
  });

  it('updateContact reemplaza el documento cuando se le pasa uno', () => {
    const patient = buildPatient();
    patient.setDocument(PatientDocument.of('CC', '111'));
    patient.updateContact(
      new PatientName('Ana López'),
      new PatientEmail('ana@ejemplo.com'),
      new PatientPhone('3001234567', '+57'),
      EmergencyContact.none(),
      PatientDocument.of('PA', 'XY99'),
    );
    expect(patient.toPrimitives().documentType).toBe('PA');
    expect(patient.toPrimitives().documentNumber).toBe('XY99');
  });

  it('updateContact sin documento conserva el existente (retrocompatible)', () => {
    const patient = buildPatient();
    patient.setDocument(PatientDocument.of('CC', '222'));
    patient.updateContact(
      new PatientName('Ana López'),
      new PatientEmail('ana@ejemplo.com'),
      new PatientPhone('3001234567', '+57'),
      EmergencyContact.none(),
    );
    expect(patient.toPrimitives().documentNumber).toBe('222');
  });
});

describe('mensajes de alta/edición transportan el documento', () => {
  it('CreatePatientMessage expone el documento normalizado', () => {
    const message = new CreatePatientMessage({
      fullName: 'Ana',
      documentType: 'CC',
      documentNumber: '  1098765 ',
    });
    expect(message.patientDocument().typeValue()).toBe('CC');
    expect(message.patientDocument().numberValue()).toBe('1098765');
  });

  it('CreatePatientMessage sin documento queda vacío (no obligatorio al alta)', () => {
    const message = new CreatePatientMessage({ fullName: 'Ana' });
    expect(message.patientDocument().isEmpty()).toBe(true);
  });

  it('UpdatePatientMessage expone el documento', () => {
    const message = new UpdatePatientMessage({
      id: 'p1',
      fullName: 'Ana',
      documentType: 'TI',
      documentNumber: '987',
    });
    expect(message.patientDocument().typeValue()).toBe('TI');
    expect(message.patientDocument().numberValue()).toBe('987');
  });
});
