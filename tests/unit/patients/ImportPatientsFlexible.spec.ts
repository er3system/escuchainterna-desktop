import { describe, expect, it } from 'vitest';
import { analyzeCsv } from '@/contexts/patients/application/import-patients-flexible/analyzeCsv';
import { decodeCsvBytes } from '@/contexts/patients/application/import-patients-flexible/decodeCsvBytes';
import {
  suggestTargetForHeader,
  type ImportColumnMapping,
} from '@/contexts/patients/application/import-patients-flexible/importFields';
import {
  ImportPatientsWithMapping,
  normalizeDateValue,
  normalizeDialCode,
} from '@/contexts/patients/application/import-patients-flexible/ImportPatientsWithMapping';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { InMemoryPatientRepository } from './InMemoryPatientRepository';

const criteria = (input: ConstructorParameters<typeof SearchPatientsQuery>[0]) =>
  new SearchPatientsQuery(input).toCriteria();

function mapping(...columns: Array<[number, string, ImportColumnMapping['target']]>): ImportColumnMapping[] {
  return columns.map(([index, header, target]) => ({ index, header, target }));
}

describe('suggestTargetForHeader (auto-sugerencia por similitud)', () => {
  it('reconoce encabezados con acentos, mayúsculas y variantes', () => {
    expect(suggestTargetForHeader('Nombre Completo')).toBe('nombre');
    expect(suggestTargetForHeader('NOMBRES Y APELLIDOS')).toBe('nombre');
    expect(suggestTargetForHeader('Correo Electrónico')).toBe('correo');
    expect(suggestTargetForHeader('E-mail')).toBe('correo');
    expect(suggestTargetForHeader('Teléfono')).toBe('telefono');
    expect(suggestTargetForHeader('CELULAR')).toBe('telefono');
    expect(suggestTargetForHeader('Lada')).toBe('lada');
    expect(suggestTargetForHeader('Fecha de Nacimiento')).toBe('fecha_nacimiento');
    expect(suggestTargetForHeader('Género')).toBe('genero');
    expect(suggestTargetForHeader('Contacto de emergencia')).toBe('contacto_emergencia');
    expect(suggestTargetForHeader('Tel. emergencia')).toBe('telefono_emergencia');
    expect(suggestTargetForHeader('Observaciones')).toBe('notas');
  });

  it('tolera typos pequeños (similitud)', () => {
    expect(suggestTargetForHeader('telefno')).toBe('telefono');
    expect(suggestTargetForHeader('coreo')).toBe('correo');
  });

  it('sugiere etiqueta para columnas institucionales desconocidas', () => {
    expect(suggestTargetForHeader('Programa')).toBe('etiqueta');
    expect(suggestTargetForHeader('Semestre')).toBe('etiqueta');
    expect(suggestTargetForHeader('Código estudiantil')).toBe('etiqueta');
  });
});

describe('decodeCsvBytes (UTF-8 / latin1)', () => {
  it('decodifica UTF-8 con BOM quitando el BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('nombre\nJosé')]);
    expect(decodeCsvBytes(bytes)).toBe('nombre\nJosé');
  });

  it('cae a latin1 cuando los bytes no son UTF-8 válido', () => {
    // «José» en latin1: la é es 0xE9 (inválida como UTF-8 aislada).
    const bytes = new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]);
    expect(decodeCsvBytes(bytes)).toBe('José');
  });
});

describe('analyzeCsv (detección de encabezados y vista previa)', () => {
  it('detecta separador punto y coma, sugiere destinos y limita la vista previa a 5 filas', () => {
    const rows = ['Nombre;Correo;Programa'];
    for (let i = 1; i <= 8; i += 1) rows.push(`Paciente ${i};p${i}@ejemplo.com;Psicología`);

    const analysis = analyzeCsv(rows.join('\n'));

    expect(analysis.ok).toBe(true);
    expect(analysis.delimiter).toBe(';');
    expect(analysis.totalRows).toBe(8);
    expect(analysis.previewRows).toHaveLength(5);
    expect(analysis.columns.map((column) => column.suggestion)).toEqual(['nombre', 'correo', 'etiqueta']);
    expect(analysis.columns[0].samples[0]).toBe('Paciente 1');
  });

  it('rechaza archivos vacíos o sin filas de datos con mensajes claros', () => {
    expect(analyzeCsv('').ok).toBe(false);
    const onlyHeaders = analyzeCsv('nombre,correo');
    expect(onlyHeaders.ok).toBe(false);
    expect(onlyHeaders.error).toContain('filas de datos');
  });
});

