import { describe, expect, it } from 'vitest';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';

describe('ClinicalRecord', () => {
  function startRecord(): ClinicalRecord {
    return ClinicalRecord.start({
      id: 'rec-1',
      patientId: 'pac-1',
      templateId: 'tpl-1',
      title: 'Historia de prueba',
    });
  }

  it('inicia sin respuestas', () => {
    const record = startRecord();
    expect(record.toPrimitives().answers).toEqual({});
  });

  it('answerField guarda texto y listas', () => {
    const record = startRecord();
    record.answerField('motivo', 'Ansiedad generalizada');
    record.answerField('sustancias', ['Alcohol', 'Tabaco']);
    const answers = record.toPrimitives().answers;
    expect(answers['motivo']).toBe('Ansiedad generalizada');
    expect(answers['sustancias']).toEqual(['Alcohol', 'Tabaco']);
  });

  it('answerField elimina la respuesta cuando el valor queda vacío', () => {
    const record = startRecord();
    record.answerField('motivo', 'Algo');
    record.answerField('motivo', '   ');
    record.answerField('sustancias', ['Alcohol']);
    record.answerField('sustancias', []);
    const answers = record.toPrimitives().answers;
    expect(answers['motivo']).toBeUndefined();
    expect(answers['sustancias']).toBeUndefined();
  });

  it('answerMany aplica varias respuestas y conserva las previas no tocadas', () => {
    const record = startRecord();
    record.answerField('previa', 'se conserva');
    record.answerMany({ motivo: 'Duelo', escala: '7' });
    const answers = record.toPrimitives().answers;
    expect(answers['previa']).toBe('se conserva');
    expect(answers['motivo']).toBe('Duelo');
    expect(answers['escala']).toBe('7');
  });

  it('belongsTo valida el paciente dueño', () => {
    const record = startRecord();
    expect(record.belongsTo('pac-1')).toBe(true);
    expect(record.belongsTo('otro')).toBe(false);
  });
});
