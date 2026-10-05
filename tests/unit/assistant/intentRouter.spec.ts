import { describe, it, expect } from 'vitest';
import {
  routeIntent,
  resolveRoutedModel,
  type ModelCandidates,
} from '@/contexts/assistant/domain/intentRouter';

/**
 * El router por intención es un guardrail de SEGURIDAD además de una palanca de
 * costo. El invariante inviolable: una pregunta de riesgo/crisis NUNCA se rutea
 * al modelo económico. La degradación a económico solo ocurre en consultas
 * inequívocamente logísticas, y jamás cuando hay señal clínica o de riesgo.
 */
describe('routeIntent — invariante de seguridad (riesgo → premium SIEMPRE)', () => {
  const RIESGO = [
    '¿Cómo manejo la ideación suicida de María?',
    'Mi paciente habló de suicidarse en la última sesión',
    'Andrés tiene pensamientos de autolesión, ¿qué hago?',
    'La paciente se está cortando, ¿cómo lo abordo?',
    'Dijo que quiere quitarse la vida',
    'Está en crisis ahora mismo',
    'Creo que es una emergencia, ¿debo derivar a urgencias?',
    '¿Hay que hospitalizar a este paciente?',
    'Reportó un intento de suicidio la semana pasada',
    'Hay riesgo de que se haga daño',
    'Tuvo una recaída grave de consumo',
    'Sufrió abuso sexual en la infancia',
    'Hay violencia intrafamiliar en el hogar',
    'Tuvo un brote psicótico',
    'Tomó una sobredosis de sus medicamentos',
    'Expresó desesperanza total, "no puedo más"',
  ];

  it('rutea CADA pregunta de riesgo a premium, CON contexto', () => {
    for (const q of RIESGO) {
      expect(routeIntent(q, true)).toEqual({ intent: 'riesgo', tier: 'premium' });
    }
  });

  it('rutea CADA pregunta de riesgo a premium también SIN contexto recuperado', () => {
    // El riesgo se evalúa antes del branch de contexto: una pregunta de
    // seguridad merece el modelo fuerte aunque no se haya anclado un paciente.
    for (const q of RIESGO) {
      expect(routeIntent(q, false).tier).toBe('premium');
    }
  });

  it('riesgo gana aunque la pregunta también parezca logística', () => {
    // "próxima cita" es un patrón trivial, pero el riesgo prevalece.
    expect(routeIntent('¿Cuándo es la próxima cita? Está con ideación suicida', true)).toEqual({
      intent: 'riesgo',
      tier: 'premium',
    });
  });
});

describe('routeIntent — con contexto clínico', () => {
  it('razonamiento clínico → premium (default conservador)', () => {
    const CLINICO = [
      '¿Cómo ha evolucionado la ansiedad de María?',
      '¿Qué hipótesis diagnóstica sugieren sus notas?',
      'Ayúdame a interpretar el patrón de sus últimas sesiones',
      '¿Qué línea de tratamiento recomendarías explorar?',
      'Resume el progreso terapéutico del caso',
      '¿Cómo abordo el duelo que está atravesando?',
    ];
    for (const q of CLINICO) {
      expect(routeIntent(q, true)).toEqual({ intent: 'clinico', tier: 'premium' });
    }
  });

  it('consulta logística pura → económico', () => {
    const TRIVIAL = [
      '¿Cuándo es la próxima cita de María?',
      '¿A qué hora tiene cita Andrés mañana?',
      '¿Cuál es el teléfono de contacto del paciente?',
      '¿Cuánto me debe Juan?',
      '¿Está al día con los pagos?',
      '¿Qué etiquetas tiene este paciente?',
      '¿Cuándo es el cumpleaños de María?',
      '¿Qué edad tiene el paciente?',
    ];
    for (const q of TRIVIAL) {
      expect(routeIntent(q, true)).toEqual({ intent: 'trivial', tier: 'economico' });
    }
  });

  it('logística + contenido clínico → premium (no se degrada)', () => {
    // Cualquier señal clínica bloquea la degradación, aunque haya patrón trivial.
    expect(routeIntent('¿Cuándo es la próxima cita para revisar su diagnóstico?', true).tier).toBe('premium');
    expect(routeIntent('¿A qué hora es la sesión donde trabajamos la ansiedad?', true).tier).toBe('premium');
  });
});

