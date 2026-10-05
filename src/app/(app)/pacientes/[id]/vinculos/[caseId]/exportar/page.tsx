import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, FileSignature, ShieldCheck, Users } from 'lucide-react';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { SqliteRelationalCaseRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRelationalCaseRepository';
import { SqliteCaseMemberRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseMemberRepository';
import { SqliteCaseSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteCaseSessionNoteRepository';
import { BuildCaseExport } from '@/contexts/clinical-records/application/relational-cases/BuildCaseExport';
import {
  MEMBER_RELATION_LABELS,
  isMemberRelationQuality,
} from '@/contexts/clinical-records/domain/value-objects/caseProfile';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { Badge, Button, Card } from '@/components/ui';
import { createCaseMemberReportAction } from '../../actions';

const SECRETS_LABEL: Record<string, string> = {
  '': 'sin definir',
  no_secretos: 'sin secretos',
  confidencialidad_limitada: 'confidencialidad limitada',
};

function sessionList(
  entries: { title: string; content: string; createdAt: string }[],
  empty: string,
) {
  if (entries.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <ol className="space-y-2">
      {entries.map((entry, index) => (
        <li key={index} className="rounded-lg border border-line bg-bg/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-ink">{entry.title}</span>
            <span className="text-xs text-ink-soft">
              {format(new Date(entry.createdAt), 'd MMM yyyy', { locale: es })}
            </span>
          </div>
          {entry.content ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{entry.content}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export default async function CaseExportPage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id, caseId } = await params;

  const patients = new SqlitePatientRepository(ownerUserId);
  // BuildCaseExport (clinical-records, aún SYNC) recibe un resolvedor de nombre SÍNCRONO.
  // Como patients.findById ahora es async, pre-resolvemos los nombres de los miembros del
  // caso a un Map (los únicos ids que el resolvedor consulta) y el resolvedor lee del Map.
  const nameByPatient = new Map<string, string>();
  for (const member of await new SqliteCaseMemberRepository(ownerUserId).listByCase(caseId)) {
    const memberPatientId = member.toPrimitives().patientId;
    if (nameByPatient.has(memberPatientId)) continue;
    const p = await patients.findById(memberPatientId);
    nameByPatient.set(memberPatientId, p ? p.toPrimitives().fullName : 'Paciente');
  }
  const exported = await new BuildCaseExport(
    new SqliteRelationalCaseRepository(ownerUserId),
    new SqliteCaseMemberRepository(ownerUserId),
    new SqliteCaseSessionNoteRepository(ownerUserId),
  ).execute(caseId, (patientId) => nameByPatient.get(patientId) ?? 'Paciente');

  if (!exported) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/pacientes/${id}/vinculos/${caseId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver al caso
        </Link>
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Users size={18} className="text-primary dark:text-accent-2" /> Export del caso · {exported.title}
        </h2>
      </div>

      <div className="flex items-start gap-3 rounded-card border border-success/40 bg-success-soft px-4 py-3">
        <ShieldCheck size={20} className="mt-0.5 shrink-0 text-success" />
        <p className="text-sm text-ink">
          El contenido <strong>confidencial</strong> NUNCA se incluye en este export, y la sección de
          cada persona solo contiene lo suyo: nunca el material privado del otro miembro.
          {exported.excludedConfidentialCount > 0
            ? ` Se excluyeron ${exported.excludedConfidentialCount} ${exported.excludedConfidentialCount === 1 ? 'sesión confidencial' : 'sesiones confidenciales'}.`
            : ''}
        </p>
      </div>

      <Card className="space-y-1 text-sm">
        <p className="text-ink">
          <span className="text-ink-soft">Tipo:</span> {exported.kind === 'pareja' ? 'Pareja' : 'Familia'} ·{' '}
          <span className="text-ink-soft">Estado:</span> {exported.status} ·{' '}
          <span className="text-ink-soft">Política de secretos:</span> {SECRETS_LABEL[exported.secretsPolicy]}
        </p>
      </Card>

      {(() => {
        const se = exported.systemEval;
        const seEntries = [
          ['Etapa del ciclo vital', se.lifeCycleStage],
          ['Estructura', se.structure],
          ['Comunicación', se.communication],
          ['Motivo del sistema', se.systemMotive],
        ].filter(([, v]) => v.trim() !== '');
        const hasProfile =
          seEntries.length > 0 ||
          exported.objectives.trim() !== '' ||
          exported.events.length > 0 ||
          exported.relations.length > 0;
        if (!hasProfile) return null;
        return (
          <Card className="space-y-3">
            <h3 className="text-base font-bold text-ink">Perfil del sistema</h3>
            {seEntries.length > 0 ? (
              <ul className="space-y-1 text-sm text-ink">
                {seEntries.map(([label, value]) => (
                  <li key={label}>
                    <span className="font-semibold">{label}:</span> {value}
                  </li>
                ))}
              </ul>
            ) : null}
            {exported.objectives.trim() !== '' ? (
              <p className="text-sm text-ink">
                <span className="font-semibold">Objetivos del caso:</span> {exported.objectives}
              </p>
            ) : null}
            {exported.events.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-ink">Línea de tiempo</p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                  {exported.events.map((ev, i) => (
                    <li key={i}>
                      {ev.date ? <span className="font-mono text-xs">{ev.date}</span> : null} {ev.title}
                      {ev.note ? ` — ${ev.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {exported.relations.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-ink">Mapa de relaciones</p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
                  {exported.relations.map((rel, i) => (
                    <li key={i}>
                      {rel.a} ↔ {rel.b}:{' '}
                      {isMemberRelationQuality(rel.quality) ? MEMBER_RELATION_LABELS[rel.quality] : rel.quality}
                      {rel.note ? ` — ${rel.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        );
      })()}

      <Card className="space-y-3">
        <h3 className="text-base font-bold text-ink">Sesiones conjuntas (compartidas)</h3>
        {sessionList(exported.jointSessions, 'Sin sesiones conjuntas registradas.')}
      </Card>

      {exported.members.map((member) => (
        <Card key={member.patientId} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{member.name}</h3>
            <Badge tone={member.consentStatus === 'otorgado' ? 'success' : 'warning'}>
              {member.consentStatus === 'otorgado' ? 'Consentimiento otorgado' : 'Consentimiento pendiente'}
            </Badge>
          </div>
          <h4 className="text-sm font-semibold text-ink-soft">Sesiones individuales (no confidenciales)</h4>
          {sessionList(member.individualSessions, 'Sin sesiones individuales en el export.')}
          <form action={createCaseMemberReportAction.bind(null, caseId, member.patientId)} className="border-t border-line pt-3">
            <Button type="submit">
              <FileSignature size={16} /> Generar informe firmable de {member.name}
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
