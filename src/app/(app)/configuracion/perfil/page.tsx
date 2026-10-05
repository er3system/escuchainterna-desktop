import { PageHeader } from '@/components/ui';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { forbidAssistantRole } from '@/shared/infrastructure/auth/dataOwner';
import { PerfilForm } from './PerfilForm';

export default async function PerfilPage() {
  const repository = new SqlitePractitionerProfileRepository();
  const userId = await forbidAssistantRole();
  const profile = await repository.findByUserId(userId);
  // El profesor no atiende pacientes: perfil básico sin tarifas, disponibilidad
  // ni liga pública de reservas (v. configuración coherente por rol).
  const basic = (await createIdentityUseCases().getSessionContext.get(userId))?.role === 'professor';

  if (!profile) {
    return (
      <div>
        <PageHeader title="Perfil" />
        <p className="text-sm text-ink-soft">No se encontró el perfil del profesional.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Perfil"
        subtitle={
          basic
            ? 'Tu nombre, foto y datos de contacto profesionales.'
            : 'Esta información alimenta tu página pública de reservas y los mensajes a tus pacientes.'
        }
      />
      <PerfilForm profile={profile} appUrl={process.env.APP_URL ?? 'http://localhost:3000'} basic={basic} />
    </div>
  );
}
