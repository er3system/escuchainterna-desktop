import Link from 'next/link';
import { HeartHandshake, Plus, Users } from 'lucide-react';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SearchPatients } from '@/contexts/patients/application/search-patients/SearchPatients';
import { SearchPatientsQuery } from '@/contexts/patients/application/search-patients/SearchPatientsQuery';
import { SqliteRelationalCaseRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRelationalCaseRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { Badge, Card } from '@/components/ui';
import { ParejaCaseBuilder } from './ParejaCaseBuilder';
import { FamiliaCaseBuilder } from './FamiliaCaseBuilder';

const STATUS_BADGE: Record<string, { tone: 'success' | 'danger' | 'neutral'; label: string }> = {
  activo: { tone: 'success', label: 'Activo' },
  contraindicado: { tone: 'danger', label: 'Contraindicado' },
  cerrado: { tone: 'neutral', label: 'Cerrado' },
};

export default async function VinculosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const error = (await searchParams).error;

  const patients = new SqlitePatientRepository(ownerUserId);
  const current = await patients.findById(id);
  const currentName = current ? current.toPrimitives().fullName : 'este paciente';

  const cases = (await new SqliteRelationalCaseRepository(ownerUserId).listByPatient(id)).map((c) => c.toPrimitives());
  const others = (await new SearchPatients(patients).search(new SearchPatientsQuery({ archived: 'activos' })))
    .filter((patient) => patient.id !== id)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  const base = `/pacientes/${id}/vinculos`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Users size={18} className="text-primary" /> Vínculos
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Trata a la pareja o la familia como unidad: el «paciente» es el vínculo, pero el
          consentimiento y la confidencialidad son de cada persona por separado.
        </p>
      </div>

      {error ? (
        <p className="rounded-card border border-danger/30 bg-danger-soft px-4 py-2 text-sm text-danger">
          {error === 'segundo'
            ? 'Elige un segundo paciente distinto para formar la pareja.'
            : error === 'familia'
              ? 'Elige al menos un familiar (otro paciente tuyo) para formar el caso de familia.'
              : 'No se pudo crear el caso: revisa que los pacientes existan.'}
        </p>
      ) : null}

      {/* Casos existentes del paciente */}
      <div className="space-y-2">
        {cases.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-sm text-ink-soft">
            {currentName} aún no forma parte de ningún caso de pareja o familia.
          </p>
        ) : (
          cases.map((c) => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.activo;
            return (
              <Link key={c.id} href={`${base}/${c.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                        <HeartHandshake size={17} />
                      </span>
                      <span>
                        <span className="block font-semibold text-ink">{c.title}</span>
                        <span className="block text-xs text-ink-soft">
                          {c.kind === 'pareja' ? 'Pareja' : 'Familia'}
                          {c.status === 'contraindicado' ? ' · formato conjunto contraindicado' : ''}
                        </span>
                      </span>
                    </span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>

      {/* Crear caso de pareja */}
      <Card>
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <Plus size={16} className="text-primary" /> Crear caso de pareja
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          Vincula a <span className="font-medium text-ink">{currentName}</span> con su pareja (otro
          paciente tuyo). Luego acuerda la política de secretos y el consentimiento doble antes de las
          sesiones individuales.
        </p>
        <ParejaCaseBuilder
          patientId={id}
          currentName={currentName}
          patients={others.map((patient) => ({ id: patient.id, fullName: patient.fullName }))}
        />
      </Card>

      {/* Crear caso de familia (N miembros) */}
      <Card>
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <Users size={16} className="text-primary" /> Crear caso de familia
        </h3>
        <p className="mt-1 text-sm text-ink-soft">
          Vincula a <span className="font-medium text-ink">{currentName}</span> con uno o más
          familiares (otros pacientes tuyos). Luego, dentro del caso, define el rol de cada miembro y
          quién es el paciente identificado.
        </p>
        <FamiliaCaseBuilder
          patientId={id}
          currentName={currentName}
          patients={others.map((patient) => ({ id: patient.id, fullName: patient.fullName }))}
        />
      </Card>
    </div>
  );
}
