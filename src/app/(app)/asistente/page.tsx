import { PageHeader } from '@/components/ui';
import { createAssistantUseCases } from '@/contexts/assistant/infrastructure/createAssistantUseCases';
import { forbidAssistantRole, forbidProfessorRole } from '@/shared/infrastructure/auth/dataOwner';
import { AssistantChat } from './AssistantChat';

export default async function AsistentePage() {
  await forbidProfessorRole();
  const ownerUserId = await forbidAssistantRole();
  const useCases = await createAssistantUseCases(ownerUserId);

  const threads = await useCases.listThreads.list();
  const patients = await useCases.listPatientOptions.list();
  const initialThread = threads.length > 0 ? await useCases.getThreadDetail.get(threads[0].id) : null;

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col md:h-[calc(100vh-3rem)]">
      <PageHeader
        title="Asistente IA"
        subtitle="Pregunta por tus pacientes, tu consulta o el uso de la plataforma. El asistente solo accede a TU información."
      />
      <AssistantChat
        variant="pagina"
        patients={patients}
        initialThreads={threads}
        initialThread={initialThread}
      />
    </div>
  );
}
