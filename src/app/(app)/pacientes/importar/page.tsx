import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { ImportWizard } from './ImportWizard';

const TEMPLATE_ROWS = [
  'nombre,correo,telefono,lada,fecha_nacimiento,genero,contacto_emergencia,telefono_emergencia,notas,Programa,Semestre',
  'Ana López García,ana.lopez@ejemplo.com,3001234567,+57,1999-04-15,femenino,María García,3007654321,Prefiere tardes,Psicología,6',
  'Juan Pérez Ruiz,juan.perez@ejemplo.com,3012345678,+57,2001-11-02,masculino,Lucía Ruiz,3019876543,,Medicina,2',
];

export default function ImportarPacientesPage() {
  // BOM inicial para que Excel abra la plantilla como UTF-8.
  const templateCsv = String.fromCharCode(0xfeff) + TEMPLATE_ROWS.join('\r\n') + '\r\n';
  const templateHref = `data:text/csv;charset=utf-8;base64,${Buffer.from(templateCsv, 'utf8').toString('base64')}`;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/pacientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
      >
        <ArrowLeft size={16} />
        Volver a pacientes
      </Link>
      <PageHeader
        title="Importar pacientes"
        subtitle="Sube cualquier CSV (también el exportado desde Excel): tú decides qué columna alimenta cada campo y cuáles se guardan como etiquetas."
      />

      <ImportWizard />

      <Card className="mt-6">
        <h2 className="mb-1 text-base font-bold text-ink">¿Cómo funciona?</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>
            Sube tu archivo CSV. Aceptamos encabezados con mayúsculas o acentos, separador con coma
            o punto y coma, y codificación UTF-8 o latin1.
          </li>
          <li>
            Revisa el mapeo sugerido: por cada columna eliges el campo destino (nombre, correo,
            teléfono, lada, fecha de nacimiento, género, contacto de emergencia, notas…).
          </li>
          <li>
            Las columnas institucionales (Programa, Semestre, Código…) se guardan como etiquetas
            «Columna: valor» para filtrar a tus pacientes después.
          </li>
          <li>Confirma con la vista previa de las primeras 5 filas e importa.</li>
        </ol>
        <p className="mt-3 text-xs text-ink-soft">
          Las fechas aceptan AAAA-MM-DD y DD/MM/AAAA. Los teléfonos inválidos no detienen la
          importación, pero sin un teléfono válido el paciente no recibirá mensajes de WhatsApp.{' '}
          <a href={templateHref} download="plantilla-pacientes.csv" className="font-medium text-primary dark:text-accent-2 hover:underline">
            Descargar plantilla CSV de ejemplo
          </a>
        </p>
      </Card>
    </div>
  );
}