describe('normalizadores', () => {
  it('acepta fechas DD/MM/AAAA y AAAA-MM-DD', () => {
    expect(normalizeDateValue('15/04/1992')).toBe('1992-04-15');
    expect(normalizeDateValue('5-1-2001')).toBe('2001-01-05');
    expect(normalizeDateValue('1992-04-15')).toBe('1992-04-15');
    expect(normalizeDateValue('')).toBe('');
  });

  it('normaliza la lada a formato +NN', () => {
    expect(normalizeDialCode('57')).toBe('+57');
    expect(normalizeDialCode('+52')).toBe('+52');
    expect(normalizeDialCode('0057')).toBe('+57');
    expect(normalizeDialCode('')).toBe('');
  });
});

describe('ImportPatientsWithMapping (importación con mapeo)', () => {
  it('importa con mapeo y crea etiquetas institucionales «Columna: valor»', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = [
      'Alumno;Mail;Cel;Programa;Semestre;Código',
      'Ana López;ana@uni.edu;3001234567;Psicología;6;2021-1234',
      'Juan Pérez;juan@uni.edu;3012345678;Medicina;2;2022-5678',
    ].join('\n');

    const result = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping(
        [0, 'Alumno', 'nombre'],
        [1, 'Mail', 'correo'],
        [2, 'Cel', 'telefono'],
        [3, 'Programa', 'etiqueta'],
        [4, 'Semestre', 'etiqueta'],
        [5, 'Código', 'etiqueta'],
      ),
    );

    expect(result.errores).toEqual([]);
    expect(result.importados).toBe(2);
    const ana = (await repository.search(criteria({ text: 'ana' })))[0].toPrimitives();
    expect(ana.tags).toEqual(['Programa: Psicología', 'Semestre: 6', 'Código: 2021-1234']);
  });

  it('aplica la lada y normaliza fechas DD/MM/AAAA', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = ['nombre,lada,telefono,nacido', 'Ana López,57,3001234567,15/04/1999'].join('\n');

    const result = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping([0, 'nombre', 'nombre'], [1, 'lada', 'lada'], [2, 'telefono', 'telefono'], [3, 'nacido', 'fecha_nacimiento']),
    );

    expect(result.errores).toEqual([]);
    const ana = (await repository.search(criteria({ text: 'ana' })))[0].toPrimitives();
    expect(ana.phoneCountryCode).toBe('+57');
    expect(ana.birthDate).toBe('1999-04-15');
  });

  it('reporta errores por fila sin detener el resto', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = [
      'nombre,correo',
      ',ana@ejemplo.com', // sin nombre
      'Juan Pérez,no-es-correo', // correo inválido
      'María Ruiz,maria@ejemplo.com', // válida
    ].join('\n');

    const result = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping([0, 'nombre', 'nombre'], [1, 'correo', 'correo']),
    );

    expect(result.importados).toBe(1);
    expect(result.errores).toHaveLength(2);
    expect(result.errores[0].fila).toBe(2);
    expect(result.errores[1].fila).toBe(3);
    expect(result.errores[1].motivo).toContain('correo');
  });

  it('advierte teléfonos inválidos pero importa la fila', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = ['nombre,telefono', 'Ana López,123'].join('\n');

    const result = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping([0, 'nombre', 'nombre'], [1, 'telefono', 'telefono']),
    );

    expect(result.importados).toBe(1);
    expect(result.advertencias).toHaveLength(1);
    expect(result.advertencias[0].motivo).toContain('WhatsApp');
  });

  it('rechaza mapeos sin nombre o con campos duplicados', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = ['a,b', 'x,y'].join('\n');

    const sinNombre = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping([0, 'a', 'correo'], [1, 'b', 'etiqueta']),
    );
    expect(sinNombre.importados).toBe(0);
    expect(sinNombre.errores[0].motivo).toContain('Nombre completo');

    const duplicado = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping([0, 'a', 'nombre'], [1, 'b', 'nombre']),
    );
    expect(duplicado.importados).toBe(0);
    expect(duplicado.errores[0].motivo).toContain('una sola');
  });

  it('ignora columnas marcadas como «ignorar» y soporta BOM', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = `${String.fromCharCode(0xfeff)}nombre,interno\nAna López,xyz`;

    const result = await new ImportPatientsWithMapping(repository).import(
      csv,
      mapping([0, 'nombre', 'nombre'], [1, 'interno', 'ignorar']),
    );

    expect(result.importados).toBe(1);
    const ana = (await repository.search(criteria({ text: 'ana' })))[0].toPrimitives();
    expect(ana.tags).toEqual([]);
  });
});
