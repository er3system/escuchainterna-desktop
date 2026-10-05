import {
  Sparkles,
  UserRound,
  Link2,
  UserPlus,
  CircleCheck,
  CalendarDays,
  CalendarClock,
  LayoutGrid,
  Ban,
  ClipboardList,
  Layers,
  Stethoscope,
  FileSignature,
  CreditCard,
  BellRing,
  ReceiptText,
  MessageCircle,
  Palette,
  Send,
  ListChecks,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/**
 * Contenido de los tutoriales de Ayuda (módulo PURO de datos + iconos lucide,
 * importable desde el índice servidor y el reproductor cliente). Los iconos hacen
 * de "ilustración" de cada paso; pueden sustituirse por capturas reales más adelante.
 */

export type Accent = 'primary' | 'success' | 'warning';

export interface TutorialStep {
  title: string;
  body: string;
  icon: LucideIcon;
  accent: Accent;
}

export interface Tutorial {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  minutes: number;
  steps: TutorialStep[];
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'bienvenida',
    title: 'Bienvenido/a a EscuchaInterna',
    subtitle: 'Un recorrido de un minuto por tu nuevo espacio de trabajo.',
    icon: Sparkles,
    minutes: 2,
    steps: [
      {
        title: 'Este es tu espacio',
        body: 'Desde el menú de la izquierda llegas a todo: tu agenda, tus pacientes, los pagos, los mensajes y la configuración. Empecemos por dejarlo a tu medida.',
        icon: Sparkles,
        accent: 'primary',
      },
      {
        title: 'Completa tu perfil',
        body: 'En Configuración › Perfil pon tu foto, tu descripción, tus tarifas y tu tarjeta profesional. Esa tarjeta es la que te permite firmar documentos clínico-legales.',
        icon: UserRound,
        accent: 'success',
      },
      {
        title: 'Comparte tu liga de reservas',
        body: 'Tu perfil incluye una liga pública. Compártela con tus pacientes y podrán agendar contigo solos, viendo solo los horarios que tú habilitaste.',
        icon: Link2,
        accent: 'warning',
      },
      {
        title: 'Crea tu primer paciente',
        body: 'En Pacientes › Nuevo registras a quien atiendes. Con eso ya puedes abrir su expediente, agendarle y enviarle recordatorios.',
        icon: UserPlus,
        accent: 'primary',
      },
      {
        title: '¡Listo para empezar!',
        body: 'Eso es todo lo esencial. Los siguientes tutoriales te muestran cada parte con calma. Puedes volver a Ayuda cuando quieras.',
        icon: CircleCheck,
        accent: 'success',
      },
    ],
  },
  {
    id: 'agenda',
    title: 'Tu agenda y las reservas',
    subtitle: 'Define cuándo recibes y deja que tus pacientes agenden solos.',
    icon: CalendarDays,
    minutes: 3,
    steps: [
      {
        title: 'Define tu disponibilidad',
        body: 'En Agenda › Configuración eliges los días y horas en que recibes, la duración de las sesiones y los descansos. Eso es lo que verán tus pacientes.',
        icon: CalendarClock,
        accent: 'primary',
      },
      {
        title: 'Tus pacientes agendan solos',
        body: 'Con tu liga pública, el paciente elige un hueco libre y queda agendado. Recibes el aviso y la cita aparece en tu agenda, sin idas y venidas por chat.',
        icon: Link2,
        accent: 'success',
      },
      {
        title: 'Mira tu día o tu semana',
        body: 'Cambia entre las vistas Día y Semana. En la vista Día puedes arrastrar para crear una cita o un bloqueo en el horario exacto.',
        icon: LayoutGrid,
        accent: 'warning',
      },
      {
        title: 'Bloquea y reagenda',
        body: 'Bloquea espacios para almuerzo, pendientes o vacaciones, y reagenda una cita arrastrándola. Si avisas al paciente, se lo notificamos.',
        icon: Ban,
        accent: 'primary',
      },
    ],
  },
  {
    id: 'expediente',
    title: 'El expediente del paciente',
    subtitle: 'Historia clínica, evolución de las sesiones y documento, en un solo lugar.',
    icon: ClipboardList,
    minutes: 4,
    steps: [
      {
        title: 'Inicia la historia clínica',
        body: 'En la pestaña Expediente, abre la historia clínica eligiendo un modelo terapéutico (cognitivo-conductual, sistémico, humanista…). Ese modelo define el núcleo que vas a llenar.',
        icon: ClipboardList,
        accent: 'primary',
      },
      {
        title: 'Registra cada sesión',
        body: 'La Evolución es la línea de tiempo: la historia abre el flujo y debajo van las sesiones. Registra una entrevista inicial, un seguimiento, una nota o una atención en crisis.',
        icon: CalendarDays,
        accent: 'success',
      },
      {
        title: 'Añade bloques y técnicas',
        body: 'A la historia o a cualquier sesión puedes añadir bloques curados: examen mental, análisis funcional, evaluación de riesgo, instrumentos… Algunos llevan seguimiento entre sesiones.',
        icon: Layers,
        accent: 'warning',
      },
      {
        title: 'El Documento y la firma',
        body: 'La vista Documento arma solo el expediente completo con todo lo que registras. Desde Exportar lo congelas, lo firmas con tu tarjeta profesional y lo descargas en PDF.',
        icon: FileSignature,
        accent: 'primary',
      },
      {
        title: 'Diagnóstico: hipótesis o formal',
        body: 'En Diagnóstico registras tus impresiones como hipótesis. Confirmar una como diagnóstico formal (CIE-11) requiere tu tarjeta profesional. Todo queda trazado.',
        icon: Stethoscope,
        accent: 'success',
      },
    ],
  },
  {
    id: 'pagos',
    title: 'Cobros y pagos',
    subtitle: 'Lleva el control de lo cobrado y lo pendiente sin esfuerzo.',
    icon: CreditCard,
    minutes: 2,
    steps: [
      {
        title: 'Marca una sesión como pagada',
        body: 'Cada sesión tiene su estado de pago. Márcala como pagada con un clic; el panel de Pagos te muestra al instante lo cobrado y lo pendiente.',
        icon: CreditCard,
        accent: 'primary',
      },
      {
        title: 'Recordatorios de pago',
        body: 'Si una sesión queda con pago pendiente, puedes enviar un recordatorio con la liga de pago. Lo registras todo sin perseguir a nadie.',
        icon: BellRing,
        accent: 'warning',
      },
      {
        title: 'Recibos con folio',
        body: 'Emite un recibo con folio por cada pago. Queda en el historial del paciente y en su pestaña Mensajes, listo para cualquier consulta.',
        icon: ReceiptText,
        accent: 'success',
      },
    ],
  },
  {
    id: 'mensajes',
    title: 'Mensajes y campañas',
    subtitle: 'Lo automático que cuida la relación y las campañas que tú decides enviar.',
    icon: MessageCircle,
    minutes: 3,
    steps: [
      {
        title: 'Recordatorios automáticos',
        body: 'La app envía sola los recordatorios y confirmaciones de cada sesión. Tú solo defines el contenido una vez en Plantillas; el resto ocurre en segundo plano.',
        icon: BellRing,
        accent: 'primary',
      },
      {
        title: 'Tu tema y tus plantillas',
        body: 'En Mensajes › Plantillas eliges el tema visual de tus correos (cálido, profesional, minimal) y personalizas cada plantilla. Ves la vista previa de cómo le llega al paciente.',
        icon: Palette,
        accent: 'warning',
      },
      {
        title: 'Crea una campaña',
        body: 'En Marketing escribes una campaña: eliges a quién (todos, un filtro o una selección), escribes el mensaje y lo ves renderizado EN VIVO en tu tema antes de enviar.',
        icon: Send,
        accent: 'success',
      },
      {
        title: 'Todo queda registrado',
        body: 'El registro de Mensajes guarda todo lo enviado. Fíltralo por Automáticos o Campañas, y revisa lo que recibió cada paciente desde su propia pestaña Mensajes.',
        icon: ListChecks,
        accent: 'primary',
      },
    ],
  },
];

