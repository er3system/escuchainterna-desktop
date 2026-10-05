import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { Badge, Card, PageHeader } from '@/components/ui';
import { TemplateEditor } from '../TemplateEditor';
import { updateTemplateAction } from '../actions';

const TYPE_LABELS: Record<string, string> = {
  texto_corto: 'Texto corto',
  texto_largo: 'Texto largo',
  fecha: 'Fecha',
  numero: 'Número',
  seleccion: 'Selección',
  opcion_multiple: 'Opción múltiple',
  casillas: 'Casillas',
  escala: 'Escala',
};

export default async function PlantillaDetallePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const ownerUserId = await requireClinicalConfigAccess();
  const { templateId } = await params;
  const template = await new SqliteClinicalTemplateRepository(ownerUserId).findById(templateId);
  if (!template) notFound();
  const primitives = template.toPrimitives();

  if (primitives.isBuiltin) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link
          href="/configuracion/plantillas"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a plantillas
        </Link>
        <PageHeader
          title={primitives.name}
          subtitle={primitives.description}
          actions={
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <Lock size={15} /> Plantilla integrada (solo lectura)
            </span>
          }
        />
        <div className="space-y-4">
          {primitives.sections.map((section) => (
            <Card key={section.id}>
              <h3 className="font-bold text-ink">{section.title}</h3>
              {section.description ? <p className="mt-0.5 text-sm text-ink-soft">{section.description}</p> : null}
              <ul className="mt-3 space-y-2">
                {section.fields.map((field) => (
                  <li key={field.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink">
                      {field.label}
                      {field.required ? <span className="text-danger"> *</span> : null}
                    </span>
                    <Badge tone="neutral">{TYPE_LABELS[field.type] ?? field.type}</Badge>
                    {field.options ? (
                      <span className="text-xs text-ink-soft">({field.options.join(' · ')})</span>
                    ) : null}
                    {field.type === 'escala' ? (
                      <span className="text-xs text-ink-soft">
                        ({field.scaleMin ?? 1}–{field.scaleMax ?? 10})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/configuracion/plantillas"
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
      >
        <ArrowLeft size={16} /> Volver a plantillas
      </Link>
      <PageHeader title={`Editar: ${primitives.name}`} subtitle="Plantilla personalizada." />
      <TemplateEditor
        initial={{
          name: primitives.name,
          therapyType: primitives.therapyType,
          description: primitives.description,
          sections: primitives.sections,
        }}
        action={updateTemplateAction.bind(null, templateId)}
      />
    </div>
  );
}
