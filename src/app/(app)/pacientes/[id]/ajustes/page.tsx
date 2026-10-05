import { notFound } from 'next/navigation';
import { Bell, TriangleAlert, Share2, ArrowRightLeft } from 'lucide-react';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { listActiveSharesOfOwner } from '@/shared/infrastructure/auth/patientShares';
import { Card } from '@/components/ui';
import { ReminderPrefs } from './ReminderPrefs';
import { DeletePatient } from './DeletePatient';
import { SharePatient } from './SharePatient';
import { TransferPatient } from './TransferPatient';
import { ownerOrganizationId, listShareableColleagues } from './sharing';

export default async function AjustesPage({ params }: { params: Promise<{ id: string }> }) {
  // Acotado al DUEÑO (tratante): un asistente o un acceso de cobertura no llega aquí.
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const patient = await new SqlitePatientRepository(ownerUserId).findById(id);
  if (!patient) notFound();

  const prefs = patient.reminderPreferences();
  const isInstitutional = patient.owningOrganizationId() !== null;

  // Compartir (solo lectura) con un colega de la MISMA organización. Solo disponible
  // si el dueño pertenece a una org; el resolutor revalida en cada lectura.
  const organizationId = await ownerOrganizationId(ownerUserId);
  const colleagues = organizationId ? await listShareableColleagues(organizationId, ownerUserId) : [];
  const shares = organizationId ? await listActiveSharesOfOwner(id, ownerUserId) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Bell size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-ink">Recordatorios</h2>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Elige por qué canales este paciente recibe recordatorios automáticos.
        </p>
        <ReminderPrefs
          patientId={id}
          initialWhatsapp={prefs.whatsapp}
          initialEmail={prefs.email}
          hasPhone={patient.hasWhatsAppReachablePhone()}
        />
      </Card>

      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Share2 size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-ink">Compartir</h2>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          Da a un colega de tu organización acceso de <strong>solo lectura</strong> al resumen de
          este expediente. No cede la propiedad ni el seguimiento; cada consulta queda registrada y
          puedes revocarla cuando quieras.
        </p>
        {organizationId ? (
          <SharePatient
            patientId={id}
            colleagues={colleagues.map((c) => ({ userId: c.userId, name: c.name, email: c.email }))}
            shares={shares.map((s) => ({
              id: s.id,
              granteeName: s.granteeName,
              granteeEmail: s.granteeEmail,
            }))}
          />
        ) : (
          <p className="rounded-lg border border-line bg-bg/40 px-4 py-3 text-sm text-ink-soft">
            Compartir está disponible cuando perteneces a una organización. Como trabajas de forma
            independiente, no hay colegas con quienes compartir.
          </p>
        )}
      </Card>

      {organizationId && colleagues.length > 0 ? (
        <Card>
          <div className="mb-1 flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-warning" />
            <h2 className="text-lg font-bold text-ink">Transferir a un colega</h2>
          </div>
          <p className="mb-4 text-sm text-ink-soft">
            Cede este paciente y <strong>todo su expediente</strong> a otro miembro de tu
            organización. A diferencia de compartir, esto <strong>traspasa el seguimiento</strong>:
            dejarás de tener acceso (solo el colega podría devolvértelo).
          </p>
          <TransferPatient
            patientId={id}
            colleagues={colleagues.map((c) => ({ userId: c.userId, name: c.name, email: c.email }))}
          />
        </Card>
      ) : null}

      <Card>
        <div className="mb-1 flex items-center gap-2">
          <TriangleAlert size={18} className="text-danger" />
          <h2 className="text-lg font-bold text-ink">Eliminar paciente</h2>
        </div>
        <p className="mb-4 text-sm text-ink-soft">
          {isInstitutional
            ? 'Quita este paciente de tu consulta. Como pertenece a una organización, queda bajo custodia de la institución (no se borra) y se avisa al responsable.'
            : 'Archiva este paciente. No se borra nada: podrás recuperarlo cuando quieras desde la lista de pacientes.'}
        </p>
        <DeletePatient patientId={id} isInstitutional={isInstitutional} />
      </Card>
    </div>
  );
}
