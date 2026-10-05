"""Manual público reproducible. Requiere reportlab y pypdf; no lee datos de la app."""
from pathlib import Path
import shutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "manual-escuchainterna.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT = A4
W = WIDTH - 88
INK = colors.HexColor("#252b36")
GREEN = colors.HexColor("#254f3d")
PURPLE = colors.HexColor("#6b43b2")
LIME = colors.HexColor("#dcef70")
CORAL = colors.HexColor("#ffc2ad")
LILAC = colors.HexColor("#e3d8f7")
BLUE = colors.HexColor("#ccecf7")
PAPER = colors.HexColor("#fff9ee")
styles = {
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, leading=16, textColor=INK, spaceAfter=10),
    "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=30, leading=34, textColor=GREEN, spaceAfter=16),
    "sub": ParagraphStyle("sub", fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=PURPLE, spaceBefore=13, spaceAfter=9),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, leading=13, textColor=colors.HexColor("#565761"), spaceAfter=8),
    "cover": ParagraphStyle("cover", fontName="Helvetica-Bold", fontSize=51, leading=53, textColor=GREEN, spaceAfter=22),
    "intro": ParagraphStyle("intro", fontName="Helvetica", fontSize=14, leading=21, textColor=INK, spaceAfter=20),
    "step": ParagraphStyle("step", fontName="Helvetica", fontSize=10.5, leading=16, textColor=INK, leftIndent=24, firstLineIndent=-24, spaceAfter=11),
}
story = []

def p(text, style="body"):
    return Paragraph(text, styles[style])

def add(text, style="body"):
    story.append(p(text, style))

def page(title, intro):
    story.append(PageBreak())
    add(title, "title")
    add(intro)

def steps(items):
    for i, text in enumerate(items, 1):
        story.append(p(f'<b>{i:02d}.</b>  {text}', "step"))

def box(title, text, color=LIME):
    t = Table([[p(title, "sub")], [p(text)]], colWidths=[W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), .4, colors.HexColor("#c4c4b9")),
        ("LEFTPADDING", (0, 0), (-1, -1), 16), ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (-1, 0), 7), ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
    ]))
    story.extend([Spacer(1, 9), t, Spacer(1, 15)])

def table(rows, widths):
    t = Table([[p(a), p(b)] for a, b in rows], colWidths=widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (0, -1), LILAC),
        ("LINEBELOW", (0, 0), (-1, -1), .5, colors.HexColor("#ddd8cd")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t)