const DESKTOP_COPY: Record<string, { subtitle?: string; steps: Record<number, Partial<TutorialStep>> }> = {
  bienvenida: { steps: {
    2: { title: 'Respalda tu consulta', body: 'En Archivo › Crear respaldo cifrado puedes guardar una copia de tu consulta. En Sincronización puedes publicar una versión para continuar en otra PC con Drive. Conserva la contraseña que elegiste.', icon: ShieldCheck },
    3: { body: 'En Pacientes › Nuevo registras a quien atiendes. Con eso puedes abrir su expediente y agendarle. Los avisos reales por correo necesitan un proveedor configurado.' },
  } },
  agenda: { subtitle: 'Organiza tus sesiones y disponibilidad desde esta PC.', steps: {
    0: { body: 'En Agenda › Configuración eliges los días y horas en que recibes, la duración de las sesiones y los descansos. Estos ajustes organizan tu agenda local.' },
    1: { title: 'Agenda desde esta PC', body: 'Abre la agenda y crea una cita en el horario elegido. Selecciona el paciente y el tipo de sesión. Las direcciones locales del programa solo funcionan en esta PC; no ofrecen reservas públicas por Internet.', icon: CalendarDays },
    3: { body: 'Bloquea espacios para almuerzo, pendientes o vacaciones, y reagenda una cita arrastrándola. Los avisos quedan registrados; enviar correo real requiere Resend configurado y conexión.' },
  } },
  pagos: { subtitle: 'Registra lo cobrado y lo pendiente de tu consulta.', steps: {
    1: { title: 'Revisa los pagos pendientes', body: 'El panel de Pagos permite revisar lo pendiente y solicitar recordatorios. Sin proveedor, son registros locales sin enviar. El correo real requiere tu clave; los cobros automáticos y ligas de pago necesitan una integración adicional.' },
  } },
  mensajes: { subtitle: 'Distingue los registros locales de los correos enviados con tu proveedor.', steps: {
    0: { title: 'Recordatorios y conexión', body: 'Desde la agenda puedes solicitar un recordatorio. El envío real necesita tu proveedor y conexión. Sin clave, queda como registro local sin enviar. El programa no ejecuta recordatorios cuando está cerrado.' },
    1: { body: 'En Mensajes › Plantillas eliges el tema visual y personalizas cada plantilla. La vista previa muestra el diseño; el envío depende del proveedor que hayas configurado.' },
    2: { body: 'En Marketing eliges destinatarios, escribes el mensaje y revisas su vista previa. Para enviar correo real, conecta Resend con tu propia clave y autoriza el tratamiento indicado. Las automatizaciones se revisan al abrir Marketing.' },
    3: { body: 'Mensajes registra los intentos y su estado. Revisa cuáles están pendientes, tienen errores o fueron enviados. Un registro local sin proveedor no confirma que el paciente haya recibido un mensaje.' },
  } },
};

export function tutorialsForEdition(desktopEdition = false): Tutorial[] {
  if (!desktopEdition) return TUTORIALS;
  return TUTORIALS.map(tutorial => {
    const copy = DESKTOP_COPY[tutorial.id];
    if (!copy) return tutorial;
    return { ...tutorial, subtitle: copy.subtitle ?? tutorial.subtitle, steps: tutorial.steps.map((step, index) => ({ ...step, ...copy.steps[index] })) };
  });
}

export function findTutorial(id: string, desktopEdition = false): Tutorial | undefined {
  return tutorialsForEdition(desktopEdition).find((tutorial) => tutorial.id === id);
}
