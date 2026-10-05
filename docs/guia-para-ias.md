# Guía para agentes de IA y colaboradores

Esta guía describe EscuchaInterna para PC 0.8.0 y el showcase público. Está pensada para continuar el desarrollo, instalar una copia de prueba y ayudar a configurar Google con el usuario. El código actual y sus pruebas tienen prioridad sobre este documento.

## Empieza por el objetivo y la edición

Lee `AGENTS.md`, `README.md` y el documento de la función que vas a modificar. Distingue tres procesos:

- **Landing pública**: `src/components/showcase/OpenSourceShowcase.tsx` y `Showcase.module.css`. Se renderiza en `/` fuera del modo escritorio, sin consultar datos clínicos. Enlaces públicos en `src/components/project/projectLinks.ts`.
- **Aplicación de PC**: Electron abre un servidor Next local en un puerto loopback elegido al arrancar. `ESCUCHAINTERNA_DESKTOP=1` elimina gates comerciales; conserva sesiones, roles y aislamiento por dueño.
- **Integraciones de Google**: Drive para escritorio entrega archivos; Calendar usa OAuth del usuario; Forms usa un proyecto Apps Script del usuario. Conectar Google a tu agente no conecta la cuenta de Windows ni el programa.

No prometas un instalador de macOS/Linux, actualización automática, fusión entre PCs, firma electrónica verificada, publicación automática de Calendar ni mensajes enviados por adaptadores locales. Comprueba primero qué está implementado.

## Entorno limpio y comandos

Requisitos: Node.js 24, npm y Windows x64 para empaquetar el escritorio. En un checkout nuevo:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Para desarrollo web, copia `.env.example` a `.env.local` y configura valores propios. Nunca sobrescribas un `.env.local` que ya exista. `npm run dev` usa `.next`; el build web usa `.next-build`, mediante `scripts/next-isolated.mjs`. No ejecutes `npx next build` directamente con un servidor de desarrollo activo. Lee el puerto que devuelve Next, en vez de asumir 3000.

Para una copia de escritorio de prueba:

```powershell
npm run desktop:test
npm run desktop:build
npm run desktop:start
```

El constructor prepara `.desktop-build/resources` sin `.env`, bases operativas ni catálogos privados. Descarga Node desde la distribución oficial y comprueba su SHA-256. `desktop:start` puede abrir el espacio normal del usuario: para pruebas con operaciones sobre datos, usa los runners aislados siguientes, no una instalación real.

```powershell
npm run desktop:e2e
npm run desktop:pdf-smoke
npm run desktop:package
npm run desktop:smoke
```

El E2E usa datos ficticios y un espacio temporal. Revisa su `result.json`, las capturas y los errores de navegador. El smoke empaquetado requiere primero el build y el empaquetado. La primera instalación de Playwright puede necesitar `npx playwright install chromium`.

## Archivos que orientan el cambio

| Área | Punto de entrada |
| --- | --- |
| Ventana, servidor y menús nativos | `desktop/main.cjs`, `desktop/runtime.cjs` |
| Límites del puente nativo | `desktop/preload.cjs`, `desktop/security.cjs` |
| Respaldo y restauración | `desktop/storage.cjs` |
| Versiones cifradas en Drive | `desktop/synchronization.cjs`, `docs/desktop-sync.md` |
| Selector de carpeta de recepción | `desktop/consent-folder.cjs` |
| Bandeja de consentimientos | `src/app/(app)/consentimientos/`, `src/contexts/clinical-records/` |
| Revisión automática desde cualquier sección | `src/app/api/consentimientos/recepcion/route.ts` |
| Configurar Forms y su activador | `public/google-consent-reception.gs.txt` |
| Google Calendar | `docs/desktop-google-calendar.md`, `src/app/(app)/configuracion/google-calendar/` |
| Datos y migraciones | `src/shared/infrastructure/persistence/SqliteConnection.ts`, `migrations.ts` |
| Exportación pública desde un checkout privado | `scripts/export-open-source.mjs` |
| Manual PDF reproducible | `scripts/build-user-manual.py` |

Usa `rg` para localizar los símbolos antes de abrir muchos archivos. No deduzcas una ruta de datos de un nombre de usuario ni de una captura.

## Reglas al implementar

1. Contextos DDD en `src/contexts/<contexto>/{domain,application,infrastructure}`. Value objects en dominio, mensajes en aplicación y repositorios con interfaces de dominio.
2. Convierte los primitivos en la frontera una sola vez. Las server actions construyen mensajes y llaman casos de uso; no concentran reglas de negocio.
3. Todo dato operativo pertenece a `owner_user_id`. Comprueba sesión y rol en cada acceso y no confíes en IDs, códigos o rutas enviados por el navegador.
4. Añade una migración versionada para modificar el esquema. Nunca reescribas una migración ya publicada.
5. Conserva el modo local: las conexiones externas pasan por puertos y adaptadores, con errores sin secretos y límites de tiempo y volumen.
6. Componentes cliente solo importan tipos desde módulos que dependen de Node. Los archivos se sirven con `Readable.toWeb`, nunca casteando un `fs.ReadStream` a `Response`.
7. El renderer no recibe claves, contraseñas de respaldo ni acceso arbitrario al disco. El main process verifica emisor, frame, origen y ruta antes de IPC.
8. No restablezcas una base real para hacer pruebas. No cambies claves de cifrado existentes. Guarda una copia verificable antes de una actualización autorizada que afecte datos.

## Configurar recepción automática con Google

Consulta primero [el procedimiento completo](desktop-consent-reception.md). Este es el orden mínimo:

