import { describe, it, expect } from 'vitest';
import {
  accessPolicyRank,
  coverageAllowed,
  effectiveAccessPolicy,
  isAccessPolicy,
  sameConsultorio,
  toAccessPolicy,
} from '@/contexts/identity/domain/value-objects/accessPolicy';

describe('política de acceso (cuentas institucionales §2)', () => {
  it('valida y normaliza el preset', () => {
    expect(isAccessPolicy('estricto')).toBe(true);
    expect(isAccessPolicy('cobertura')).toBe(true);
    expect(isAccessPolicy('total')).toBe(false);
    expect(toAccessPolicy('intermedio')).toBe('intermedio');
    expect(toAccessPolicy('inventado')).toBe('estricto'); // por defecto, el más restrictivo
  });

  it('ordena la visibilidad estricto < intermedio < cobertura', () => {
    expect(accessPolicyRank('estricto')).toBeLessThan(accessPolicyRank('intermedio'));
    expect(accessPolicyRank('intermedio')).toBeLessThan(accessPolicyRank('cobertura'));
  });

  it('sin permiso de ampliar, manda la base de la institución', () => {
    expect(
      effectiveAccessPolicy({ orgPolicy: 'estricto', professorCanWiden: false, professorOverride: 'cobertura' }),
    ).toBe('estricto');
  });

  it('con permiso, el profesor puede AMPLIAR (subir) pero nunca bajar de la base', () => {
    // Amplía de estricto a cobertura.
    expect(
      effectiveAccessPolicy({ orgPolicy: 'estricto', professorCanWiden: true, professorOverride: 'cobertura' }),
    ).toBe('cobertura');
    // Intento de RESTRINGIR por debajo de la base: se ignora, manda la base.
    expect(
      effectiveAccessPolicy({ orgPolicy: 'intermedio', professorCanWiden: true, professorOverride: 'estricto' }),
    ).toBe('intermedio');
    // Sin override del profesor: la base.
    expect(
      effectiveAccessPolicy({ orgPolicy: 'intermedio', professorCanWiden: true, professorOverride: null }),
    ).toBe('intermedio');
  });
});

describe('coverageAllowed — núcleo de seguridad de la cobertura (§2.3)', () => {
  const base = { sameOrganization: true, sameConsultorio: true, actorSupervisesTratante: false };

  it('distinta organización: NUNCA (no se cruza entre instituciones)', () => {
    expect(
      coverageAllowed({
        effectivePolicy: 'cobertura',
        sameOrganization: false,
        sameConsultorio: true,
        actorSupervisesTratante: true,
      }),
    ).toBe(false);
  });

  it('estricto: nunca, ni siquiera al supervisor', () => {
    expect(coverageAllowed({ ...base, effectivePolicy: 'estricto' })).toBe(false);
    expect(coverageAllowed({ ...base, effectivePolicy: 'estricto', actorSupervisesTratante: true })).toBe(false);
  });

  it('intermedio: solo si el actor supervisa al tratante', () => {
    expect(coverageAllowed({ ...base, effectivePolicy: 'intermedio' })).toBe(false);
    expect(
      coverageAllowed({ ...base, effectivePolicy: 'intermedio', actorSupervisesTratante: true }),
    ).toBe(true);
  });

  it('cobertura: cualquier miembro de la misma organización', () => {
    expect(coverageAllowed({ ...base, effectivePolicy: 'cobertura' })).toBe(true);
  });

  it('fail-closed ante un valor de política inesperado', () => {
    expect(
      coverageAllowed({
        effectivePolicy: 'desconocido' as never,
        sameOrganization: true,
        sameConsultorio: true,
        actorSupervisesTratante: true,
      }),
    ).toBe(false);
  });

  it('distinto consultorio de la misma org: NUNCA, ni con política cobertura', () => {
    expect(coverageAllowed({ ...base, effectivePolicy: 'cobertura', sameConsultorio: false })).toBe(false);
    // ni aunque supervise al tratante (intermedio): el consultorio manda
    expect(
      coverageAllowed({
        ...base,
        effectivePolicy: 'intermedio',
        sameConsultorio: false,
        actorSupervisesTratante: true,
      }),
    ).toBe(false);
  });
});

describe('sameConsultorio — aislamiento intra-org (consultorios §3)', () => {
  it('mismo consultorio: pasa', () => {
    expect(sameConsultorio('c1', 'c1')).toBe(true);
  });
  it('distinto consultorio: NO pasa', () => {
    expect(sameConsultorio('c1', 'c2')).toBe(false);
  });
  it('alguno sin consultorio (master / org plana): pasa (no se le aísla)', () => {
    expect(sameConsultorio(null, 'c2')).toBe(true);
    expect(sameConsultorio('c1', null)).toBe(true);
    expect(sameConsultorio(null, null)).toBe(true);
  });
});
