import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ListTemplates } from '@/contexts/clinical-records/application/list-templates/ListTemplates';
import { SqliteClinicalTemplateRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalTemplateRepository';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteUserPreferencesRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteUserPreferencesRepository';
import {
  HISTORIA_DEFAULT_TEMPLATE_KEY,
  normalizeDefaultTemplateId,
} from '@/contexts/clinical-records/domain/clinicalPreferences';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { TemplatePicker } from './TemplatePicker';

export default async function NuevaHistoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ primaria?: string; coexiste?: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const sp = await searchParams;
  // 'episodio' = nuevo episodio que COEXISTE (fuerza crear otra primaria); 'primaria'
  // = iniciar la primera/única; 'registro' = registro aparte.
  const mode = sp.primaria === '1' ? (sp.coexiste === '1' ? 'episodio' : 'primaria') : 'registro';

  // En modo "iniciar primaria" (no episodio): si ya hay historia clínica, no se inicia
  // otra. En modo 'episodio' SÍ se permite (coexisten varios expedientes abiertos).
  if (mode === 'primaria') {
    const hasPrimary = (await new SqliteClinicalRecordRepository(ownerUserId).findPrimaryHistory(id)) !== null;
    if (hasPrimary) redirect(`/pacientes/${id}/historia?vista=documento`);
  }

  const templates = await new ListTemplates(new SqliteClinicalTemplateRepository(ownerUserId)).execute();
  const defaultTemplateId = normalizeDefaultTemplateId(
    await new SqliteUserPreferencesRepository(ownerUserId).get(HISTORIA_DEFAULT_TEMPLATE_KEY),
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={`/pacientes/${id}/historia`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver
        </Link>
        <h2 className="text-lg font-bold text-ink">
          {mode === 'primaria' ? 'Elige el modelo para iniciar la historia clínica' : 'Selecciona una plantilla'}
        </h2>
      </div>

      {mode === 'primaria' ? (
        <p className="mb-4 text-sm text-ink-soft">
          El modelo define el enfoque y aporta el núcleo de la historia. Previsualiza antes de elegir
          y marca tu modelo por defecto con la estrella.
        </p>
      ) : null}

      <TemplatePicker
        patientId={id}
        templates={templates}
        defaultTemplateId={defaultTemplateId}
        mode={mode}
      />
    </div>
  );
}
