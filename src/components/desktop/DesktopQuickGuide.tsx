import Link from 'next/link';
import { BookOpen, Cloud, FileDown, HardDrive, Keyboard, Plug, ShieldCheck } from 'lucide-react';

const guides = [
  { title: 'Trabajar sin conexión', icon: HardDrive, text: 'Agenda, pacientes, expedientes, pagos y lecturas instaladas funcionan en esta PC. Puedes seguir trabajando aunque se corte Internet.' },
  { title: 'Crear un respaldo', icon: ShieldCheck, text: 'En el menú superior, usa Archivo → Crear respaldo cifrado. Guarda el archivo y su contraseña en un lugar seguro. Archivo → Restaurar respaldo permite recuperarlo; revisa la confirmación antes de reemplazar una consulta.' },
  { title: 'Guardar un documento en PDF', icon: FileDown, text: 'Abre el consentimiento, expediente, reporte o mapa familiar y pulsa Guardar PDF. Elige dónde guardar el archivo. También está en Archivo → Guardar PDF (Ctrl+Shift+S). Imprimir (Ctrl+P) abre por separado el selector de impresoras. Funciona sin Internet y sin impresora virtual.' },
  { title: 'Continuar en otra PC', icon: Cloud, text: 'En Sincronización, publica una versión cifrada. En la otra PC, conecta la misma carpeta de Drive y contraseña, y recibe esa versión. Espera a que Drive termine de transferirla. Trabaja en una PC a la vez: recibir reemplaza la consulta local; no combina cambios.', href: '/configuracion/sincronizacion', label: 'Abrir sincronización' },
  { title: 'Instalar tus lecturas', icon: BookOpen, text: 'Archivo → Abrir carpeta de catálogos abre su ubicación. Copia tus libros a biblioteca, reinicia y pulsa Actualizar índice en Libros de esta PC. Los libros se copian aparte en cada equipo; el respaldo de la consulta no los incluye.', href: '/biblioteca/libros', label: 'Ver libros de esta PC' },
  { title: 'Activar servicios opcionales', icon: Plug, text: 'El correo real y la IA de proveedores requieren Internet, tu propia clave y autorización para enviar los datos indicados. Se configuran desde Servicios opcionales cuando tu rol lo permite. Las funciones locales siguen disponibles sin esas claves.' },
];

export function DesktopQuickGuide() {
  return <section aria-labelledby="pc-guide-title" className="mb-8">
    <h2 id="pc-guide-title" className="mb-4 font-display text-xl font-bold">Guía de uso en PC</h2>
    <div className="grid gap-3 sm:grid-cols-2">{guides.map(({ title, icon: Icon, text, href, label }) => <article key={title} className="rounded-card border border-line bg-surface p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Icon size={17} className="text-accent-strong" aria-hidden="true" />{title}</h3><p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p>{href ? <Link href={href} className="mt-3 inline-block text-sm font-semibold text-accent-strong hover:underline">{label} →</Link> : null}</article>)}
      <article className="rounded-card border border-line bg-surface p-5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Keyboard size={17} className="text-accent-strong" aria-hidden="true" />Moverte más rápido</h3><p className="mt-2 text-sm leading-relaxed text-ink-soft">Ctrl+K busca secciones y acciones, como Nuevo paciente. Tab recorre los controles, Enter abre y Esc cierra. Ctrl+P imprime; Ctrl+Shift+S guarda un PDF. En Vista puedes ajustar el tamaño del texto y activar pantalla completa.</p><Link href="/configuracion/apariencia" className="mt-3 inline-block text-sm font-semibold text-accent-strong hover:underline">Ajustar colores y movimiento →</Link></article>
    </div>
  </section>;
}
