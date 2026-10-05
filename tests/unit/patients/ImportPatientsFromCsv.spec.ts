import { describe, expect, it } from 'vitest';
import { ImportPatientsFromCsv } from '@/contexts/patients/application/import-patients-from-csv/ImportPatientsFromCsv';
import { ExportPatientsCsv } from '@/contexts/patients/application/export-patients-csv/ExportPatientsCsv';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { InMemoryPatientRepository } from './InMemoryPatientRepository';

const criteria = (input: ConstructorParameters<typeof SearchPatientsQuery>[0]) =>
  new SearchPatientsQuery(input).toCriteria();

describe('ImportPatientsFromCsv', () => {
  it('importa filas válidas con encabezados flexibles (mayúsculas y acentos)', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = [
      'Nombre,Correo Electrónico,Teléfono,Fecha_Nacimiento,Contacto_Emergencia,Teléfono_Emergencia,Notas',
      'Ana López,ana@ejemplo.com,5512345678,1992-04-15,María García,5587654321,Tarde',
      'Juan Pérez,juan@ejemplo.com,5523456789,,,,',
    ].join('\n');

    const result = await new ImportPatientsFromCsv(repository).importFromContent(csv);

    expect(result.importados).toBe(2);
    expect(result.errores).toEqual([]);
    expect(result.advertencias).toEqual([]);
    const all = await repository.search(criteria({ archived: 'todos' }));
    expect(all).toHaveLength(2);
    const ana = (await repository.search(criteria({ text: 'ana' })))[0].toPrimitives();
    expect(ana.birthDate).toBe('1992-04-15');
    expect(ana.emergencyContactName).toBe('María García');
  });

  it('reporta error de fecha con el mensaje del original y respeta el número de fila', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = ['nombre,fecha_nacimiento', 'Ana López,1992-04-15', 'Juan Pérez,15/04/1992'].join('\n');

    const result = await new ImportPatientsFromCsv(repository).importFromContent(csv);

    expect(result.importados).toBe(1);
    expect(result.errores).toHaveLength(1);
    expect(result.errores[0].fila).toBe(3);
    expect(result.errores[0].motivo).toContain('formato de fecha inválido: usa AAAA-MM-DD');
  });

  it('reporta error cuando falta el nombre y cuando el correo es inválido', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = ['nombre,correo', ',ana@ejemplo.com', 'Juan Pérez,no-es-correo'].join('\n');

    const result = await new ImportPatientsFromCsv(repository).importFromContent(csv);

    expect(result.importados).toBe(0);
    expect(result.errores).toHaveLength(2);
    expect(result.errores[0].motivo).toContain('falta el nombre');
    expect(result.errores[1].motivo).toContain('correo electrónico inválido');
  });

  it('solo advierte los teléfonos inválidos (la fila sí se importa)', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = ['nombre,telefono', 'Ana López,123', 'Juan Pérez,5523456789'].join('\n');

    const result = await new ImportPatientsFromCsv(repository).importFromContent(csv);

    expect(result.importados).toBe(2);
    expect(result.errores).toEqual([]);
    expect(result.advertencias).toHaveLength(1);
    expect(result.advertencias[0].fila).toBe(2);
    expect(result.advertencias[0].motivo).toContain('WhatsApp');
  });

  it('falla con mensaje claro si no existe la columna nombre', async () => {
    const repository = new InMemoryPatientRepository();
    const result = await new ImportPatientsFromCsv(repository).importFromContent('correo\nana@ejemplo.com');

    expect(result.importados).toBe(0);
    expect(result.errores[0].motivo).toContain('columna «nombre»');
  });

  it('acepta archivos con BOM (exportados por Excel)', async () => {
    const repository = new InMemoryPatientRepository();
    const csv = '\uFEFFnombre\nAna López';
    const result = await new ImportPatientsFromCsv(repository).importFromContent(csv);
    expect(result.importados).toBe(1);
  });
});

describe('ExportPatientsCsv', () => {
  it('exporta UTF-8 con BOM y columnas compatibles con la importación', async () => {
    const repository = new InMemoryPatientRepository();
    await new ImportPatientsFromCsv(repository).importFromContent(
      ['nombre,correo,telefono,fecha_nacimiento', 'Ana López,ana@ejemplo.com,5512345678,1992-04-15'].join('\n'),
    );

    const csv = await new ExportPatientsCsv(repository).exportAll();

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('nombre,correo,telefono,fecha_nacimiento');
    expect(csv).toContain('Ana López');

    // Ida y vuelta: lo exportado se puede volver a importar.
    const reimport = await new ImportPatientsFromCsv(new InMemoryPatientRepository()).importFromContent(csv);
    expect(reimport.importados).toBe(1);
    expect(reimport.errores).toEqual([]);
  });
});
