import { describe, expect, it } from 'vitest';
import { PatientConsent } from '@/contexts/clinical-records/domain/PatientConsent';
import { ConsentAlreadySignedError } from '@/contexts/clinical-records/domain/errors/ConsentAlreadySignedError';
import { ConsentLinkRevokedError } from '@/contexts/clinical-records/domain/errors/ConsentLinkRevokedError';
import { InvalidConsentSignatureError } from '@/contexts/clinical-records/domain/errors/InvalidConsentSignatureError';

function issued(): PatientConsent {
  return PatientConsent.issue({
    id: 'con-1',
    patientId: 'pac-1',
    token: 'token-abc',
    templateTitle: 'Consentimiento informado',
    templateBody: 'Yo, Ana López, acepto el proceso el día {{fecha}}.',
  });
}

describe('PatientConsent', () => {
  it('nace pendiente, con liga enviada y sin firma', () => {
    const primitives = issued().toPrimitives();
    expect(primitives.status).toBe('pendiente');
    expect(primitives.sentAt).not.toBeNull();
    expect(primitives.signedAt).toBeNull();
    expect(primitives.signedName).toBe('');
    expect(primitives.signatureKind).toBe('');
  });

  it('la firma digital exige nombre completo (nombre y apellido)', () => {
    const consent = issued();
    expect(() => consent.signDigitally('Ana')).toThrow(InvalidConsentSignatureError);
    expect(() => consent.signDigitally('   ')).toThrow(InvalidConsentSignatureError);
  });

  it('firma digital válida deja firmado con fecha y tipo digital', () => {
    const consent = issued();
    consent.signDigitally('  Ana   López  ');
    const primitives = consent.toPrimitives();
    expect(primitives.status).toBe('firmado');
    expect(primitives.signedName).toBe('Ana López');
    expect(primitives.signatureKind).toBe('digital');
    expect(primitives.signedAt).not.toBeNull();
  });

  it('firmar dos veces es idempotente (no pisa la primera firma)', () => {
    const consent = issued();
    consent.signDigitally('Ana López');
    const first = consent.toPrimitives().signedAt;
    consent.signDigitally('Otra Persona');
    expect(consent.toPrimitives().signedName).toBe('Ana López');
    expect(consent.toPrimitives().signedAt).toBe(first);
  });

  it('una liga revocada no puede firmarse ni reenviarse', () => {
    const consent = issued();
    consent.revoke();
    expect(consent.toPrimitives().status).toBe('revocado');
    expect(() => consent.signDigitally('Ana López')).toThrow(ConsentLinkRevokedError);
    expect(() => consent.markResent()).toThrow(ConsentLinkRevokedError);
  });

  it('adjuntar papel deja papel_adjunto con archivo y fecha', () => {
    const consent = issued();
    consent.attachPaper('pac-1/consentimiento-firmado.webp');
    const primitives = consent.toPrimitives();
    expect(primitives.status).toBe('papel_adjunto');
    expect(primitives.signatureKind).toBe('papel');
    expect(primitives.filePath).toBe('pac-1/consentimiento-firmado.webp');
    expect(primitives.signedAt).not.toBeNull();
  });

  it('sobre una firma digital no se adjunta papel ni se reenvía, pero SÍ se revoca (Ley 1581)', () => {
    const consent = issued();
    consent.signDigitally('Ana López');
    expect(() => consent.attachPaper('pac-1/foto.webp')).toThrow(ConsentAlreadySignedError);
    expect(() => consent.markResent()).toThrow(ConsentAlreadySignedError);
    // Revocar un consentimiento YA otorgado es un derecho del titular: se registra con fecha
    // y conserva el rastro de la firma previa (no la borra).
    consent.revoke();
    const primitives = consent.toPrimitives();
    expect(primitives.status).toBe('revocado');
    expect(primitives.revokedAt).not.toBeNull();
    expect(primitives.signedName).toBe('Ana López');
    expect(primitives.signedAt).not.toBeNull();
  });

  it('revocar una liga pendiente sella la fecha de revocación', () => {
    const consent = issued();
    consent.revoke();
    expect(consent.toPrimitives().revokedAt).not.toBeNull();
  });

  it('sobre una liga PENDIENTE revocada (nunca firmada) sí se adjunta papel y limpia revoked_at', () => {
    const consent = issued();
    consent.revoke();
    consent.attachPaper('pac-1/escaneo.pdf');
    const primitives = consent.toPrimitives();
    expect(primitives.status).toBe('papel_adjunto');
    // No debe quedar el estado contradictorio otorgado + revoked_at.
    expect(primitives.revokedAt).toBeNull();
  });

  it('un consentimiento OTORGADO y luego REVOCADO no se resucita adjuntando papel (Ley 1581)', () => {
    const consent = issued();
    consent.signDigitally('Ana López');
    consent.revoke(); // el titular retira su autorización
    expect(() => consent.attachPaper('pac-1/escaneo.pdf')).toThrow(ConsentLinkRevokedError);
    // sigue revocado, sin resucitar
    expect(consent.toPrimitives().status).toBe('revocado');
  });
});
