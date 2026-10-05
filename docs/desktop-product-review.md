# Revisión de uso diario en PC · 0.6.0

## Criterio

Dar prioridad a la consulta del día y a las acciones frecuentes. Mantener las capacidades existentes y los permisos; reducir avisos repetidos y recorridos innecesarios. Esta revisión se apoya en el código y en flujos reproducibles con datos ficticios.

## Lo que sobraba

- La bienvenida promocional al abrir el programa con una sesión ya válida. Ahora se resuelve el destino por rol y estado de onboarding; una instalación sin sesión conserva la bienvenida.
- El panel expandido de primeros pasos por encima de la agenda diaria. En PC queda debajo, desplegable, con solo pasos pendientes; el progreso y la opción de ocultarlo se conservan.
- El botón flotante de IA repetía el acceso del menú y ocupaba parte del lector. En PC queda el acceso de la sección.
- El menú daba el mismo peso a consulta diaria y comunicación ocasional. Comunicación se despliega y se abre al entrar en Mensajes o Marketing. Los enlaces siguen en Ctrl+K.
- La explicación técnica extensa encima de cada visita al catálogo. Queda en un desplegable y en Ayuda.

## Lo que faltaba y se añadió

- Acciones frecuentes siempre visibles en Inicio: Nuevo paciente, Agenda de hoy y Biblioteca. El buscador también ofrece acciones a los roles que ya disponen de sus secciones.
- Guía concreta para el programa de PC: trabajar sin red, crear y recuperar respaldos, recibir/publicar versiones de Drive, instalar libros, servicios con claves propias y atajos.
- Tutoriales adaptados a PC: registro local de citas y pagos, proveedor propio para enviar correo y diferencia entre un registro pendiente y un envío real. Se retiran promesas de reservas públicas y automatismos de la web en la edición local. F1 abre la guía desde el menú nativo.
- Un regreso del lector que conserve título, categoría y página. Los destinos se construyen únicamente dentro del catálogo, sin aceptar URLs de retorno externas.
- Corrección de páginas fuera del rango, unidades legibles para archivos pequeños y un nombre coherente de Servicios opcionales dentro de Configuración.
- Ctrl+K desde el menú móvil cerrado: el diálogo se monta fuera de la región `inert`. Se conservan Escape, Tab y retorno de foco.
- El enlace «Tu consulta» de la ubicación usa el destino del rol asistente, recepción o supervisión cuando corresponde.

## Verificación

Tipos, suite unitaria, compilación web y de escritorio, pruebas nativas y smoke del instalador. El E2E comprueba entrada con sesión, acciones de Inicio, guía plegada, comunicación, ayuda, regreso con filtros/página y búsqueda con el menú móvil cerrado. Conserva las comprobaciones de seis paletas, contraste, lector sin red, cifrado y aislamiento por dueño. El smoke PDF confirma el visor nativo con un archivo ficticio.

## Prioridades que siguen pendientes

La sincronización publica y recibe versiones completas de forma manual; no combina cambios clínicos. Los recordatorios dependen de que el programa esté abierto. Una actualización automática requeriría distribuir y verificar versiones firmadas. Estas capacidades requieren trabajo específico y no se anuncian como disponibles en esta entrega.
