import Link from 'next/link';
import { Lock, Pencil, Plus } from 'lucide-react';
import { ListTemplates } from '@/contexts/clinical-records/application/list-templates/ListTemplates';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { Badge, Card, PageHeader } from '@/components/ui';
import { DeleteTemplateButton } from './DeleteTemplateButton';

export default async function PlantillasPage() {
  const ownerUserId = await requireClinicalConfigAccess();
  const templates = await new ListTemplates(new SqliteClinicalTemplateRepository(ownerUserId)).execute();

  return (
    <div>
      <PageHeader
        title="Plantillas de historia clínica"
        subtitle="Las plantillas integradas son de solo lectura; crea las tuyas para adaptar el formulario a tu enfoque."
        actions={
          <Link
            href="/configuracion/plantillas/nueva"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            <Plus size={16} /> Nueva plantilla
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const fieldCount = template.sections.reduce((total, section) => total + section.fields.length, 0);
          return (
            <Card key={template.id} className="flex flex-col">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">{template.name}</h3>
                {template.isBuiltin ? (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                    <Lock size={13} /> Integrada
                  </span>
                ) : (
                  <Badge tone="primary">Propia</Badge>
                )}
              </div>
              {template.therapyType ? (
                <p className="mb-1 text-xs font-medium text-primary dark:text-accent-2">{template.therapyType}</p>
              ) : null}
              <p className="flex-1 text-sm text-ink-soft">{template.description}</p>
              <p className="mt-3 text-xs text-ink-soft">
                {template.sections.length} {template.sections.length === 1 ? 'sección' : 'secciones'} ·{' '}
                {fieldCount} {fieldCount === 1 ? 'pregunta' : 'preguntas'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/configuracion/plantillas/${template.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                >
                  <Pencil size={13} /> {template.isBuiltin ? 'Ver' : 'Editar'}
                </Link>
                {!template.isBuiltin ? (
                  <DeleteTemplateButton templateId={template.id} templateName={template.name} />
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