1. Confirma que estás trabajando en la cuenta Google seleccionada por el usuario y en su app instalada. Mantén el inicio de sesión, contraseñas y aprobaciones de permisos en su interfaz privada; no solicites secretos en un chat.
2. En Apps Script, pega **el script completo del repositorio**, sin envolverlo dentro de `myFunction`. Guarda y ejecuta `crearFormulario`.
3. El usuario revisa y autoriza los permisos de Google. Verifica que la ejecución terminó; anota la carpeta y el formulario de esa cuenta solo en su configuración local.
4. En el formulario, añade **una pregunta obligatoria Subir archivo**: PDF e imágenes, un archivo, máximo 10 MB. Conserva el campo Código de recepción. Comprueba que el formulario acepta respuestas y quién puede responder. No compartas públicamente la carpeta ni el resumen de respuestas.
5. Ejecuta `conectarRecepcion`. Verifica un activador **From form / On form submit / recibirConsentimiento**; comprueba el enlace prellenado con `entry.<id>=CODIGO`.
6. En Windows, inicia sesión en Drive para escritorio. En el programa, abre **Consulta → Consentimientos → Conectar carpeta** y selecciona la carpeta de recepción. Debe ser distinta de la carpeta con `.eichannel` y `.eisync` que contiene los respaldos cifrados.
7. Guarda el enlace prellenado en **Configurar la entrega con Google Forms**. Recarga la pantalla y comprueba que carpeta y enlace siguen guardados.
8. Desde un paciente, **Preparar recepción** genera su código y enlace. El código sugiere una asociación; no autentica al paciente ni verifica la firma.
9. Prueba con un paciente y un documento ficticios en una consulta de prueba. Diferencia «activador instalado», «recepción local probada» y «envío desde Forms comprobado»: una cosa no demuestra las otras.
10. Un archivo recibido permanece pendiente hasta que el profesional abre el original, confirma el paciente, indica la fecha de firma y marca la revisión. No archives automáticamente ni concedas autorización para IA a partir de un PDF genérico.

Google requiere una cuenta para subir archivos. Forms y Drive conservan archivos legibles; EscuchaInterna cifra la copia local. Con la app cerrada Google puede recibir respuestas, pero la importación local espera al programa abierto, sesión activa y archivo disponible. `recuperarRecepciones` reintenta las últimas veinte respuestas; verifica los errores del activador antes de ejecutarlo y conserva originales.

## Drive y Calendar son flujos distintos

**Transferir la consulta**: publicar una versión cifrada, esperar a Drive y recibirla en la otra PC. Se reemplaza el espacio completo, incluidas cuentas y claves, con conservación de la copia anterior. No combina cambios. Trabajar en una PC a la vez. Los catálogos se instalan aparte. Nunca copies SQLite abierto directamente a Drive.

**Calendar**: registrar un cliente OAuth de aplicación de escritorio, habilitar Calendar API e importar su JSON en el programa. La autorización vuelve al loopback de esa instalación. Publica horarios genéricos en un calendario secundario y revisa ocupación del calendario principal. No necesita una cuenta de servicio, una API key ni un cliente web. No publiques nombres ni contenido clínico en los eventos. No reutilices un cliente, token o proyecto personal del mantenedor como configuración por defecto.

## Publicar sin filtrar datos

- Trabaja con capturas y documentos ficticios. Nunca subas una pantalla de expedientes reales para demostrar una corrección.
- No versionar `.env`, claves, DB/WAL/SHM, `uploads`, respaldos, canales Drive, clientes OAuth, tokens ni catálogos sin licencia de redistribución.
- En un checkout privado, `node scripts/export-open-source.mjs --refresh` prepara `.open-source-publish` conservando su Git y copiando solo fuentes permitidas. Revisa **allí** el diff y el status. Publica ese historial público; no añadas un remote público al historial privado ni empujes sus commits.
- En un clon que ya es público, contribuye mediante una rama y PR en ese repositorio. No necesitas una segunda exportación.
- La landing enlaza al instalador publicado. Cambiar una URL no crea una versión: empaqueta, verifica y sube el instalador antes de anunciarla.
- Para Hostinger, genera un ZIP desde una revisión limpia y verificada, mediante `npm run empaquetar:hostinger`. El ZIP contiene fuentes versionadas, no `.env`. Revisa el inventario antes de subirlo. Conserva variables y rutas persistentes; no resetees la base ni vuelvas a sembrar datos para cambiar una landing. Comprueba el despliegue y el dominio público: un build local o un push no equivalen a una web publicada.

## Lista de cierre

Ejecuta typecheck, tests y build. Si cambia UI pública, `node scripts/showcase-smoke.mjs` comprueba tamaño móvil, navegación, temas, movimiento reducido, contenido sin JavaScript y enlaces del manual. Si cambia el escritorio o su seguridad, añade sus runners correspondientes. Revisa el PDF renderizado, no solo el texto extraído.

En la entrega, separa lo implementado, lo instalado, lo publicado y lo probado con Google real. Nombra los pasos que aún requieren al usuario o acceso externo. Nunca conviertas una advertencia de permisos o una tarea pendiente en una afirmación de éxito.

Para regenerar el manual: instala `reportlab` y `pypdf` en tu entorno Python y ejecuta `python scripts/build-user-manual.py`. El resultado es `output/pdf/manual-escuchainterna.pdf`; el script comprueba las diez páginas y copia el archivo a `public/manual-escuchainterna.pdf`. Renderiza las páginas y revisa cortes, enlaces y legibilidad antes de publicar. La captura utilizada es ficticia y está versionada; no la sustituyas por una consulta real.

Referencias del proyecto: [manual de usuarios](../public/manual-escuchainterna.pdf), [contribución](../CONTRIBUTING.md), [seguridad](../SECURITY.md), [recepción](desktop-consent-reception.md), [sincronización](desktop-sync.md), [Calendar](desktop-google-calendar.md).
