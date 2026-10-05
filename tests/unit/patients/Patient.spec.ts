import { describe, expect, it } from 'vitest';
import { Patient, isMinor } from '@/contexts/patients/domain/Patient';
import { PatientName } from '@/contexts/patients/domain/value-objects/PatientName';
import { PatientEmail } from '@/contexts/patients/domain/value-objects/PatientEmail';
import { PatientPhone } from '@/contexts/patients/domain/value-objects/PatientPhone';
import { EmergencyContact } from '@/contexts/patients/domain/value-objects/EmergencyContact';
import { PatientTags } from '@/contexts/patients/domain/value-objects/PatientTags';
import { CalendarDate } from '@/contexts/patients/domain/value-objects/CalendarDate';
import { PatientAlreadyArchivedError } from '@/contexts/patients/domain/errors/PatientAlreadyArchivedError';
import { PatientIsNotArchivedError } from '@/contexts/patients/domain/errors/PatientIsNotArchivedError';
import { PatientNameRequiredError } from '@/contexts/patients/domain/errors/PatientNameRequiredError';
import { InvalidCalendarDateError } from '@/contexts/patients/domain/errors/InvalidCalendarDateError';
import { InvalidPatientEmailError } from '@/contexts/patients/domain/errors/InvalidPatientEmailError';

function buildPatient(): Patient {
  return Patient.create(
    'patient-1',
    new PatientName('Ana López'),
    new PatientEmail('ana@ejemplo.com'),
    new PatientPhone('5512345678'),
    {
      birthDate: new CalendarDate('1992-04-15'),
      gender: 'femenino',
      consultationReason: 'Ansiedad',
      therapyStartDate: null,
      notes: '',
    },
    EmergencyContact.none(),
    PatientTags.none(),
  );
}

describe('Patient', () => {
  it('se archiva y se restaura', () => {
    const patient = buildPatient();
    patient.archive();
    expect(patient.isArchived()).toBe(true);
    patient.restore();
    expect(patient.isArchived()).toBe(false);
  });

  it('no permite archivar dos veces', () => {
    const patient = buildPatient();
    patient.archive();
    expect(() => patient.archive()).toThrow(PatientAlreadyArchivedError);
  });

  it('no permite restaurar si no está archivado', () => {
    const patient = buildPatient();
    expect(() => patient.restore()).toThrow(PatientIsNotArchivedError);
  });

  it('etiqueta y desetiqueta sin duplicados (insensible a mayúsculas)', () => {
    const patient = buildPatient();
    patient.tagWith('Pago anticipado');
    patient.tagWith('pago anticipado');
    expect(patient.toPrimitives().tags).toEqual(['Pago anticipado']);
    patient.untag('PAGO ANTICIPADO');
    expect(patient.toPrimitives().tags).toEqual([]);
  });

  it('detecta teléfonos inválidos para WhatsApp', () => {
    expect(new PatientPhone('5512345678').isValidForWhatsApp()).toBe(true);
    expect(new PatientPhone('55-1234-5678').isValidForWhatsApp()).toBe(true);
    expect(new PatientPhone('123').isValidForWhatsApp()).toBe(false);
    expect(new PatientPhone('no tengo').isValidForWhatsApp()).toBe(false);
    expect(PatientPhone.empty().isValidForWhatsApp()).toBe(false);
  });

  it('rechaza nombre vacío, fecha inválida y correo inválido', () => {
    expect(() => new PatientName('   ')).toThrow(PatientNameRequiredError);
    expect(() => new CalendarDate('15/04/1992')).toThrow(InvalidCalendarDateError);
    expect(() => new CalendarDate('2024-02-30')).toThrow(InvalidCalendarDateError);
    expect(() => new PatientEmail('no-es-correo')).toThrow(InvalidPatientEmailError);
    expect(new PatientEmail('').isEmpty()).toBe(true);
  });

  it('nace sin representante legal; setGuardian lo fija y va al round-trip de primitivos', () => {
    const patient = buildPatient();
    expect(patient.toPrimitives().guardianName).toBe('');
    expect(patient.toPrimitives().guardianRelationship).toBe('');
    expect(patient.toPrimitives().guardianDocument).toBe('');

    patient.setGuardian('  Laura Madre  ', '  madre  ', '  CC 123  ');
    const guardian = patient.guardianOfRecord();
    expect(guardian).toEqual({ name: 'Laura Madre', relationship: 'madre', document: 'CC 123' });

    const primitives = patient.toPrimitives();
    expect(primitives.guardianName).toBe('Laura Madre');
    expect(primitives.guardianRelationship).toBe('madre');
    expect(primitives.guardianDocument).toBe('CC 123');

    // Round-trip: fromPrimitives(toPrimitives) conserva el representante.
    const reloaded = Patient.fromPrimitives(primitives);
    expect(reloaded.guardianOfRecord()).toEqual({
      name: 'Laura Madre',
      relationship: 'madre',
      document: 'CC 123',
    });
  });

  it('fromPrimitives sin campos de representante (legados) usa cadenas vacías', () => {
    const reloaded = Patient.fromPrimitives({
      id: 'p',
      fullName: 'Vieja Ficha',
      email: '',
      phone: '',
      birthDate: null,
      gender: '',
      consultationReason: '',
      therapyStartDate: null,
      emergencyContactName: '',
      emergencyContactPhone: '',
      notes: '',
      tags: [],
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(reloaded.guardianOfRecord()).toEqual({ name: '', relationship: '', document: '' });
  });
});

describe('isMinor', () => {
  // Fecha de referencia fija para tests deterministas.
  const NOW = new Date('2026-06-19T12:00:00.000Z');

  it('birthDate null → false (sin fecha no se afirma minoría)', () => {
    expect(isMinor(null, NOW)).toBe(false);
  });

  it('claramente menor (nacido en 2015) → true', () => {
    expect(isMinor('2015-05-10', NOW)).toBe(true);
  });

  it('claramente adulto (nacido en 1990) → false', () => {
    expect(isMinor('1990-01-01', NOW)).toBe(false);
  });

  it('límite: cumple 18 justo hoy → adulto (false)', () => {
    expect(isMinor('2008-06-19', NOW)).toBe(false);
  });

  it('límite: cumple 18 mañana → todavía menor (true)', () => {
    expect(isMinor('2008-06-20', NOW)).toBe(true);
  });

  it('límite: 17 años y 364 días → menor (true)', () => {
    expect(isMinor('2008-06-21', NOW)).toBe(true);
  });

  it('formato inválido o vacío → false', () => {
    expect(isMinor('19/06/2008', NOW)).toBe(false);
    expect(isMinor('', NOW)).toBe(false);
  });
});
