import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalHeader,
  LegalList,
  LegalNote,
  LegalP,
  LegalSection,
  LegalStrong,
} from '../LegalDoc';
import { LEGAL_VERSIONS } from '@/shared/legal/legalVersions';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { DesktopTerms } from '../DesktopLegalDoc';

export const metadata: Metadata = {
  title: 'Términos y condiciones — EscuchaInterna',
  description:
    'Términos y condiciones de uso de EscuchaInterna, la plataforma de gestión de consulta para profesionales de la salud mental.',
};

export default function TerminosPage() {
  if (isDesktopEdition()) return <DesktopTerms />;
  return (
    <article>
      <LegalHeader
        title="Términos y condiciones"
        subtitle="Condiciones que rigen el uso de EscuchaInterna por profesionales de la salud mental y organizaciones."
        updatedAt={LEGAL_VERSIONS.terms}
      />

      <LegalNote>
        Al crear una cuenta o utilizar EscuchaInterna aceptas estos términos y el{' '}
        <Link href="/legal/privacidad" className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2">
          Aviso de privacidad
        </Link>
        . Si actúas en nombre de una organización, declaras contar con facultades para obligarla.
      </LegalNote>

      <div className="mt-10">
        <LegalSection number={1} title="Objeto y aceptación">
          <LegalP>
            Estos términos regulan el acceso y uso de EscuchaInterna (en adelante, «la Plataforma»),
            un servicio de software por suscripción (SaaS) de gestión de consulta para
            profesionales de la salud mental, operado desde Jamundí, Valle del Cauca, Colombia. El uso de la
            Plataforma implica la aceptación íntegra de estos términos. Si no estás de acuerdo con
            ellos, no debes utilizar el servicio.
          </LegalP>
        </LegalSection>

        <LegalSection number={2} title="Descripción del servicio">
          <LegalP>La Plataforma ofrece, entre otras, las siguientes funciones:</LegalP>
          <LegalList
            items={[
              'Agenda con disponibilidad, citas recurrentes y página pública de reservas.',
              'Gestión de pacientes y expediente clínico: historias clínicas con plantillas, notas de sesión, diagnósticos con catálogo CIE-11, mapa familiar, archivos y reportes exportables.',
              'Recordatorios y comunicaciones a pacientes por WhatsApp y correo electrónico, enviados desde las cuentas empresariales de la Plataforma.',
              'Control de pagos, tarifas por inasistencia o cancelación tardía, recibos simples y métricas.',
              'Asistente de inteligencia artificial limitado a la información de los pacientes del propio profesional.',
              'Biblioteca EscuchaInterna de publicaciones propias.',
              'Funciones de organización para clínicas y equipos de formación: perfiles maestros, permisos por miembro, supervisión de practicantes y branding propio.',
            ]}
          />
          <LegalP>
            La Plataforma es una herramienta administrativa y de apoyo.{' '}
            <LegalStrong>No presta servicios de salud, no es un dispositivo médico y no sustituye
            el juicio clínico del profesional.</LegalStrong>
          </LegalP>
        </LegalSection>

        <LegalSection number={3} title="Cuenta y registro">
          <LegalList
            items={[
              'El servicio está dirigido exclusivamente a profesionales de la salud mental, estudiantes supervisados dentro de programas universitarios y al personal autorizado de sus organizaciones.',
              'Debes ser mayor de edad y proporcionar información veraz, completa y actualizada, incluida tu cédula o registro profesional cuando corresponda.',
              'Cada correo electrónico puede registrarse una sola vez. Eres responsable de la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.',
              'Las cuentas son personales e intransferibles. En organizaciones, cada miembro debe usar su propia cuenta.',
              'Nos reservamos el derecho de verificar la condición profesional del titular y de rechazar o cancelar registros que incumplan estos términos.',
            ]}
          />
        </LegalSection>

        <LegalSection number={4} title="Prueba gratuita, planes y pagos">
          <LegalList
            items={[
              <>
                <LegalStrong>Prueba gratuita:</LegalStrong> toda cuenta nueva incluye 7 días de
                acceso completo sin costo y sin necesidad de registrar una tarjeta. Al finalizar la
                prueba, el acceso a la aplicación se suspende hasta activar una suscripción; tu
                información se conserva y puedes exportarla.
              </>,
              <>
                <LegalStrong>Plan Profesional:</LegalStrong> suscripción mensual por profesional
                independiente; el precio vigente se indica en la{' '}
                <Link href="/#precios" className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2">
                  página de planes
                </Link>
                .
              </>,
              <>
                <LegalStrong>Plan Organizaciones:</LegalStrong> precio por profesional que disminuye
                con el tamaño del equipo (desde COP&nbsp;90.000 por profesional al mes), según el
                volumen y las condiciones acordadas con la organización.
              </>,
              'Los precios se expresan en pesos colombianos (COP) e incluyen los impuestos que resulten aplicables salvo indicación en contrario. Podemos ajustar los precios con un aviso mínimo de 30 días; el ajuste aplica a partir del siguiente periodo de facturación.',
              'La suscripción se renueva automáticamente por periodos mensuales hasta su cancelación. Puedes cancelar en cualquier momento; conservarás el acceso hasta el final del periodo pagado. No se realizan reembolsos por periodos parciales, salvo obligación legal.',
            ]}
          />
        </LegalSection>

        <LegalSection number={5} title="Uso aceptable">
          <LegalP>Te comprometes a NO utilizar la Plataforma para:</LegalP>
          <LegalList
            items={[
              'Ejercer o aparentar ejercer la psicología u otra profesión sanitaria sin la titulación o autorización exigida por tu país.',
              'Registrar información de personas sin base legítima para ello o en contravención de tu normativa deontológica.',
              'Enviar comunicaciones masivas no solicitadas (spam) o ajenas a la relación profesional con tus pacientes.',
              'Intentar acceder a datos de otras cuentas, vulnerar las medidas de seguridad o realizar ingeniería inversa del servicio.',
              'Revender, sublicenciar o explotar comercialmente la Plataforma o la Biblioteca EscuchaInterna fuera de tu práctica profesional.',
              'Cualquier actividad ilícita o que infrinja derechos de terceros.',
            ]}
          />
        </LegalSection>

        <LegalSection number={6} title="Responsabilidad del profesional sobre los datos de sus pacientes">
          <LegalP>
            Como responsable del tratamiento de la información clínica que registras (ver sección 1
            del{' '}
            <Link
              href="/legal/privacidad"
              className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2"
            >
              Aviso de privacidad
            </Link>
            ), te corresponde:
          </LegalP>
          <LegalList
            items={[
              'Obtener y documentar el consentimiento informado de tus pacientes (o de sus tutores, en el caso de menores) para el tratamiento de sus datos, incluido su registro en la Plataforma y el envío de recordatorios.',
              'Atender las solicitudes de derechos de tus pacientes (acceso, rectificación, supresión, portabilidad) usando las herramientas de la Plataforma.',
              'Cumplir los plazos de conservación de expedientes clínicos exigidos por tu país y tu colegio o asociación profesional.',
              'Mantener la exactitud de la información registrada y la confidencialidad de tus credenciales de acceso.',
            ]}
          />
        </LegalSection>

        <LegalSection number={7} title="Titularidad de tu contenido">
          <LegalP>
            Todo el contenido que registras — expedientes, notas, historias clínicas, plantillas
            propias, archivos y reportes — es de tu propiedad. Nos otorgas únicamente la licencia
            limitada, no exclusiva y revocable, imprescindible para alojarlo, procesarlo y
            mostrártelo dentro del servicio. Esta licencia termina cuando eliminas el contenido o
            cancelas tu cuenta, sin perjuicio de las copias de seguridad temporales que se eliminan
            en sus ciclos normales.
          </LegalP>
          <LegalP>
            <LegalStrong>
              Garantizas que cuentas con todos los derechos necesarios sobre el contenido que cargas
              o registras
            </LegalStrong>{' '}
            (archivos, documentos, imágenes, textos y plantillas) y que dicho contenido no infringe
            derechos de terceros, incluidos derechos de autor o de propiedad intelectual —por ejemplo,
            material plagiado, sin licencia o de uso no autorizado—. Eres el único responsable del
            contenido que incorporas a la Plataforma. EscuchaInterna actúa como simple proveedor de
            alojamiento: no revisa, supervisa ni hace suyo ese contenido, no responde por él y podrá
            retirarlo o suspender el acceso ante una reclamación fundada o un requerimiento legal. Te
            obligas a mantener indemne a EscuchaInterna frente a cualquier reclamación, daño, costo o
            sanción de terceros derivados del contenido que cargues o del incumplimiento de esta
            garantía.
          </LegalP>
        </LegalSection>

        <LegalSection number={8} title="Propiedad intelectual de la Plataforma">
          <LegalP>
            El software, el diseño, las marcas, los logotipos y las publicaciones de la Biblioteca
            EscuchaInterna son propiedad de EscuchaInterna o de sus licenciantes y están protegidos
            por la legislación de propiedad intelectual. La suscripción te otorga un derecho de uso
            personal, no exclusivo e intransferible, durante la vigencia del servicio. Las
            publicaciones de la Biblioteca pueden usarse dentro de tu práctica profesional, pero no
            redistribuirse públicamente ni revenderse.
          </LegalP>
        </LegalSection>

        <LegalSection number={9} title="Asistente de inteligencia artificial">
          <LegalList
            items={[
              'El asistente de IA y las funciones de redacción asistida (resúmenes, sugerencias a la historia clínica, borradores de reportes) son herramientas de apoyo administrativo y documental.',
              <>
                <LegalStrong>No constituyen consejo clínico, diagnóstico ni tratamiento.</LegalStrong>{' '}
                Toda salida de la IA requiere tu revisión y aprobación profesional antes de
                incorporarse al expediente o entregarse a terceros.
              </>,
              'El asistente solo accede a la información de tus propios pacientes y rechaza consultas ajenas a tu práctica.',
              'Eres responsable del uso que hagas de los contenidos generados y de verificar su exactitud.',
              'El modelo de inteligencia artificial subyacente puede variar según el plan contratado, el volumen de uso y la demanda del servicio, manteniendo en todos los casos un estándar de calidad adecuado para las funciones descritas. Los planes con uso limitado de IA indican su límite mensual; al alcanzarlo, las funciones de IA se reanudan el mes siguiente o al mejorar de plan.',
            ]}
          />
        </LegalSection>

        <LegalSection number={10} title="Organizaciones, supervisión y retenciones">
          <LegalList
            items={[
              'El perfil maestro de una organización administra a sus miembros: altas, permisos (cobros, configuración de tarifas, supervisión) y desactivaciones.',
              'La supervisión de practicantes otorga acceso de solo lectura a las notas e historias clínicas de los supervisados, dentro del alcance configurado. El supervisado es informado de esta condición por su organización.',
              'Si la organización configura un porcentaje de retención sobre los cobros de sus miembros, la Plataforma lo calcula y muestra de forma transparente. La relación económica entre organización y profesional es ajena a EscuchaInterna.',
              'La organización es responsable de contar con la base jurídica para acceder a los datos de sus miembros en los términos configurados.',
            ]}
          />
        </LegalSection>

        <LegalSection number={11} title="Disponibilidad del servicio">
          <LegalP>
            Procuramos una disponibilidad continua del servicio, con mantenimientos programados
            notificados con antelación razonable. La Plataforma realiza copias de seguridad
            periódicas; no obstante, te recomendamos exportar regularmente tu información crítica.
            No garantizamos que el servicio esté libre de interrupciones o errores, aunque nos
            comprometemos a corregirlos con diligencia.
          </LegalP>
        </LegalSection>

        <LegalSection number={12} title="Limitación de responsabilidad">
          <LegalList
            items={[
              'EscuchaInterna es una herramienta de gestión: no participa en la relación terapéutica ni asume responsabilidad por las decisiones clínicas del profesional.',
              'No respondemos de los daños derivados del incumplimiento por el profesional de sus obligaciones legales o deontológicas, ni del uso de credenciales por terceros imputable al usuario.',
              'En la medida permitida por la ley, nuestra responsabilidad total agregada por cualquier reclamación se limita al importe pagado por el usuario en los 12 meses anteriores al hecho que la origine.',
              'Nada en estos términos limita la responsabilidad que no pueda limitarse legalmente (dolo, culpa grave o daños personales).',
            ]}
          />
        </LegalSection>

        <LegalSection number={13} title="Suspensión y terminación">
          <LegalList
            items={[
              'Puedes cancelar tu cuenta en cualquier momento desde la configuración o escribiendo a hola@escuchainterna.com.',
              'Podemos suspender o cancelar cuentas que incumplan estos términos, previo aviso cuando sea razonable, o de inmediato ante usos ilícitos o riesgos de seguridad.',
              'Tras la terminación, tu información se conserva protegida: exporta tus datos desde la Plataforma antes de cancelar, o solicítalos después escribiendo a privacidad@escuchainterna.com. La eliminación definitiva se realiza a tu solicitud, salvo obligación legal de conservación.',
              'Las secciones que por su naturaleza deban sobrevivir (titularidad, limitación de responsabilidad, ley aplicable) seguirán vigentes tras la terminación.',
            ]}
          />
        </LegalSection>

        <LegalSection number={14} title="Modificaciones a estos términos">
          <LegalP>
            Podemos modificar estos términos para reflejar cambios del servicio o de la normativa.
            Publicaremos la versión vigente en esta página y, si el cambio es sustancial, te lo
            notificaremos por correo o dentro de la aplicación con al menos 15 días de antelación.
            El uso del servicio tras la entrada en vigor de los cambios implica su aceptación; si no
            estás de acuerdo, puedes cancelar antes de que apliquen.
          </LegalP>
        </LegalSection>

        <LegalSection number={15} title="Ley aplicable y jurisdicción">
          <LegalP>
            Estos términos se rigen por las leyes de la República de Colombia. Para cualquier
            controversia, las partes se someten a los jueces y tribunales competentes de Jamundí,
            Valle del Cauca (Colombia), renunciando a cualquier otro fuero, sin perjuicio de las
            normas imperativas de protección al consumidor y de protección de datos personales
            (Ley 1581 de 2012) del lugar de residencia del usuario que resulten aplicables.
          </LegalP>
        </LegalSection>

        <LegalSection number={16} title="Contacto">
          <LegalP>
            Soporte y consultas generales: <LegalStrong>hola@escuchainterna.com</LegalStrong>.
            Privacidad y protección de datos:{' '}
            <LegalStrong>privacidad@escuchainterna.com</LegalStrong>. Consulta también el{' '}
            <Link
              href="/legal/privacidad"
              className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2"
            >
              Aviso de privacidad
            </Link>
            .
          </LegalP>
        </LegalSection>
      </div>
    </article>
  );
}
