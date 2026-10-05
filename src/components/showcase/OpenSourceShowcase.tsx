'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, ChevronRight, Cloud, Code2, Coffee, Download, FileText, FolderHeart, Github, HardDrive, Heart, LayoutDashboard, Menu, Moon, Palette, Play, ShieldCheck, Sun, Users, Wallet, WifiOff, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { PROJECT_LINKS } from '@/components/project/projectLinks';
import styles from './Showcase.module.css';

const PALETTES = [
  { name: 'Bosque', color: '#22634e', accent: '#cee68f' },
  { name: 'Salvia', color: '#647750', accent: '#dbe3bf' },
  { name: 'Jardín', color: '#288068', accent: '#b5e6c8' },
  { name: 'Océano', color: '#246e85', accent: '#b2dfe9' },
  { name: 'Lavanda', color: '#795b93', accent: '#e2cff7' },
  { name: 'Terracota', color: '#a25638', accent: '#f5d1b8' },
];

const FAQ = [
  ['¿El programa es gratuito?', 'Sí. Puedes usar la edición para PC sin pagar una suscripción. El apoyo en Ko-fi es voluntario. Si conectas un proveedor de correo o IA, sus tarifas se pagan por separado.'],
  ['¿Qué necesito para instalarlo?', 'Windows de 64 bits. Descarga y ejecuta el instalador de GitHub; después, crea tu cuenta en el programa. El instalador incluye todo lo necesario. Todavía no hay instaladores para macOS ni Linux.'],
  ['¿Puedo trabajar sin internet?', 'Sí. Puedes consultar la agenda, los expedientes, los pagos y las lecturas instaladas sin conexión. Google Drive, Calendar, el envío de correo y la IA de proveedores requieren internet. Para ejecutar recordatorios locales, el programa debe estar abierto.'],
  ['¿Cómo continúo en otra PC?', 'Configura una carpeta de Google Drive para escritorio y una contraseña de cifrado en ambas PCs. Desde el programa, envía una copia completa y recíbela en el otro equipo cuando Drive termine de transferirla. Usa una PC a la vez: los cambios simultáneos no se combinan. También puedes trasladar un respaldo cifrado.'],
  ['¿Cómo conecto correo, IA o Google Calendar?', 'En Configuración puedes añadir tus claves de OpenAI, Anthropic o Resend. Para Calendar necesitas registrar un cliente OAuth de escritorio y autorizarlo en Google. Estas conexiones son opcionales.'],
  ['¿Qué incluye la biblioteca?', 'La biblioteca permite organizar y leer los archivos que instales en cada equipo. El instalador público no incluye libros, publicaciones externas ni el catálogo CIE-11; estos contenidos se distribuyen por separado y tienen sus propias licencias.'],
];

function ProjectBrand() {
  return <a href="#" className={styles.brand} aria-label="EscuchaInterna, inicio"><LogoMark size={34} /><span>escucha<span className={styles.brandSecond}>interna</span><b>.</b></span></a>;
}

