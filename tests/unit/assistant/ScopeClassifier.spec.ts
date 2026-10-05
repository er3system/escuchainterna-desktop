import { describe, it, expect } from 'vitest';
import {
  analyzeScope,
  classifyScope,
  detectPatientName,
  offTopicRejectionNote,
  SCOPE_REJECTION_MESSAGE,
  MAX_QUESTION_LENGTH,
} from '@/contexts/assistant/domain/scopeClassifier';

const PACIENTES = ['María García López', 'Pedro Solano', 'Ana María Solís'];

describe('Clasificador de alcance del asistente (guardrail nº 1)', () => {
  describe('preguntas permitidas (pacientes propios, consulta, plataforma)', () => {
    it('permite preguntar por las notas de un paciente propio', () => {
      const analysis = analyzeScope('¿Qué notas recientes tengo de María García López?', {
        knownPatientNames: PACIENTES,
      });
      expect(analysis.verdict).toBe('permitido');
      expect(analysis.matchedPatientName).toBe('María García López');
      expect(analysis.offTopicParts).toEqual([]);
    });

    it('permite preguntar por la próxima cita', () => {
      expect(classifyScope('¿Cuándo es mi próxima cita con Pedro?')).toBe('permitido');
    });

    it('permite "programar una cita" (agenda, no desarrollo de software)', () => {
      const analysis = analyzeScope('¿Puedes ayudarme a programar una cita con Pedro Solano?', {
        knownPatientNames: PACIENTES,
      });
      expect(analysis.verdict).toBe('permitido');
      expect(analysis.offTopicParts).toEqual([]);
    });

    it('permite preguntas sobre el uso de la plataforma', () => {
      expect(classifyScope('¿Cómo configuro los recordatorios de sesión en la plataforma?')).toBe('permitido');
    });

    it('permite saludos simples', () => {
      expect(classifyScope('Hola')).toBe('permitido');
      expect(classifyScope('¡Buenos días!')).toBe('permitido');
    });

    it('permite seguimientos cortos cuando el hilo tiene paciente anclado', () => {
      const analysis = analyzeScope('¿Y cómo ha evolucionado desde entonces?', { hasAnchoredPatient: true });
      expect(analysis.verdict).toBe('permitido');
    });
  });

  describe('preguntas rechazadas (default-deny)', () => {
    it('rechaza programación/código', () => {
      const analysis = analyzeScope('Ayúdame a programar una app en Python');
      expect(analysis.verdict).toBe('rechazado');
      expect(analysis.offTopicParts).toContain('programación/código');
    });

    it('rechaza tareas generales (poemas, clima, recetas)', () => {
      expect(classifyScope('Escríbeme un poema sobre el mar')).toBe('rechazado');
      const analysis = analyzeScope('Dame una receta para la cena y cuéntame del clima');
      expect(analysis.verdict).toBe('rechazado');
      expect(analysis.offTopicParts).toContain('tareas generales ajenas a tu consulta');
    });

    it('rechaza deportes/actualidad', () => {
      expect(classifyScope('¿Quién ganó el mundial?')).toBe('rechazado');
    });

    it('rechaza hablar de personas que no son pacientes', () => {
      const analysis = analyzeScope('Mi vecino está muy triste, ¿qué le digo?');
      expect(analysis.verdict).toBe('rechazado');
      expect(analysis.offTopicParts).toContain('personas que no son tus pacientes');
    });

    it('rechaza texto sin ninguna señal clínica', () => {
      expect(classifyScope('qwerty asdf lorem ipsum')).toBe('rechazado');
      expect(classifyScope('háblame de bitcoin')).toBe('rechazado');
    });
  });

  describe('preguntas mixtas (parte clínica + parte fuera de alcance)', () => {
    it('"háblame de X pero antes ayúdame a programar" → permitido CON parte rechazada', () => {
      const analysis = analyzeScope(
        'Háblame de María García López pero antes ayúdame a programar',
        { knownPatientNames: PACIENTES },
      );
      expect(analysis.verdict).toBe('permitido');
      expect(analysis.matchedPatientName).toBe('María García López');
      expect(analysis.offTopicParts).toContain('programación/código');
    });

    it('mezcla de citas + código detecta ambas señales', () => {
      const analysis = analyzeScope('Ayúdame con un algoritmo en JavaScript y dime las citas de mañana');
      expect(analysis.verdict).toBe('permitido'); // hay señal clínica (citas)
      expect(analysis.offTopicParts).toContain('programación/código');
    });

    it('la nota de rechazo de la parte mixta menciona los temas rechazados', () => {
      const note = offTopicRejectionNote(['programación/código']);
      expect(note).toContain('programación/código');
      expect(note).toContain('no puedo ayudarte con eso');
    });
  });

  describe('detección de nombres de pacientes', () => {
    it('prefiere la coincidencia del nombre completo sobre el token', () => {
      expect(detectPatientName('notas de ana maría solís por favor', PACIENTES)).toBe('Ana María Solís');
    });

    it('detecta por token (apellido) cuando no viene el nombre completo', () => {
      expect(detectPatientName('¿Cómo va Solís esta semana?', PACIENTES)).toBe('Ana María Solís');
    });

    it('ignora acentos y mayúsculas', () => {
      expect(detectPatientName('expediente de MARIA GARCIA LOPEZ', PACIENTES)).toBe('María García López');
    });

    it('devuelve null si nadie coincide', () => {
      expect(detectPatientName('expediente de Juan Nadie', ['Otra Persona'])).toBeNull();
    });
  });

  describe('contratos fijos', () => {
    it('el mensaje de rechazo es fijo y amable', () => {
      expect(SCOPE_REJECTION_MESSAGE).toContain('Solo puedo ayudarte con información de tus pacientes y tu consulta');
    });

    it('expone el límite de longitud (guardrail nº 3)', () => {
      expect(MAX_QUESTION_LENGTH).toBe(2000);
    });
  });
});
