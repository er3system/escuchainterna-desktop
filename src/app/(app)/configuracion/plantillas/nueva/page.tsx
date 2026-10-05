import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { TemplateEditor } from '../TemplateEditor';
import { createTemplateAction } from '../actions';

export default async function NuevaPlantillaPage() {
  await requireClinicalConfigAccess();
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/configuracion/plantillas"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
      >
        <ArrowLeft size={16} /> Volver a plantillas
      </Link>
      <PageHeader
        title="Nueva plantilla"
        subtitle="Diseña el formulario de historia clínica: secciones, preguntas y tipos de respuesta."
      />
      <TemplateEditor action={createTemplateAction} />
    </div>
  );
}
