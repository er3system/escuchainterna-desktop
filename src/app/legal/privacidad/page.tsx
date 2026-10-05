import type { Metadata } from 'next';
import Link from 'next/link';
import { PRIVACY_COUNTRY_LAWS } from '@/shared/domain/privacyCountryLaws';
import { LEGAL_VERSIONS } from '@/shared/legal/legalVersions';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { DesktopPrivacy } from '../DesktopLegalDoc';
import {
  LegalHeader,
  LegalList,
  LegalNote,
  LegalP,
  LegalSection,
  LegalStrong,
} from '../LegalDoc';

export const metadata: Metadata = {
  title: 'Aviso de privacidad — EscuchaInterna',
  description:
    'Aviso de privacidad de EscuchaInterna: cómo tratamos los datos de los profesionales y la información clínica de sus pacientes.',
};

export default function PrivacidadPage() {
  if (isDesktopEdition()) return <DesktopPrivacy />;
  return (
    <article>
      <LegalHeader
        title="Aviso de privacidad"
        subtitle="Cómo EscuchaInterna trata tus datos personales y la información clínica que registras sobre tus pacientes."
        updatedAt={LEGAL_VERSIONS.privacy}
      />

      <LegalNote>
        <LegalStrong>Resumen en una frase:</LegalStrong> la información clínica que registras te
        pertenece a ti como profesional; EscuchaInterna solo la procesa para prestarte el servicio,
        la mantiene aislada de las demás cuentas y nunca la utiliza con fines propios, publicitarios
        ni de entrenamiento de modelos.
      </LegalNote>

      <div className="mt-10">
        <LegalSection number={1} title="Responsable del tratamiento y roles">
          <LegalP>
            EscuchaInterna (en adelante, «la Plataforma») es una plataforma de gestión de consulta
            para profesionales de la salud mental, con domicilio para efectos de este aviso en
            Jamundí, Valle del Cauca, Colombia. Puedes contactarnos en{' '}
            <LegalStrong>privacidad@escuchainterna.com</LegalStrong>.
          </LegalP>
          <LegalP>
            En la Plataforma conviven dos categorías de datos con roles distintos:
          </LegalP>
          <LegalList
            items={[
              <>
                <LegalStrong>Datos del profesional (tu cuenta):</LegalStrong> respecto de tus datos
                de registro, perfil y facturación, EscuchaInterna actúa como{' '}
                <LegalStrong>responsable del tratamiento</LegalStrong>.
              </>,
              <>
                <LegalStrong>Datos de pacientes (tu expediente):</LegalStrong> respecto de la
                información clínica que tú registras sobre tus pacientes, el{' '}
                <LegalStrong>responsable del tratamiento eres tú</LegalStrong>, como profesional de
                la salud, y EscuchaInterna actúa únicamente como{' '}
                <LegalStrong>encargado del tratamiento</LegalStrong> (procesador), siguiendo tus
                instrucciones y sin decidir sobre el uso de esos datos.
              </>,
            ]}
          />
          <LegalP>
            Esto significa que la relación con el paciente — incluido el deber de obtener su
            consentimiento informado — corresponde al profesional, conforme a su normativa
            deontológica y a la legislación de protección de datos de su país.
          </LegalP>
        </LegalSection>

        <LegalSection number={2} title="Datos que recopilamos">
          <LegalP>
            <LegalStrong>Datos de tu cuenta como profesional:</LegalStrong>
          </LegalP>
          <LegalList
            items={[
              'Nombre completo, correo electrónico, teléfono con indicativo internacional y contraseña (almacenada únicamente como hash criptográfico irreversible).',
              'Datos de perfil profesional: cédula o tarjeta profesional, dirección de contacto, especialidad, moneda de cobro y configuración de la consulta.',
              'Datos de suscripción y pago del servicio (plan, periodo, estado).',
              'Datos técnicos mínimos de sesión (cookie de autenticación firmada).',
            ]}
          />
          <LegalP>
            <LegalStrong>Datos que tú registras sobre tus pacientes:</LegalStrong>
          </LegalP>
          <LegalList
            items={[
              'Datos identificativos y de contacto del paciente y su contacto de emergencia.',
              'Información clínica: historias clínicas, notas de sesión, diagnósticos (CIE-11), mapas familiares, archivos adjuntos y reportes.',
              'Información administrativa: citas, pagos, etiquetas y comunicaciones enviadas (recordatorios, correos, mensajes de WhatsApp).',
            ]}
          />
          <LegalP>
            Los datos de salud son datos personales sensibles. Por ello reciben las medidas de
            protección reforzadas descritas en la sección 6.
          </LegalP>
        </LegalSection>

        <LegalSection number={3} title="Finalidades del tratamiento">
          <LegalP>Tratamos los datos exclusivamente para:</LegalP>
          <LegalList
            items={[
              'Crear y administrar tu cuenta, autenticarte y mantener tu sesión.',
              'Prestar las funciones del servicio: agenda, expedientes, pagos, mensajes, recordatorios, asistente de IA y biblioteca.',
              'Enviar comunicaciones operativas en tu nombre a tus pacientes (recordatorios de cita y de pago, correos que tú redactas o apruebas).',
              'Gestionar tu suscripción y, en su caso, facturación del servicio.',
              'Mantener la seguridad de la Plataforma (registros de auditoría de acciones administrativas).',
              'Cumplir obligaciones legales aplicables.',
            ]}
          />
          <LegalP>
            <LegalStrong>Nunca</LegalStrong> utilizamos la información clínica de tus pacientes para
            publicidad, perfilado comercial, venta a terceros ni entrenamiento de modelos de
            inteligencia artificial.
          </LegalP>
        </LegalSection>

        <LegalSection number={4} title="Titularidad de la información clínica">
          <LegalP>
            La información que registras sobre tus pacientes <LegalStrong>te pertenece</LegalStrong>
            . EscuchaInterna no adquiere derecho alguno sobre los expedientes, notas o diagnósticos
            que generas; solo dispone de la licencia técnica mínima e imprescindible para
            almacenarlos, mostrártelos y procesarlos según tus instrucciones.
          </LegalP>
          <LegalList
            items={[
              'Puedes exportar tus expedientes y datos en cualquier momento desde la propia Plataforma.',
              'Si cancelas tu cuenta, tu información se conserva protegida: exporta antes de cancelar o solicítala después escribiendo a privacidad@escuchainterna.com (habeas data). La eliminación definitiva se realiza a tu solicitud, una vez exportados o transferidos los datos clínicos sujetos a retención legal.',
              'Si un paciente ejerce sus derechos directamente ante nosotros, lo redirigiremos a ti como responsable de su información clínica y te asistiremos técnicamente para atender la solicitud.',
            ]}
          />
        </LegalSection>

        <LegalSection number={5} title="Aislamiento por cuenta (multi-tenant)">
          <LegalP>
            Cada cuenta profesional opera en un espacio de datos aislado. Toda consulta a la base de
            datos se filtra estructuralmente por el identificador del profesional propietario, de
            modo que, por diseño, una cuenta no puede acceder a los pacientes, notas, historias
            clínicas, pagos o mensajes de otra. Este aislamiento aplica también al
            asistente de inteligencia artificial: su acceso a información está limitado, en la capa
            de aplicación, exclusivamente a los pacientes del profesional autenticado.
          </LegalP>
          <LegalP>
            En cuentas de organización (clínicas o universidades), el perfil maestro y los
            supervisores académicos solo acceden a la información de los miembros en los términos y
            con el alcance que la propia organización configura, siempre en modo de solo lectura
            para la supervisión y nunca a datos agregados con contenido clínico desde los paneles
            administrativos.
          </LegalP>
        </LegalSection>

        <LegalSection number={6} title="Medidas de seguridad">
          <LegalList
            items={[
              'Cifrado en tránsito: toda la comunicación con la Plataforma viaja por HTTPS/TLS.',
              'Cifrado en reposo: las columnas con contenido clínico se cifran campo a campo (AES-256-GCM) antes de almacenarse, además del cifrado de disco del proveedor de infraestructura.',
              'Contraseñas protegidas con funciones de derivación criptográfica (scrypt) con sal; nunca se almacenan en claro.',
              'Sesiones mediante cookies firmadas con HMAC, con atributos HttpOnly y SameSite.',
              'Aislamiento estructural por cuenta descrito en la sección 5.',
              'Controles de acceso por rol (profesional, organización, supervisión de solo lectura, administración).',
              'Registro de auditoría de las acciones administrativas de la plataforma.',
              'Copias de seguridad periódicas con los mismos controles de acceso.',
            ]}
          />
          <LegalP>
            Ninguna medida de seguridad es infalible. Si detectáramos una vulneración de seguridad
            que afecte a datos personales, lo notificaremos a los profesionales afectados y a las
            autoridades competentes en los plazos que exija la normativa aplicable.
          </LegalP>
        </LegalSection>

        <LegalSection number={7} title="Tus derechos (Habeas Data y ARCO)">
          <LegalP>
            Según el país desde el que utilices la Plataforma, te asisten los siguientes derechos
            sobre tus datos personales:
          </LegalP>
          <LegalList
            items={[
              <>
                <LegalStrong>Colombia (Ley 1581 de 2012 — Habeas Data) y demás regímenes de Habeas
                Data de Latinoamérica:</LegalStrong>{' '}
                conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización
                otorgada.
              </>,
              <>
                <LegalStrong>México (LFPDPPP):</LegalStrong> derechos ARCO — Acceso, Rectificación,
                Cancelación y Oposición — además de la revocación del consentimiento y la limitación
                de uso o divulgación.
              </>,
              <>
                <LegalStrong>Otras jurisdicciones:</LegalStrong> la Plataforma está diseñada y
                operada para Latinoamérica bajo la ley colombiana, y hoy no declara cumplimiento de
                regímenes de otras regiones (como el RGPD europeo). Si nos escribes desde otra
                jurisdicción, igualmente atenderemos tus solicitudes de acceso, rectificación y
                supresión de datos.
              </>,
            ]}
          />
          <LegalP>
            Para ejercerlos, escribe a <LegalStrong>privacidad@escuchainterna.com</LegalStrong>{' '}
            desde el correo asociado a tu cuenta, indicando el derecho que deseas ejercer.
            Responderemos dentro de los plazos legales aplicables (15 días hábiles en Colombia, 20
            días hábiles en México). También tienes derecho a presentar una reclamación ante la
            autoridad de control de tu país (SIC en Colombia, INAI en México, entre otras).
          </LegalP>
          <LegalP>
            Recuerda: los derechos de tus pacientes sobre su información clínica se ejercen ante ti
            como responsable; la Plataforma te proporciona las herramientas de exportación,
            rectificación y eliminación necesarias para atenderlos.
          </LegalP>
        </LegalSection>

        <LegalSection number={8} title="Marco normativo por país">
          <LegalP>
            Tomamos como referencia la normativa de protección de datos y de registro clínico de
            cada país donde ejercen nuestros profesionales, para ayudarte a cumplir tus obligaciones
            como responsable de la información. Estas son las normas concretas:
          </LegalP>
          <div className="overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-bg text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3">País</th>
                  <th className="px-4 py-3">Norma</th>
                  <th className="px-4 py-3">Qué cubre</th>
                </tr>
              </thead>
              <tbody>
                {PRIVACY_COUNTRY_LAWS.flatMap((entry) =>
                  entry.laws.map((law, lawIndex) => (
                    <tr key={`${entry.country}-${law.name}`} className="border-b border-line align-top last:border-b-0">
                      {lawIndex === 0 ? (
                        <td
                          rowSpan={entry.laws.length}
                          className="whitespace-nowrap px-4 py-3 font-semibold text-ink"
                        >
                          <span aria-hidden="true" className="mr-1.5">
                            {entry.flag}
                          </span>
                          {entry.country}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{law.name}</td>
                      <td className="px-4 py-3 leading-relaxed text-ink-soft">{law.scope}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <LegalP>
            En lo no regulado expresamente, aplicamos a todas las cuentas, con independencia del
            país, la línea base de la Ley 1581 de 2012 de Colombia y su régimen reforzado para
            datos sensibles de salud.
          </LegalP>
        </LegalSection>

        <LegalSection number={9} title="Plazos de conservación">
          <LegalList
            items={[
              'Datos de cuenta: mientras la cuenta esté activa. Tras la cancelación se conservan protegidos hasta que solicites su eliminación (que atendemos conforme al habeas data), salvo obligación legal de conservación.',
              'Información clínica de pacientes: mientras tú la conserves en la Plataforma. Su conservación o eliminación es decisión tuya como responsable, conforme a los plazos de conservación de expedientes clínicos de tu país.',
              'Registros de facturación del servicio: el plazo exigido por la legislación fiscal aplicable.',
              'Tokens de recuperación de contraseña: expiran en 1 hora y se invalidan tras su uso.',
            ]}
          />
        </LegalSection>

        <LegalSection number={10} title="Encargados y subencargados (subprocesadores)">
          <LegalP>
            Para operar el servicio podemos apoyarnos en proveedores de infraestructura y
            comunicaciones que tratan datos por cuenta de la Plataforma. Su tratamiento se regirá por
            contratos de encargo con obligaciones de confidencialidad y seguridad equivalentes a las
            de este aviso. Los subprocesadores previstos son:
          </LegalP>
          <LegalList
            items={[
              <>
                <LegalStrong>Resend</LegalStrong> (o proveedor SMTP equivalente) — envío de correo
                transaccional: recordatorios, recuperación de contraseña y mensajes a pacientes.
              </>,
              <>
                <LegalStrong>WhatsApp Business Cloud API (Meta Platforms)</LegalStrong> — envío de
                recordatorios y notificaciones por WhatsApp desde la cuenta empresarial de
                EscuchaInterna.
              </>,
              <>
                <LegalStrong>Stripe</LegalStrong> (y, para cobros propios del profesional, PayPal y
                Mercado Pago si tú los conectas) — procesamiento de pagos. Los datos de tarjetas los
                trata directamente la pasarela; nunca pasan por nuestros servidores.
              </>,
              <>
                <LegalStrong>Anthropic</LegalStrong> — procesamiento del asistente de IA, limitado a
                la información del profesional autenticado y sin uso para entrenamiento de modelos.
              </>,
              <>
                <LegalStrong>Supabase</LegalStrong> — base de datos Postgres gestionada (sobre
                infraestructura de AWS, en Estados Unidos): almacenamiento de la base de datos y
                sus copias de seguridad.
              </>,
              <>
                <LegalStrong>Hostinger</LegalStrong> — alojamiento del servidor de aplicación.
              </>,
            ]}
          />
          <LegalP>
            Publicaremos cualquier alta o sustitución de subprocesadores en esta página antes de que
            surta efecto. Las organizaciones pueden solicitar la firma de un acuerdo de encargo de
            tratamiento (DPA) escribiendo a privacidad@escuchainterna.com.
          </LegalP>
        </LegalSection>

        <LegalSection number={11} title="Transferencias internacionales">
          <LegalP>
            Nuestra base de datos y sus copias de seguridad se alojan en servidores de Supabase
            (sobre infraestructura de AWS) ubicados en Estados Unidos, y el asistente de IA es
            procesado por Anthropic, también en Estados Unidos. Esto constituye una transferencia
            internacional de datos. Al usar la Plataforma la autorizas respecto de los datos de tu
            cuenta; respecto de la información de tus pacientes, te corresponde como responsable
            informarla y recabar la autorización necesaria en el consentimiento informado. Exigimos
            a estos encargados compromisos contractuales de confidencialidad y seguridad
            equivalentes a los de este aviso, conforme a la Ley 1581 de 2012 y sus normas sobre
            transferencia internacional de datos, además de los compromisos de encargo de
            tratamiento de la sección 10.
          </LegalP>
        </LegalSection>

        <LegalSection number={12} title="Menores de edad">
          <LegalP>
            La Plataforma está dirigida a profesionales mayores de edad. Si atiendes pacientes
            menores de edad, eres responsable de contar con el consentimiento de sus padres o
            tutores conforme a la legislación y a tu normativa deontológica, antes de registrar su
            información en la Plataforma.
          </LegalP>
        </LegalSection>

        <LegalSection number={13} title="Cookies">
          <LegalP>
            La Plataforma utiliza únicamente una cookie técnica de sesión, estrictamente necesaria
            para mantener tu autenticación. No utilizamos cookies publicitarias ni de seguimiento de
            terceros.
          </LegalP>
        </LegalSection>

        <LegalSection number={14} title="Cambios a este aviso">
          <LegalP>
            Podremos actualizar este aviso para reflejar cambios normativos o del servicio. La
            versión vigente estará siempre publicada en esta página con su fecha de actualización.
            Si el cambio es sustancial (nuevas finalidades o nuevos subprocesadores), te lo
            notificaremos por correo y/o dentro de la aplicación con antelación razonable.
          </LegalP>
        </LegalSection>

        <LegalSection number={15} title="Contacto y jurisdicción">
          <LegalP>
            Para cualquier cuestión sobre privacidad: <LegalStrong>privacidad@escuchainterna.com</LegalStrong>.
            Para soporte general: <LegalStrong>hola@escuchainterna.com</LegalStrong>.
          </LegalP>
          <LegalP>
            Este aviso se rige por las leyes de la República de Colombia —en particular la Ley 1581
            de 2012 (Habeas Data) y sus normas reglamentarias— y, en lo no previsto, por la
            normativa de protección de datos del país de residencia del profesional cuando esta
            resulte imperativamente aplicable. Cualquier controversia se someterá a los jueces y
            tribunales competentes de Jamundí (Valle del Cauca, Colombia), sin perjuicio de los
            derechos irrenunciables que te otorgue la normativa de tu país.
          </LegalP>
          <LegalP>
            Consulta también nuestros{' '}
            <Link
              href="/legal/terminos"
              className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2"
            >
              Términos y condiciones
            </Link>
            .
          </LegalP>
        </LegalSection>
      </div>
    </article>
  );
}
