import { auditExpedienteAccess } from './expedienteGuard';

/**
 * Template del expediente: a diferencia del layout, se vuelve a renderizar en
 * CADA navegación entre pestañas del paciente, por lo que aquí vive el
 * registro de bitácora por área y el bloqueo del rol asistente (v3 §1.2).
 */
export default async function ExpedienteTemplate({ children }: { children: React.ReactNode }) {
  await auditExpedienteAccess();
  return <>{children}</>;
}