describe('routeIntent — sin contexto clínico (plataforma)', () => {
  it('ayuda de plataforma/práctica no clínica → económico', () => {
    // El tier es lo que importa (económico); la etiqueta de intent puede ser
    // 'trivial' (si casa un patrón logístico como "cómo configurar") o
    // 'plataforma'. Ambas son ahorro legítimo.
    const PLATAFORMA = [
      '¿Cómo configuro los recordatorios automáticos?',
      '¿Dónde encuentro la biblioteca?',
      '¿Cómo exporto mis pagos del mes?',
      '¿Cómo agendar una cita nueva?',
      '¿Qué incluye mi suscripción?',
    ];
    for (const q of PLATAFORMA) {
      expect(routeIntent(q, false).tier).toBe('economico');
    }
  });

  it('una pregunta clínica SIN contexto recuperado va a PREMIUM (default seguro)', () => {
    // Cambio de política tras el red-team: sin un patrón inequívocamente trivial
    // ni de plataforma, el default es premium aunque no se haya recuperado un
    // paciente — así no se abarata por accidente un riesgo expresado de forma
    // eufemística (que no se recuperó contexto no significa que sea barato).
    expect(routeIntent('¿Qué notas tengo de un paciente cualquiera?', false).tier).toBe('premium');
  });
});

describe('routeIntent — guard de longitud en la degradación (clase compuesta)', () => {
  it('mensaje LARGO con patrón logístico pero riesgo eufemístico NO lexicalizado → premium', () => {
    // El red-team mostró que el riesgo eufemístico evade cualquier léxico; si además
    // trae un patrón trivial ("a qué hora…"), la degradación lo mandaría al modelo
    // débil. El guard de longitud lo impide: una consulta logística real es corta.
    const COMPUESTAS = [
      '¿A qué hora es la cita de mañana con Andrés? Ayer me dijo que estaría mejor si una noche no volviera a despertar y no sé cómo tomarlo',
      '¿Cuándo es la próxima cita de María? Su hermana me contó que anda demasiado en paz, como si por fin hubiera resuelto algo después de meses',
      '¿Qué edad tiene el paciente nuevo? Lo pregunto porque en la llamada dijo que ya dejó todo en orden, los papeles y una carta para los niños',
    ];
    for (const q of COMPUESTAS) {
      expect(routeIntent(q, true).tier).toBe('premium');
    }
  });

  it('la consulta logística corta sigue degradando a económico (el ahorro se conserva)', () => {
    expect(routeIntent('¿Cuándo es la próxima cita de María?', true).tier).toBe('economico');
    expect(routeIntent('¿Cuánto me debe Juan?', true).tier).toBe('economico');
  });
});

describe('resolveRoutedModel — acotado por el techo del plan (salvo riesgo)', () => {
  const PREMIUM = 'claude-sonnet-5';
  const ECONOMICO = 'claude-haiku-4-5';
  const conHeadroom: ModelCandidates = { premium: PREMIUM, economico: ECONOMICO, riesgo: PREMIUM };
  // Plan con techo económico (Esencial, o Profesional sobre el umbral suave):
  // premium/economico se acotan al techo, pero el candidato de RIESGO sigue
  // siendo el premium real (lo arma así la fábrica).
  const techoEconomico: ModelCandidates = { premium: ECONOMICO, economico: ECONOMICO, riesgo: PREMIUM };

  it('con headroom premium: cada nivel resuelve su modelo', () => {
    expect(resolveRoutedModel({ intent: 'riesgo', tier: 'premium' }, conHeadroom)).toBe(PREMIUM);
    expect(resolveRoutedModel({ intent: 'clinico', tier: 'premium' }, conHeadroom)).toBe(PREMIUM);
    expect(resolveRoutedModel({ intent: 'trivial', tier: 'economico' }, conHeadroom)).toBe(ECONOMICO);
    expect(resolveRoutedModel({ intent: 'plataforma', tier: 'economico' }, conHeadroom)).toBe(ECONOMICO);
  });

  it('techo del plan económico: lo clínico respeta el techo (no regala premium)', () => {
    expect(resolveRoutedModel({ intent: 'clinico', tier: 'premium' }, techoEconomico)).toBe(ECONOMICO);
    expect(resolveRoutedModel({ intent: 'trivial', tier: 'economico' }, techoEconomico)).toBe(ECONOMICO);
  });

  it('RIESGO perfora el techo: nunca se sirve una crisis con el modelo débil', () => {
    // Mismo precedente que PREMIUM_ALWAYS_KINDS: consume presupuesto del plan y
    // el tope duro agotado sigue bloqueando todo; solo decide el modelo mientras
    // quede presupuesto. Invariante clínico-legal 5 > techo del plan.
    expect(resolveRoutedModel({ intent: 'riesgo', tier: 'premium' }, techoEconomico)).toBe(PREMIUM);
  });
});
