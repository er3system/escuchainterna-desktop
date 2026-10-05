import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { CalendarOwnerMessage } from '@/contexts/practitioner/application/google-calendar/GoogleCalendarMessages';
import { createGoogleCalendarConsultation } from '@/contexts/practitioner/infrastructure/google-calendar/createGoogleCalendarConsultation';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';
export default async function GoogleCalendarPage() {
  const ownerUserId = await requireClinicalConfigAccess();
  if (!isDesktopEdition()) redirect('/configuracion/integraciones');
  const summary = await createGoogleCalendarConsultation().summary(new CalendarOwnerMessage(ownerUserId));
  return <div><PageHeader title="Google Calendar" subtitle="Conecta tu cuenta, publica horarios y revisa tu disponibilidad personal." />
    <Link href="/agenda" className="mb-5 inline-block text-sm text-accent-strong underline">← Volver a Agenda</Link>
    <GoogleCalendarPanel summary={summary} />
    <section className="mt-6 rounded-card border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-bold">Preparar tu cliente de Google</h2>
      <p className="mt-2 text-sm text-ink-soft">Google requiere un cliente OAuth registrado para la aplicación de escritorio. Este ajuste se hace una vez; después eliges tu cuenta y autorizas en el navegador habitual.</p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-ink-soft">
        <li>Abre <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-accent-strong underline">Google Cloud ↗</a> y selecciona tu proyecto.</li>
        <li>En «APIs y servicios → Biblioteca» habilita «Google Calendar API».</li>
        <li>En «Google Auth Platform» configura el nombre y correo de soporte. Si la audiencia está en pruebas, añade tu correo como usuario de prueba.</li>
        <li>En «Clientes» crea un cliente OAuth de tipo <strong>Aplicación de escritorio</strong>. Descarga su JSON e impórtalo aquí. Un cliente de aplicación web no sirve para este flujo.</li>
        <li>Pulsa «Preparar conexión», abre Google y concede los permisos. Regresa a esta pantalla: se actualizará automáticamente.</li>
      </ol>
      <p className="mt-4 text-xs text-ink-soft">Los proyectos externos en pruebas pueden requerir renovar el permiso a los siete días. No compartas el JSON, los tokens ni tu contraseña por chat o en GitHub. <a href="https://developers.google.com/identity/protocols/oauth2/native-app" target="_blank" rel="noreferrer" className="text-accent-strong underline">Guía oficial ↗</a></p>
    </section>
  </div>;
}
