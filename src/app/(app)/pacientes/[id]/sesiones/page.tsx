import { redirect } from 'next/navigation';

/**
 * La antigua pestaña "Sesiones" se fusionó en el Expediente: la lista de sesiones
 * es ahora la vista Evolución. Esta ruta redirige allí. (El editor de cada nota
 * sigue en /sesiones/[noteId].)
 */
export default async function SesionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pacientes/${id}/historia?vista=evolucion`);
}