def frame(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, WIDTH, HEIGHT, stroke=0, fill=1)
    if doc.page == 1:
        canvas.setFillColor(LIME)
        canvas.circle(WIDTH - 26, HEIGHT - 66, 105, stroke=0, fill=1)
        canvas.setFillColor(CORAL)
        canvas.circle(WIDTH - 15, 40, 116, stroke=0, fill=1)
        canvas.setFillColor(LILAC)
        canvas.circle(12, 55, 57, stroke=0, fill=1)
    else:
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(GREEN)
        canvas.drawString(44, HEIGHT - 35, "ESCUCHAINTERNA / MANUAL DE USO")
        canvas.setFillColor([LIME, CORAL, LILAC, BLUE][(doc.page - 2) % 4])
        canvas.roundRect(WIDTH - 98, HEIGHT - 45, 54, 19, 9, stroke=0, fill=1)
        canvas.setFillColor(INK)
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(WIDTH - 71, HEIGHT - 38, "PC 0.8.0")
    canvas.setStrokeColor(colors.HexColor("#d7d3c7"))
    canvas.line(44, 43, WIDTH - 44, 43)
    canvas.setFillColor(colors.HexColor("#565761"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(44, 29, "escuchainterna.com  |  Octubre 2026")
    canvas.drawRightString(WIDTH - 44, 29, f"{doc.page:02d} / 10")
    canvas.restoreState()

story.append(Spacer(1, 43))
add("ESCUCHAINTERNA PARA WINDOWS", "small")
add("Tu consulta.<br/>Tu espacio.", "cover")
add("Manual de usuario", "sub")
add("Una guía para instalar el programa, organizar tu consulta y recibir documentos desde Google.", "intro")
box("Edición 0.8.0", "Windows de 64 bits. Programa gratuito con código propio bajo licencia MIT. Captura de una instalación de prueba, sin datos reales de pacientes.", BLUE)
add("Encuentra lo que necesitas", "sub")
table([
    ("02 / Primer día", "Instalación, cuenta local y primer respaldo."),
    ("03 / Moverte", "Menú, búsqueda, atajos y temas."),
    ("04-05 / Tu consulta", "Pacientes, expediente, agenda y pagos."),
    ("06-07 / Documentos y PCs", "Recepción de consentimientos y versiones en Drive."),
    ("08-09 / Opcionales", "Calendar, correo, IA y biblioteca local."),
    ("10 / Ayuda", "Problemas habituales y enlaces útiles."),
], [165, W - 165])

page("Tu primer día", "El instalador incluye los componentes del programa. Para usarlo no necesitas instalar Node.js ni administrar una base de datos.")
steps([
    '<b>Descarga.</b> Abre <link href="https://github.com/er3system/escuchainterna-desktop/releases" color="#6b43b2">las versiones de GitHub</link>. Elige el archivo <b>EscuchaInterna-0.8.0-Windows-x64.exe</b> o una versión posterior publicada. Comprueba las notas de esa versión.',
    '<b>Instala y abre.</b> Ejecuta el instalador y elige la carpeta. Abre EscuchaInterna desde el acceso del escritorio o el menú Inicio de Windows.',
    '<b>Crea tu cuenta local.</b> En una instalación nueva, introduce tus datos y una contraseña. Puedes elegir <b>Solo en esta PC</b> o preparar Drive. El programa no cobra una suscripción.',
    '<b>Si vienes de otra PC.</b> Usa <b>Continuar desde otra PC</b> y recibe la consulta antes de crear otra cuenta. Luego inicia sesión con la cuenta que ya tenías.',
    '<b>Completa tu perfil.</b> En Configuración revisa tus datos profesionales y en Agenda define la disponibilidad. Añade un paciente de prueba para familiarizarte con el expediente.',
    '<b>Guarda una copia.</b> Usa <b>Archivo - Crear respaldo cifrado</b>. Conserva el archivo y su contraseña en lugares seguros.',
])
box("Tu cuenta pertenece a esta instalación", "La sesión de Google, la cuenta de la web y la cuenta local de EscuchaInterna son distintas. Conectar Drive para escritorio no crea una cuenta dentro del programa.", LILAC)
add("Antes de actualizar", "sub")
add("Cierra el programa, conserva un respaldo y ejecuta el instalador nuevo. Las actualizaciones se descargan desde GitHub; la edición actual no instala versiones automáticamente. No borres la carpeta de datos para actualizar.")

page("Encuentra tu sitio", "El menú agrupa las tareas de consulta, los recursos y la configuración del programa. Usa la búsqueda si prefieres ir directo a una sección.")
shot = ROOT / "public" / "showcase" / "manual-inicio.png"
story.append(Image(str(shot), width=W, height=W * 940 / 1440))
story.append(Spacer(1, 9))
add("Inicio de una consulta ficticia. La disposición puede variar con la versión y el tamaño de la ventana.", "small")
table([
    ("<b>Ctrl+K</b>", "Busca secciones y acciones, como Nuevo paciente."),
    ("<b>Tab / Enter / Esc</b>", "Recorre controles, abre una acción y cierra diálogos."),
    ("<b>Ctrl+P</b>", "Abre el diálogo de impresión; elige guardar como PDF si lo necesitas."),
    ("<b>Apariencia</b>", "Elige Día, Noche o Automático; Bosque, Salvia, Jardín, Océano, Lavanda o Terracota. Ajusta las animaciones."),
], [145, W - 145])

page("Pacientes y expediente", "El expediente reúne la información del paciente. Guarda cada formulario antes de cambiar de pantalla o publicar una versión para otra PC.")
steps([
    '<b>Crea el paciente.</b> Desde Inicio usa Nuevo paciente, o abre Pacientes. Completa los datos de contacto y guarda. Revisa los posibles duplicados antes de crear otro registro.',
    '<b>Abre su expediente.</b> En Pacientes, selecciona la persona. Desde ahí accedes al resumen, sesiones, historia clínica, documentos y otras herramientas disponibles.',
    '<b>Inicia la historia.</b> Elige la plantilla apropiada en Historia clínica y completa sus campos. Puedes configurar plantillas desde Configuración.',
    '<b>Registra una sesión.</b> Guarda las notas desde la sección Sesiones del paciente. Distingue lo que ocurrió en esa sesión de los datos generales de la historia.',
    '<b>Añade documentos.</b> Usa Archivos para los adjuntos del paciente. Comprueba que estás en el expediente correcto antes de subirlos.',
    '<b>Revisa consentimientos.</b> La recepción automática tiene una bandeja propia. La firma y la fecha se revisan antes de archivar; consulta la página 06.',
    '<b>Exporta cuando lo necesites.</b> Usa la sección Exportar del expediente y revisa la vista antes de imprimir o guardar un PDF.',
])
box("Cada cuenta ve sus datos", "Los permisos dependen del rol. Un asistente de recepción puede ayudar con contacto, agenda y pagos, pero no accede al contenido clínico ni a la bandeja de consentimientos.", LIME)
add("Los catálogos externos", "sub")
add("El instalador público no incluye libros ni el catálogo CIE-11. Si instalas estos contenidos, comprueba su procedencia y las condiciones de uso. El código MIT no convierte las publicaciones externas en material de libre distribución.")

page("Agenda y pagos", "La agenda local conserva las sesiones en tu PC. Puedes trabajar sin conexión; los servicios de Google y los envíos reales requieren internet.")
add("Prepara tu agenda", "sub")
steps([
    '<b>Define horarios.</b> Abre Agenda y su configuración. Crea o selecciona una agenda, completa la disponibilidad y guarda los cambios.',
    '<b>Añade una sesión.</b> Selecciona paciente, fecha, hora y los demás datos que pida el formulario. Comprueba que aparece en el calendario después de guardar.',
    '<b>Consulta el día o la semana.</b> Cambia la vista del calendario y abre una sesión para revisar o modificar sus datos.',
    '<b>Revisa los cambios.</b> Tras mover o cancelar una cita, comprueba el calendario local. Si usas Google Calendar, vuelve a publicar los horarios desde su configuración.',
])
add("Registra lo cobrado", "sub")
add("En Pagos puedes consultar los cobros y pendientes de las sesiones. Abre el registro correspondiente, indica el pago y revisa el estado resultante. Los recibos del programa son registros de consulta; un estado local no demuestra que un banco o una pasarela haya procesado dinero.")
box("Mensajes que se quedan en el programa", "Sin un proveedor de correo, los mensajes locales no se envían. Revisa Mensajes y el estado del envío. Los recordatorios locales requieren la app abierta. WhatsApp, Meet y cobros automáticos no tienen adaptadores de escritorio implementados.", CORAL)
add("Calendar tiene su propio panel", "sub")
add("Agenda enlaza a Google Calendar dentro del programa. Conectar Calendar publica horarios genéricos en un calendario secundario y permite revisar coincidencias con el calendario principal. La agenda local sigue siendo la fuente de esos horarios.")

page("Recibir consentimientos", "Flujo: el paciente entrega el documento firmado, Google lo copia a Drive y el programa lo recibe para tu revisión. Forms no realiza ni verifica la firma electrónica.")
steps([
    '<b>Prepara Google una vez.</b> Usa el script del repositorio en tu cuenta de Apps Script. Ejecuta crearFormulario, añade una pregunta obligatoria Subir archivo y ejecuta conectarRecepcion. La guía enlazada abajo explica cada paso.',
    '<b>Conecta la carpeta.</b> En Consulta - Consentimientos, selecciona la carpeta privada de recepción. Si está en Drive, usa Drive para escritorio y procura que sus archivos estén disponibles sin conexión. Mantén esta carpeta separada de los respaldos cifrados.',
    '<b>Guarda el formulario.</b> Pega el enlace prellenado que muestra el script en Configurar la entrega con Google Forms. Debe llevar CODIGO como valor del campo de recepción.',
    '<b>Prepara el enlace del paciente.</b> Abre su consentimiento y pulsa Preparar recepción. Copia el enlace generado y entrégalo por tu canal habitual. Copiarlo no envía un mensaje.',
    '<b>Espera la llegada.</b> El paciente sube el documento que ya firmó. La app revisa cada 30 segundos mientras está abierta y la sesión está activa. Puedes usar Revisar ahora.',
    '<b>Revisa y archiva.</b> Abre el original, confirma el paciente y la fecha de firma, marca la revisión y pulsa Confirmar y archivar. Se crea un consentimiento nuevo y se conserva el original.',
])
box("Un código no prueba identidad ni firma", "El enlace sugiere un paciente; puede modificarse. Un documento genérico tampoco autoriza el uso de IA. Google conserva una copia legible y EscuchaInterna cifra la copia local.", LILAC)
add("PDF, PNG, JPG o WebP: hasta 20 MiB en la recepción local. Configura Forms con un archivo de máximo 10 MB. Los duplicados por contenido no vuelven a importarse. Descartar retira un pendiente y conserva su historial.", "small")
add('<link href="https://github.com/er3system/escuchainterna-desktop/blob/main/docs/desktop-consent-reception.md" color="#6b43b2">Guía completa de Google Forms y recepción</link>. Para subir archivos, Google exige iniciar sesión. <link href="https://support.google.com/docs/answer/15473134?hl=es" color="#6b43b2">Ayuda oficial de Google Forms</link>.', "small")

page("Continuar en otra PC", "Drive transporta versiones cifradas de la consulta. El traslado se inicia desde EscuchaInterna; no fusiona ediciones hechas en dos equipos.")
steps([
    '<b>Instala Drive para escritorio.</b> Inicia sesión en Google y crea una carpeta exclusiva para versiones de la consulta, distinta de la recepción de documentos.',
    '<b>Conecta las dos PCs.</b> En Sincronización selecciona la misma carpeta y usa la misma contraseña de cifrado, de al menos 12 caracteres. Esta contraseña es distinta de las cuentas de Google y del programa.',
    '<b>Publica desde la PC actual.</b> Guarda primero los formularios. Pulsa Publicar cambios y espera a que Drive termine de subir la versión.',
    '<b>Recibe antes de trabajar en la otra PC.</b> Espera a que Drive descargue, actualiza el estado y recibe la versión seleccionada. Revisa la confirmación: reemplaza el espacio local completo.',
    '<b>Cambia de equipo con el mismo orden.</b> Guarda, publica, espera a Drive y recibe. Si aparecen ramas o versiones divergentes, detente y elige cuál conservar tras revisar los cambios.',
])
box("Qué viaja con la consulta", "Todas las cuentas, datos operativos, adjuntos y claves de servicios de esa instalación. Quien restaure con la contraseña tendrá acceso a ellos. Los catálogos de lecturas se instalan aparte y las preferencias visuales se guardan por equipo.", BLUE)
add("Conserva un respaldo independiente", "sub")
add("Archivo - Crear respaldo cifrado guarda una copia que puedes trasladar y restaurar. El límite actual del espacio es 256 MiB antes de comprimir. Mantén la contraseña fuera del archivo. Al recibir una versión, el programa conserva la consulta anterior para recuperación; aun así, revisa la selección antes de reemplazar.")
add('<link href="https://github.com/er3system/escuchainterna-desktop/blob/main/docs/desktop-sync.md" color="#6b43b2">Guía de sincronización y recuperación</link>. No borres archivos sueltos de la carpeta de versiones: la historia del canal los necesita.', "small")

page("Servicios que eliges tú", "Las conexiones son opcionales. En Servicios opcionales puedes configurar los proveedores que necesitas con tus propias credenciales.")
table([
    ("<b>Google Calendar</b>", "Requiere Calendar API y un cliente OAuth de Aplicación de escritorio registrado en Google Cloud. Importa su JSON, autoriza y publica los horarios manualmente. No usa una API key."),
    ("<b>Resend</b>", "Envía correo con tu clave API y un remitente de un dominio verificado. Revisa el resultado en Mensajes; configurar una clave no confirma saldo ni envío."),
    ("<b>OpenAI</b>", "La clave API activa el chat del asistente. La suscripción de ChatGPT no incluye la API. Las herramientas clínicas no se activan con esta clave."),
    ("<b>Anthropic</b>", "Puede activar chat y herramientas clínicas. Requiere tu clave y la autorización necesaria para el tratamiento de datos que indiquen las pantallas."),
], [130, W - 130])
story.append(Spacer(1, 14))
box("Revisa qué datos salen de la PC", "Un servicio externo requiere conexión y puede cobrar en tu cuenta. Lee la información de la pantalla antes de habilitarlo. Las claves se cifran localmente y viajan dentro de los respaldos cifrados; evita compartirlos con quien no deba usar esos servicios.", CORAL)
add("Qué hace Calendar", "sub")
add("Publica eventos privados llamados Sesión de consulta, sin nombres, notas ni invitados. Revisa ocupación del calendario principal. No importa las modificaciones que hagas en Google ni se ejecuta con la app cerrada. Desconectar elimina los tokens de esa consulta; conserva los eventos ya publicados.")
add('<link href="https://github.com/er3system/escuchainterna-desktop/blob/main/docs/desktop-google-calendar.md" color="#6b43b2">Configuración y alcance de Google Calendar</link>.', "small")

page("Lecturas y trabajo local", "Puedes instalar tus catálogos y abrir las lecturas disponibles en esta PC. El instalador público distribuye el programa, no una colección de libros.")
steps([
    '<b>Abre la ubicación.</b> Usa Archivo - Abrir carpeta de catálogos. Trabaja en esa carpeta, no dentro de la instalación del ejecutable.',
    '<b>Copia tus libros.</b> Pon los archivos autorizados dentro de biblioteca. Conserva su organización por carpetas y evita renombrarlos durante la indexación.',
    '<b>Actualiza el índice.</b> Reinicia el programa, abre Biblioteca - Libros de esta PC y pulsa Actualizar índice. Después busca y abre una lectura.',
    '<b>Instala el catálogo en cada PC.</b> Las versiones de la consulta conservan índices y favoritos, pero no descargan los libros. Si cambias de equipo, copia esos archivos aparte.',
])
box("Cuando no hay internet", "Puedes usar agenda, pacientes, expediente, pagos y lecturas instaladas. Las operaciones que dependen de Google, correo o IA de un proveedor esperan a una conexión disponible. Un libro que Drive solo muestra como remoto necesita descargarse para leerlo sin conexión.", LIME)
add("Comprobar un envío es parte del trabajo", "sub")
add("Revisa el estado en Mensajes después de pedir un envío real. Sin proveedor, un registro local no es un correo entregado. Los recordatorios requieren la aplicación abierta y las automatizaciones de Marketing se revisan al entrar a esa sección; no hay un servicio permanente de Windows que trabaje con el programa cerrado.")
add("Código y contenido tienen licencias distintas", "sub")
add("MIT cubre el código propio de EscuchaInterna. Cada libro, publicación, dataset y dependencia conserva sus condiciones. Instala solo contenidos que puedas usar y no incluyas catálogos privados al compartir una copia del proyecto.")

page("Si algo no aparece", "Empieza por comprobar la sección, la cuenta local y los archivos disponibles. Estos pasos ayudan a distinguir un problema de configuración de uno del programa.")
table([
    ("No llega el consentimiento", "Mantén app y sesión abiertas. Revisa Drive y usa Revisar ahora. Confirma carpeta correcta, activador recibirConsentimiento y errores en Apps Script. El archivo debe estar estable en dos revisiones."),
    ("Forms pide una cuenta", "La subida de archivos exige iniciar sesión en Google. Puedes recibir el documento por otro canal y colocarlo en la carpeta local de recepción."),
    ("No encuentro un paciente", "Comprueba la cuenta y los filtros. No crees un duplicado hasta revisar. Los roles tienen accesos diferentes."),
    ("Otra PC muestra datos antiguos", "Publica desde el equipo con los cambios, espera a Drive y recibe esa versión en el destino. No edites en ambas PCs a la vez."),
    ("El correo no sale", "Comprueba Resend, remitente verificado, internet y el estado en Mensajes. Las entradas del modo local permanecen sin enviar."),
    ("No abre un libro", "Comprueba que el archivo existe en los catálogos de esta PC y actualiza el índice. Un favorito no descarga la lectura."),
], [156, W - 156])
add("Ayuda y comunidad", "sub")
add('<link href="https://escuchainterna.com" color="#6b43b2">Web del proyecto</link>  /  <link href="https://github.com/er3system/escuchainterna-desktop/releases" color="#6b43b2">Descargas</link>  /  <link href="https://github.com/er3system/escuchainterna-desktop/issues" color="#6b43b2">Errores y propuestas</link>  /  <link href="https://ko-fi.com/laroc" color="#6b43b2">Ko-fi de Laroc</link>')
add("Al reportar un problema, indica versión, Windows, acción, resultado y mensaje de error. Usa datos ficticios. Revisa las capturas para quitar nombres, correos, expedientes, claves y rutas privadas antes de publicarlas.", "small")
add("Este manual describe el uso del programa. La revisión del documento y las decisiones clínicas permanecen a cargo del profesional. Las notas de cada versión informan cambios y límites posteriores a la 0.8.0.", "small")

doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=68, bottomMargin=61,
                        title="EscuchaInterna para PC - Manual de usuario 0.8.0", author="EscuchaInterna / Laroc",
                        subject="Instalación, consulta local, Google y recepción de consentimientos", invariant=1)
doc.build(story, onFirstPage=frame, onLaterPages=frame)
reader = PdfReader(str(OUT))
if len(reader.pages) != 10:
    raise RuntimeError(f"El manual debe tener 10 páginas; tiene {len(reader.pages)}. Revisa el diseño.")
text = "\n".join(page.extract_text() or "" for page in reader.pages)
for expected in ["Tu primer día", "Consentimientos", "recibirConsentimiento", "256 MiB", "Ko-fi", "0.8.0"]:
    if expected.lower() not in text.lower():
        raise RuntimeError(f"Falta contenido: {expected}")
shutil.copyfile(OUT, ROOT / "public" / "manual-escuchainterna.pdf")
print(f"Manual verificado: {OUT} ({len(reader.pages)} páginas, {OUT.stat().st_size} bytes)")