/** Vista ilustrativa, sin conexión a cuentas ni expedientes reales. */
function ProductPreview({ palette = 0, dark = false }: { palette?: number; dark?: boolean }) {
  const [section, setSection] = useState('Inicio');
  const colors = PALETTES[palette];
  const items = [{ name: 'Inicio', icon: LayoutDashboard }, { name: 'Agenda', icon: CalendarDays }, { name: 'Pacientes', icon: Users }, { name: 'Pagos', icon: Wallet }];
  return <div className={styles.preview} data-preview-dark={dark ? 'true' : 'false'} style={{ '--preview-primary': colors.color, '--preview-accent': colors.accent } as React.CSSProperties}>
    <div className={styles.windowBar}><span className={styles.windowDots}><i /><i /><i /></span><span>EscuchaInterna para PC</span><HardDrive size={12} aria-hidden="true" /></div>
    <div className={styles.windowBody}>
      <aside className={styles.previewSidebar}><div className={styles.previewBrand}><LogoMark size={21} /><strong>escuchainterna</strong></div><span className={styles.previewNavLabel}>TU CONSULTA</span>{items.map(({ name, icon: Icon }) => <button key={name} type="button" aria-pressed={section === name} onClick={() => setSection(name)}><Icon size={15} aria-hidden="true" /><span>{name}</span></button>)}<div className={styles.previewSidebarBottom}><BookOpen size={15} aria-hidden="true" /> Biblioteca<br /><span><ShieldCheck size={13} aria-hidden="true" /> Consulta local</span></div></aside>
      <div className={styles.previewContent}>
        <div className={styles.previewBreadcrumb}>Tu consulta <ChevronRight size={12} aria-hidden="true" /> {section}<span className={styles.localBadge}><i /> En esta PC</span></div>
        {section === 'Inicio' || section === 'Agenda' ? <>
          <div className={styles.previewWelcome}><span>LUNES · AGENDA</span><h3>{section === 'Inicio' ? 'Agenda del lunes' : 'Sesiones de hoy'}</h3><p>3 sesiones agendadas · Datos de ejemplo</p><span className={styles.previewFlower} aria-hidden="true">✳</span></div>
          <div className={styles.previewActions}><span><Users size={16} aria-hidden="true" /> Nuevo paciente</span><span><CalendarDays size={16} aria-hidden="true" /> Agenda de hoy</span><span><BookOpen size={16} aria-hidden="true" /> Biblioteca</span></div>
          <div className={styles.previewAgenda}><div><h4>Tu agenda de hoy</h4><span>Ver agenda <ArrowRight size={12} aria-hidden="true" /></span></div>{[{ time: '09:00', initials: 'AL', label: 'Sesión individual', color: 'green' }, { time: '11:30', initials: 'MC', label: 'Sesión de seguimiento', color: 'purple' }, { time: '15:00', initials: 'JR', label: 'Primera consulta', color: 'warm' }].map(row => <div className={styles.previewBooking} key={row.time}><time>{row.time}</time><span className={styles.previewAvatar} data-color={row.color}>{row.initials}</span><div><strong>{row.label}</strong><small>Paciente de ejemplo · 50 min</small></div><span className={styles.previewStatus}>Agendada</span></div>)}</div>
        </> : section === 'Pacientes' ? <><div className={styles.previewWelcome}><span>EXPEDIENTES</span><h3>Pacientes</h3><p>Historias clínicas, notas y documentos.</p></div><div className={styles.previewAgenda}><h4>Vista de ejemplo</h4>{['Paciente de ejemplo A', 'Paciente de ejemplo B', 'Paciente de ejemplo C'].map((name, index) => <div key={name} className={styles.previewBooking}><span className={styles.previewAvatar}>{index + 1}</span><div><strong>{name}</strong><small>Historia clínica · Notas de sesión</small></div><FileText size={17} aria-hidden="true" /></div>)}</div></> : <><div className={styles.previewWelcome}><span>ACTIVIDAD REGISTRADA</span><h3>Registro de pagos</h3><p>Consulta los cobros de tus sesiones.</p></div><div className={styles.previewAgenda}><h4>Resumen ilustrativo</h4><div className={styles.previewMetrics}><div><small>Sesiones registradas</small><strong>24</strong></div><div><small>Pagos al día</small><strong>21</strong></div></div><div className={styles.previewChart} aria-hidden="true">{[35, 52, 43, 67, 58, 82, 70, 95].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></div></>}
        <p className={styles.previewFootnote}>Demostración interactiva · Datos ficticios</p>
      </div>
    </div>
  </div>;
}

export function OpenSourceShowcase() {
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [palette, setPalette] = useState(0);
  const [darkPreview, setDarkPreview] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const element = root.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!element || preference.matches || motionPaused || !('IntersectionObserver' in window)) {
      setMotionReady(false);
      return;
    }
    setMotionReady(true);
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.setAttribute('data-visible', 'true'); observer.unobserve(entry.target); } }), { threshold: 0.08 });
    element.querySelectorAll('[data-reveal]').forEach(section => observer.observe(section));
    let frame = 0;
    const progress = () => {
      frame = 0;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      element.style.setProperty('--read-progress', `${height > 0 ? Math.min(1, window.scrollY / height) : 0}`);
      element.style.setProperty('--hero-drift', `${Math.min(window.scrollY, 850) * 0.055}px`);
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(progress); };
    const changed = () => setMotionReady(!preference.matches);
    progress();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    preference.addEventListener('change', changed);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', scroll);
      preference.removeEventListener('change', changed);
    };
  }, [motionPaused]);

  const closeMenu = () => setMenuOpen(false);
  return <div className={styles.showcase} ref={root} data-motion-ready={motionReady ? 'true' : 'false'} data-motion-paused={motionPaused ? 'true' : 'false'}>
    <a href="#contenido" className={styles.skipLink}>Saltar al contenido</a>
    <header className={styles.header}><span className={styles.readProgress} aria-hidden="true" /><div className={styles.navInner}><ProjectBrand /><button type="button" className={styles.menuToggle} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="showcase-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button><nav onKeyDown={event => { if (event.key === 'Escape') closeMenu(); }} id="showcase-navigation" aria-label="Navegación principal" className={styles.nav} data-open={menuOpen ? 'true' : 'false'}><a href="#aplicacion" onClick={closeMenu}>La aplicación</a><a href="#apariencia" onClick={closeMenu}>Temas</a><a href="#proyecto" onClick={closeMenu}>Proyecto</a><a href="#guias" onClick={closeMenu}>Guías</a><a href={PROJECT_LINKS.support} target="_blank" rel="noopener noreferrer" className={styles.navSupport}><Coffee size={15} aria-hidden="true" /> Apoyar</a><a href={PROJECT_LINKS.download} className={styles.navDownload}><Download size={15} aria-hidden="true" /> Descargar</a></nav></div></header>
    <main id="contenido">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroGlow} aria-hidden="true" /><div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroCopy}><span className={styles.eyebrow}><i /> GRATIS · CÓDIGO ABIERTO · HECHO POR LAROC</span><h1 id="hero-title">Tu consulta.<br /><span>Tu espacio.</span></h1><p>Una agenda, tus expedientes y las notas de cada sesión. Todo en tu PC, con los colores que te gustan y el código disponible para quien quiera mejorarlo.</p><div className={styles.heroButtons}><a href={PROJECT_LINKS.download} className={styles.buttonPrimary}><Download size={19} aria-hidden="true" /> Descargar para Windows <ArrowUpRight size={17} aria-hidden="true" /></a><a href={PROJECT_LINKS.repository} className={styles.buttonSecondary}><Github size={19} aria-hidden="true" /> Ver el código</a></div><span className={styles.heroMeta}>Windows de 64 bits <span>·</span> Licencia MIT <span>·</span> Sin suscripción</span><a href="#aplicacion" className={styles.heroExplore}><span><ArrowDown size={16} aria-hidden="true" /></span> Conoce el programa</a></div>
        <div className={styles.heroProduct}><div className={styles.heroOrbit} aria-hidden="true" /><span className={styles.heroSticker} aria-hidden="true">abierto<br />por dentro ✳</span><ProductPreview /><span className={styles.heroSpark} aria-hidden="true">✳</span><div className={`${styles.floatingNote} ${styles.offlineNote}`}><span><WifiOff size={19} aria-hidden="true" /></span><div><strong>Disponible sin conexión</strong><small>Agenda y expedientes en tu PC.</small></div></div><div className={`${styles.floatingNote} ${styles.privacyNote}`}><ShieldCheck size={19} aria-hidden="true" /><span>Información guardada en tu equipo</span></div></div>
      </section>

      <div className={styles.principles} aria-label="Beneficios principales"><span><HardDrive size={20} aria-hidden="true" /> Instalación en Windows</span><span><WifiOff size={20} aria-hidden="true" /> Funciona sin conexión</span><span><Code2 size={20} aria-hidden="true" /> Código abierto</span><span><Heart size={20} aria-hidden="true" /> Apoyo voluntario</span></div>

      <section id="aplicacion" className={styles.section} aria-labelledby="app-title">
        <div className={styles.sectionHeading} data-reveal><div><span className={styles.kicker}>HERRAMIENTAS</span><h2 id="app-title">Entre sesión<br /><span>y sesión.</span></h2></div><p>Abre la agenda, retoma tus notas y encuentra ese documento. Un lugar para el trabajo que haces alrededor de la sesión.</p></div>
        <div className={styles.bento}>
          <article className={`${styles.bentoCard} ${styles.agendaCard}`} data-reveal><div className={styles.cardIcon}><CalendarDays size={25} aria-hidden="true" /></div><h3>Agenda de sesiones</h3><p>Define tu disponibilidad, agenda las sesiones y consulta el calendario por día, semana o mes.</p><div className={styles.calendarArt} aria-hidden="true"><div><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span></div><div className={styles.calendarCells}>{Array.from({length: 15}, (_, i) => <span key={i} className={[2, 7, 10].includes(i) ? styles.calendarBooked : ''}>{[2, 7, 10].includes(i) ? <><i />Sesión</> : ''}</span>)}</div></div><span className={styles.cardLabel}>AGENDA Y DISPONIBILIDAD</span></article>
          <article className={`${styles.bentoCard} ${styles.recordsCard}`} data-reveal><div className={styles.cardIcon}><FolderHeart size={25} aria-hidden="true" /></div><h3>Pacientes y expedientes</h3><p>Completa historias clínicas con plantillas y guarda las notas de cada sesión junto a los documentos del paciente.</p><div className={styles.recordArt} aria-hidden="true"><span><FileText size={17} /> Historia clínica <Check size={15} /></span><span><FileText size={17} /> Nota de sesión <Check size={15} /></span><span><FolderHeart size={17} /> Documentos <ChevronRight size={15} /></span></div><span className={styles.cardLabel}>PACIENTES Y EXPEDIENTES</span></article>
          <article className={`${styles.bentoCard} ${styles.paymentsCard}`} data-reveal><Wallet size={25} aria-hidden="true" /><h3>Cobros y pagos pendientes</h3><p>Registra los cobros de las sesiones y revisa los pagos pendientes.</p><span className={styles.cardLabel}>REGISTRO LOCAL</span></article>
          <article className={`${styles.bentoCard} ${styles.libraryCard}`} data-reveal><BookOpen size={25} aria-hidden="true" /><h3>Biblioteca</h3><p>Consulta tu catálogo y abre los libros y publicaciones instalados en el equipo.</p><span className={styles.cardLabel}>BIBLIOTECA Y LECTOR</span></article>
        </div>
        <details className={styles.realCapture}><summary><LayoutDashboard size={17} aria-hidden="true" /> Ver una captura real del programa <span aria-hidden="true">+</span></summary><figure><Image unoptimized src="/showcase/programa.webp" width={1440} height={940} sizes="(max-width: 600px) 100vw, 1200px" alt="Pantalla de inicio de EscuchaInterna para PC, con accesos a pacientes, agenda y biblioteca, en una instalación de prueba vacía." /><figcaption>Inicio del programa en una instalación de prueba, sin datos de pacientes.</figcaption></figure></details>
      </section>

      <section className={styles.controlSection} aria-labelledby="control-title"><div className={styles.controlCopy} data-reveal><span className={styles.kicker}>DATOS Y RESPALDOS</span><h2 id="control-title">Tu PC también<br /><span>es tu consulta.</span></h2><p>La consulta se guarda en la PC donde instalas el programa. Puedes crear respaldos para recuperar la información o trasladarla a otro equipo.</p><ul><li><Check size={18} aria-hidden="true" /><span><strong>Acceso local.</strong> Consulta y edita los expedientes sin conexión.</span></li><li><Check size={18} aria-hidden="true" /><span><strong>Respaldos con contraseña.</strong> Guarda una copia cifrada y restáurala cuando la necesites.</span></li><li><Check size={18} aria-hidden="true" /><span><strong>Conexiones opcionales.</strong> Configura correo, IA o Calendar si los necesitas.</span></li></ul></div><div className={styles.controlVisual} data-reveal><div className={styles.connectionLine} aria-hidden="true" /><div className={styles.deviceCard}><HardDrive size={34} aria-hidden="true" /><strong>Tu PC</strong><small>Consulta y archivos locales</small><span><ShieldCheck size={14} aria-hidden="true" /> Contenido clínico cifrado</span></div><div className={styles.driveCard}><Cloud size={25} aria-hidden="true" /><div><strong>Transferir a otra PC</strong><p>Google Drive para escritorio puede transferir las copias cifradas que creas desde el programa.</p><a href={`${PROJECT_LINKS.repository}/blob/main/docs/desktop-sync.md`}>Cómo funciona <ArrowUpRight size={14} aria-hidden="true" /></a></div></div><p className={styles.controlNote}>La transferencia se inicia desde la aplicación. Usa una PC a la vez para evitar versiones distintas de la consulta.</p></div></section>

      <section className={styles.receiptSection} aria-labelledby="receipt-title">
        <div data-reveal><span className={styles.kicker}>CONSENTIMIENTOS · DESDE LA 0.8.0</span><h2 id="receipt-title">Del formulario<br /><span>al expediente.</span></h2><p>El paciente sube el documento que ya firmó. Google lo deja en Drive y EscuchaInterna lo recibe en una bandeja para que lo revises.</p><a className={styles.textLink} href={PROJECT_LINKS.reception}>Configurar la recepción <ArrowUpRight size={17} aria-hidden="true" /></a></div>
        <ol className={styles.receiptFlow} aria-label="Cómo llega un consentimiento"><li data-reveal><span>01</span><FileText aria-hidden="true" /><strong>Google Forms</strong><small>Enlace con el código del paciente.</small></li><li data-reveal><span>02</span><Cloud aria-hidden="true" /><strong>Tu Drive</strong><small>El documento llega a una carpeta privada.</small></li><li data-reveal><span>03</span><FolderHeart aria-hidden="true" /><strong>Tu revisión</strong><small>Confirmas paciente, firma y fecha.</small></li></ol>
        <p className={styles.receiptNote}>La recepción funciona con el programa abierto y los archivos disponibles. Google recibe una copia legible; el programa cifra la copia que guarda en tu PC.</p>
      </section>

      <section id="apariencia" className={`${styles.section} ${styles.appearanceSection}`} aria-labelledby="appearance-title"><div className={styles.sectionHeading} data-reveal><div><span className={styles.kicker}>APARIENCIA</span><h2 id="appearance-title">Hay días de verde.<br /><span>Y noches de violeta.</span></h2></div><p>Hay seis paletas y modos día, noche y automático. También puedes reducir o desactivar las animaciones.</p></div><div className={styles.appearanceDemo} data-reveal><div className={styles.appearanceControls}><h3>Prueba los colores</h3><p>Elige una paleta y un modo para verlos en esta demostración.</p><div className={styles.swatches} role="group" aria-label="Paleta de la demostración">{PALETTES.map((theme, i) => <button type="button" key={theme.name} onClick={() => setPalette(i)} aria-label={theme.name} aria-pressed={palette === i} style={{ '--swatch': theme.color } as React.CSSProperties}><span>{palette === i ? <Check size={17} aria-hidden="true" /> : null}</span><small>{theme.name}</small></button>)}</div><div className={styles.modeSwitch} role="group" aria-label="Modo de la demostración"><button type="button" aria-pressed={!darkPreview} onClick={() => setDarkPreview(false)}><Sun size={16} aria-hidden="true" /> Día</button><button type="button" aria-pressed={darkPreview} onClick={() => setDarkPreview(true)}><Moon size={16} aria-hidden="true" /> Noche</button></div><div className={styles.appearanceTip}><Palette size={19} aria-hidden="true" /><span>Puedes cambiar el tema en<br /><strong>Configuración → Apariencia.</strong></span></div></div><div className={styles.themePreview}><ProductPreview palette={palette} dark={darkPreview} /></div></div></section>

      <section id="proyecto" className={styles.openSection} aria-labelledby="open-title"><div className={styles.openArtwork} aria-hidden="true"><span>{'{ '}</span><Heart size={74} strokeWidth={1.4} /><span>{' }'}</span><small>LICENCIA MIT</small></div><div data-reveal><span className={styles.kicker}>EL PROYECTO</span><h2 id="open-title">El código está abierto.<br />Las ideas, también.</h2><p>El código de EscuchaInterna está en GitHub con licencia MIT. Puedes revisarlo, modificarlo y contribuir con cambios. Si encuentras un error o necesitas una función, abre una propuesta en el repositorio.</p><div className={styles.contributionLinks}><a href={PROJECT_LINKS.repository}><Github size={18} aria-hidden="true" /> Explorar el repositorio <ArrowUpRight size={15} aria-hidden="true" /></a><a href={PROJECT_LINKS.issues}>Proponer una mejora <ArrowUpRight size={15} aria-hidden="true" /></a></div><div className={styles.openFacts}><span><Code2 size={15} aria-hidden="true" /> Repositorio público</span><a href={PROJECT_LINKS.license}>Licencia MIT <ArrowUpRight size={13} aria-hidden="true" /></a><span>Contribuciones bienvenidas</span></div></div></section>

      <section id="empezar" className={`${styles.section} ${styles.stepsSection}`} aria-labelledby="steps-title"><div className={styles.sectionHeading} data-reveal><div><span className={styles.kicker}>INSTALACIÓN</span><h2 id="steps-title">Descarga.<br /><span>Instala. Empieza.</span></h2></div><a href={PROJECT_LINKS.guide} className={styles.textLink}>Ver la guía de instalación <ArrowUpRight size={16} aria-hidden="true" /></a></div><ol className={styles.steps}><li data-reveal><span>01</span><Download size={24} aria-hidden="true" /><h3>Descarga el instalador</h3><p>Abre la página de versiones de GitHub y descarga el archivo .exe para Windows de 64 bits.</p></li><li data-reveal><span>02</span><HardDrive size={24} aria-hidden="true" /><h3>Instala y crea tu cuenta</h3><p>Ejecuta el archivo, abre EscuchaInterna y crea tu cuenta local.</p></li><li data-reveal><span>03</span><Heart size={24} aria-hidden="true" /><h3>Configura tu consulta</h3><p>Completa tu perfil, define los horarios de atención y guarda un primer respaldo.</p></li></ol></section>

      <section id="guias" className={styles.guideSection} aria-labelledby="guide-title"><div className={styles.sectionHeading} data-reveal><div><span className={styles.kicker}>A MANO</span><h2 id="guide-title">Una guía para usarlo.<br /><span>Otra para construirlo.</span></h2></div><p>Pasos concretos, capturas de ejemplo y lo que conviene saber antes de conectar servicios.</p></div><div className={styles.guideCards}><a href={PROJECT_LINKS.manual} className={styles.manualCard} data-reveal><BookOpen size={34} aria-hidden="true" /><span>PARA USUARIOS · PDF</span><h3>Tu primer día<br />con EscuchaInterna</h3><p>Instalación, pacientes, agenda, respaldo y recepción de documentos.</p><strong>Descargar el manual <ArrowDown size={18} aria-hidden="true" /></strong></a><a href={PROJECT_LINKS.aiGuide} className={styles.agentCard} data-reveal><Code2 size={34} aria-hidden="true" /><span>PARA AGENTES Y COLABORADORES</span><h3>Un mapa<br />del proyecto</h3><p>Arquitectura, comandos, verificación y configuración de Google sin exponer datos.</p><strong>Leer la guía en GitHub <ArrowUpRight size={18} aria-hidden="true" /></strong></a></div></section>

      <section id="preguntas" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title"><div><span className={styles.kicker}>AYUDA</span><h2 id="faq-title">Preguntas<br /><span>frecuentes.</span></h2><p>Instalación, conexiones y traslado de datos.</p></div><div className={styles.faqList}>{FAQ.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>

      <section id="apoyar" className={styles.supportSection} aria-labelledby="support-title"><div className={styles.coffeeArt} aria-hidden="true"><Coffee size={68} strokeWidth={1.4} /><Heart size={19} className={styles.coffeeHeart} /></div><div><span className={styles.kicker}>KO-FI DE LAROC</span><h2 id="support-title">Apoya el desarrollo</h2><p>Si usas EscuchaInterna y quieres apoyar el trabajo de Laroc, puedes hacer una aportación en Ko-fi.</p><span>La aportación es voluntaria y no desbloquea funciones.</span></div><a href={PROJECT_LINKS.support} target="_blank" rel="noopener noreferrer" className={styles.buttonCoffee}><Coffee size={19} aria-hidden="true" /> Apoyar en Ko-fi <ArrowUpRight size={17} aria-hidden="true" /></a></section>

      <section className={styles.finalSection} aria-labelledby="final-title"><span className={styles.eyebrow}><i /> EDICIÓN PARA WINDOWS</span><h2 id="final-title">Dale un lugar<br /><span>en tu escritorio.</span></h2><p>El instalador y las notas de cada versión están disponibles en GitHub.</p><a href={PROJECT_LINKS.download} className={styles.buttonPrimary}><Download size={19} aria-hidden="true" /> Descargar EscuchaInterna <ArrowUpRight size={17} aria-hidden="true" /></a><small>Para Windows de 64 bits · Gratis · Código abierto</small></section>
    </main>
    <footer className={styles.footer}><div className={styles.footerTop}><div><ProjectBrand /><p>Gestión de consulta para psicólogos.<br />Disponible para Windows.</p></div><div><strong>Programa</strong><a href={PROJECT_LINKS.download}>Descargar para Windows</a><a href={PROJECT_LINKS.releases}>Versiones y novedades</a><a href={PROJECT_LINKS.manual}>Manual de usuario PDF</a><a href={PROJECT_LINKS.aiGuide}>Guía para IA y colaboradores</a></div><div><strong>Comunidad</strong><a href={PROJECT_LINKS.repository}>GitHub</a><a href={PROJECT_LINKS.issues}>Errores y propuestas</a><a href={PROJECT_LINKS.support} target="_blank" rel="noopener noreferrer">Ko-fi de Laroc ↗</a></div><div><strong>Proyecto</strong><a href={PROJECT_LINKS.license}>Licencia MIT</a><a href="/legal/privacidad">Privacidad de la web</a><a href="/legal/terminos">Condiciones de uso</a></div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} EscuchaInterna · Código propio bajo licencia MIT</span><button type="button" aria-pressed={motionPaused} onClick={() => setMotionPaused(!motionPaused)}>{motionPaused ? <Play size={13} aria-hidden="true" /> : <span aria-hidden="true">Ⅱ</span>}{motionPaused ? 'Activar animaciones' : 'Pausar animaciones'}</button><a href="#">Volver arriba ↑</a></div></footer>
  </div>;
}
