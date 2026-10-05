import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, CreditCard, ShieldOff, UserRound } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { SqliteAssistantDirectoryReader } from '@/contexts/identity/infrastructure/persistence/SqliteAssistantDirectoryReader';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { CreateAssistantForm } from './CreateAssistantForm';
import { setAssistantStatusAction } from './actions';

export default async function AsistentesPage() {
  // Un asistente no administra asistentes; solo el titular.
  const ownerUserId = await requireClinicalConfigAccess();
  const assistants = await new SqliteAssistantDirectoryReader().listByOwner(ownerUserId);

  return (
    <div>
      <PageHeader
        title="Asistentes"
        subtitle="Cuentas de recepción para tu consulta: agenda, pagos, mensajes y datos de contacto de pacientes. El expediente clínico queda reservado para ti."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Nueva cuenta de asistente</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Tu asistente entra con su propio correo y contraseña, con la suscripción cubierta por tu
            cuenta. Puede crear y reagendar sesiones, registrar pagos y dar de alta pacientes con sus
            datos de contacto.
          </p>
          <CreateAssistantForm />
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Qué puede hacer un asistente</h2>
          <ul className="space-y-3 text-sm text-ink">
            <li className="flex items-start gap-2.5">
              <CalendarDays size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                <strong>Agenda completa:</strong> crear, reagendar y confirmar sesiones de tus
                pacientes.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CreditCard size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                <strong>Pagos:</strong> marcar sesiones pagadas, enviar recordatorios de pago y
                recibos.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <UserRound size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>
                <strong>Pacientes (solo contacto):</strong> lista, alta y edición de datos de
                contacto.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldOff size={16} className="mt-0.5 shrink-0 text-danger" />
              <span>
                <strong>Sin expediente clínico:</strong> historia, sesiones, diagnóstico, archivos y
                exportación quedan reservados al profesional. Tampoco accede a Marketing ni al
                Asistente IA.
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Tus asistentes</h2>
          {assistants.length === 0 ? (
            <EmptyState
              title="Aún no tienes asistentes"
              description="Crea la primera cuenta de recepción para delegar agenda y pagos sin exponer tus expedientes."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <th className="py-2 pr-4 font-medium">Nombre</th>
                    <th className="py-2 pr-4 font-medium">Correo</th>
                    <th className="py-2 pr-4 font-medium">Alta</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {assistants.map((assistant) => {
                    const active = assistant.status === 'activo';
                    return (
                      <tr key={assistant.assistantUserId} className="border-b border-line/60">
                        <td className="py-3 pr-4 font-medium text-ink">{assistant.fullName || '—'}</td>
                        <td className="py-3 pr-4 text-ink-soft">{assistant.email}</td>
                        <td className="py-3 pr-4 text-ink-soft">
                          {format(new Date(assistant.createdAt), "d 'de' MMMM yyyy", { locale: es })}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={active ? 'success' : 'neutral'}>
                            {active ? 'Activo' : 'Desactivado'}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <form action={setAssistantStatusAction}>
                            <input
                              type="hidden"
                              name="assistantUserId"
                              value={assistant.assistantUserId}
                            />
                            <input type="hidden" name="active" value={active ? '0' : '1'} />
                            <button
                              type="submit"
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                active
                                  ? 'border-line text-danger hover:bg-danger-soft'
                                  : 'border-line text-ink hover:bg-bg'
                              }`}
                            >
                              {active ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
