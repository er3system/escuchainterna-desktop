import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: '¿Cómo funciona la prueba gratis de 7 días?',
    answer:
      'Al crear tu cuenta tienes acceso completo a todas las funciones durante 7 días, sin registrar ninguna tarjeta. Al terminar la prueba decides si activas tu suscripción; si no lo haces, no se cobra nada: tu información se conserva protegida y la recuperas al reactivar tu cuenta, o nos escribes y te la entregamos (habeas data).',
  },
  {
    question: '¿Qué tan segura es la información clínica de mis pacientes?',
    answer:
      'Toda la comunicación viaja cifrada (HTTPS), las contraseñas se almacenan con hash criptográfico, la información clínica sensible se cifra además en reposo dentro de la base de datos, y cada cuenta está aislada estructuralmente: tus pacientes, notas e historias clínicas solo son visibles para ti (y, si perteneces a una organización, para la supervisión de solo lectura que ella configure y te informe). Diseñamos la plataforma conforme al régimen de Habeas Data de Colombia (Ley 1581 de 2012) y tomando como referencia las normas de protección de datos de Latinoamérica, para ayudarte a cumplir tus obligaciones como responsable de los datos de tus pacientes.',
  },
  {
    question: '¿De quién es la información que registro en la plataforma?',
    answer:
      'Tuya. Los expedientes, notas y datos de tus pacientes te pertenecen a ti como profesional; EscuchaInterna solo los procesa para darte el servicio. Puedes exportar tus expedientes y datos en cualquier momento, y si decides irte, te llevas todo contigo.',
  },
  {
    question: '¿Puedo cancelar mi suscripción cuando quiera?',
    answer:
      'Sí, sin penalizaciones ni plazos forzosos. Conservas el acceso hasta el final del periodo pagado — exporta tus expedientes desde la Plataforma antes de que termine. Después, tu información se conserva protegida: la recuperas al reactivar, o nos escribes y te la entregamos; la eliminación definitiva se hace a tu solicitud.',
  },
  {
    question: '¿Qué tipo de soporte ofrecen?',
    answer:
      'Soporte por correo en español para todos los planes, además de la documentación y los recursos de la Biblioteca EscuchaInterna. Las organizaciones cuentan con soporte prioritario y acompañamiento durante la puesta en marcha de su equipo.',
  },
  {
    question: '¿Sirve para clínicas y equipos de formación?',
    answer:
      'Sí. El plan Organizaciones añade un perfil maestro para administrar al equipo, permisos por miembro, supervisión de practicantes en modo solo lectura, retención configurable por cobro y branding propio. Cada profesional mantiene su consulta aislada del resto.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">
            Preguntas frecuentes
          </p>
          <h2 className="mt-3 font-display text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Resolvemos tus dudas
          </h2>
        </div>

        <div className="mt-12 flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-card border border-line bg-surface shadow-card"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-ink-soft">{item.answer}</p>
            </details>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-ink-soft">
          ¿Tienes otra pregunta?{' '}
          <a
            href="mailto:hola@escuchainterna.com"
            className="font-semibold text-primary hover:text-primary-dark dark:text-accent-2 dark:hover:text-accent-2"
          >
            Escríbenos a hola@escuchainterna.com
          </a>
        </p>
      </div>
    </section>
  );
}
