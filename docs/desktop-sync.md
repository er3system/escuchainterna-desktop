# Sincronización cifrada con Google Drive

Disponible desde la versión 0.3.0 de Windows. Es una transferencia explícita de versiones completas entre instalaciones, a través de Google Drive para escritorio. No mantiene dos bases SQLite abiertas en la nube ni fusiona pacientes o notas campo por campo.

## Uso

Desde 0.4.0 puedes elegir **Preparar Google Drive** al registrarte. Primero se crea la cuenta local y luego se abre el asistente de sincronización, con la opción de continuar al perfil y configurarlo después. Si la consulta ya existe en Drive, usa **Traerla antes de registrarme**; recibir el espacio completo incluye sus cuentas existentes. Esta opción no es un inicio de sesión con Google en EscuchaInterna.

La pantalla comprueba solo los puntos de montaje `A:\\My Drive` / `A:\\Mi unidad` y sus equivalentes por letra en Windows; no accede a tokens ni configuración privada de Google. Si hay un único punto de montaje, el selector empieza allí. Las carpetas reflejadas o ubicaciones personalizadas se eligen manualmente. Encontrar una carpeta no acredita una entrega a la nube.

Si conectaste una carpeta local por error, **Archivo → Preparar carpeta en Mi unidad** copia exclusivamente la historia cifrada a `Mi unidad/EscuchaInterna`, conserva la carpeta original y reutiliza la contraseña protegida en Windows. Exige una única Mi unidad detectada y una carpeta vacía o con exactamente los mismos archivos cifrados; nunca sobrescribe versiones ajenas. Luego marca la carpeta disponible sin conexión y publica los cambios.

Las claves personales de Resend, OpenAI y Anthropic también forman parte de las versiones cifradas del espacio. Quien restaure la consulta con la contraseña podrá usar sus servicios; desconecta y revoca las claves si necesitas retirar ese acceso.

1. Instala Google Drive para escritorio y crea una carpeta exclusiva, por ejemplo `Mi unidad/EscuchaInterna`. Usa una carpeta reflejada o marca la carpeta como **Disponible sin conexión** en ambas PCs. Espera a que Drive termine de descargar sus archivos.
2. Abre **Configuración → Sincronización con Drive** o **Archivo → Sincronización con Google Drive**. Selecciona la carpeta y elige una contraseña de al menos 12 caracteres. En la otra PC usa la misma carpeta y contraseña. No es tu contraseña de Google ni la de inicio de sesión de EscuchaInterna.
3. En la primera PC, guarda los formularios y pulsa **Publicar cambios**. La app detiene brevemente el servidor, comprueba SQLite y escribe una versión cifrada. Google Drive realiza la subida; espera a que su estado indique que terminó.
4. En la otra PC, espera a Drive, pulsa **Actualizar estado** y **Recibir versión seleccionada** antes de trabajar. En una instalación vacía usa **Continuar desde otra PC** en la bienvenida; no necesitas crear otra cuenta. Inicia sesión con la cuenta de la consulta recibida.
5. Al cambiar de equipo, repite publicar, esperar a Drive y recibir. Conserva también respaldos independientes desde el menú Archivo.

La sincronización incluye **todas las cuentas, datos operativos, archivos adjuntos y claves de esta instalación**. No es una exportación de un único profesional ni un permiso de acceso para colaboradores. El límite actual es 256 MiB de datos antes de comprimir. Las preferencias visuales se guardan por equipo.

## Cambios en dos PCs y recuperación

Cada publicación crea un archivo nuevo con identificador único. Si las PCs publican mientras Drive aún no ha entregado la otra versión, ambas quedan como ramas de la historia. EscuchaInterna detecta esas versiones divergentes cuando los archivos llegan; bloquea una nueva publicación hasta elegir una versión para continuar.

Al recibir, el diálogo nativo informa que se sustituirá el espacio completo. La consulta local anterior se conserva junto a `workspace`, en `workspace.previous-<fecha>`, incluidas sus claves protegidas por Windows. Si hay varias ramas, la recepción escribe una resolución que señala a las versiones inspeccionadas; los archivos anteriores permanecen en Drive. No se borran ni fusionan expedientes automáticamente. Los cambios de la versión descartada requieren revisión manual y un traslado explícito de la información necesaria.

Un archivo incompleto, una contraseña incorrecta, un padre todavía no descargado o un fallo de integridad detienen la operación. Si falla el reinicio después de restaurar, se intenta recuperar la consulta anterior y se mantienen las carpetas para recuperación. Desconectar una PC elimina solo su configuración local de sincronización.

No elimines archivos individuales de la carpeta: las versiones posteriores necesitan su historia. Al llegar a 1.000 versiones, conserva la carpeta completa como archivo y configura otra carpeta vacía. No se promete exclusión mutua entre PCs, entrega inmediata, subida automática por EscuchaInterna ni confirmación de entrega a Google. Trabaja en un equipo cada vez y verifica el estado de Drive.

## Contrato del transporte, formato 1

Productor y consumidor: `desktop/synchronization.cjs`. Solo el proceso principal escribe o recibe versiones. La interfaz web no obtiene contraseñas, claves ni acceso arbitrario al sistema de archivos.

Una carpeta contiene un archivo `<channel UUID v4>.eichannel`: magic `EICHANNEL1`, sal de 32 bytes, UUID ASCII de 36 bytes y HMAC-SHA256 del UUID. La clave se deriva de la contraseña con scrypt (`N=32768, r=8, p=1`, 32 bytes). El archivo identifica y verifica un canal, sin datos clínicos.

Cada versión `<revision UUID v4>.eisync` contiene:

- Magic `EISYNC1` y longitud big-endian de 4 bytes del encabezado cifrado.
- Encabezado AES-256-GCM: nonce de 12 bytes, tag de 16 bytes y JSON cifrado `{ format: 1, id, channel, device, parents: UUID[], backupHash: SHA256 hex, createdAt: ISO8601 }`.
- Respaldo completo `EIBACKUP1`, cifrado y autenticado con la contraseña. Contiene archivos permitidos y claves portables. El hash del respaldo forma parte del encabezado autenticado.

Los IDs y el número, tamaño y fechas del sistema de archivos quedan visibles al proveedor. Los nombres de pacientes, cuentas, fechas de publicación del encabezado, expedientes, adjuntos y claves permanecen dentro del contenido cifrado. Al recibir, las claves se vuelven a proteger para el usuario de Windows mediante Electron `safeStorage`/DPAPI. `synchronization.bin`, fuera de `workspace`, protege contraseña, clave derivada, carpeta, canal, equipo, revisión base y huella local; nunca se envía a Drive.

Las versiones son inmutables, con uno o varios padres. Los padres deben estar descargados y el grafo debe ser acíclico. Las hojas son las versiones disponibles; varias hojas indican divergencia. La huella local usa contenido lógico de SQLite y contenido de adjuntos, de modo que un checkpoint del WAL no se confunde con un cambio de consulta.

## Contrato del puente nativo

`preload.cjs` expone únicamente `window.escuchaDesktop`:

| Método / canal IPC | Entrada | Efecto |
| --- | --- | --- |
| `synchronizationStatus` / `desktop:sync-status` | ninguna | Estado local de carpeta y hojas, sin contraseña ni claves |
| `connectSynchronization` / `desktop:sync-connect` | ninguna | Selector nativo de carpeta y diálogo nativo de contraseña; configuración protegida |
| `publishSynchronization` / `desktop:sync-publish` | ninguna | Confirmación nativa, snapshot cifrado y avance de revisión base |
| `receiveSynchronization` / `desktop:sync-receive` | UUID de una hoja | Confirmación nativa, validación y sustitución del espacio con copia anterior y rollback |
| `disconnectSynchronization` / `desktop:sync-disconnect` | ninguna | Confirmación nativa y eliminación de configuración local; los datos se conservan |

El emisor debe ser el frame principal de la ventana, con el origen loopback exacto y ruta `/sincronizacion` o `/configuracion/sincronizacion`. Se rechazan subframes, otras rutas y orígenes. Las operaciones de datos comparten exclusión local con los respaldos. La primera ruta permite recuperar una instalación vacía mediante confirmación física en el programa; no es una API pública de restauración por HTTP.

Compatibilidad: el formato de respaldos 0.2.0 se conserva; 0.2.0 no interpreta `.eisync`. Todas las PCs que compartan una carpeta deben usar 0.3.0 o una versión posterior compatible. No hay cambio de contraseña en el mismo canal: para cambiarla, publica desde una nueva carpeta y vuelve a conectar los equipos.

Referencias: [Drive para escritorio: reflejar o transmitir archivos](https://support.google.com/drive/answer/13401938?hl=es), [seguridad de Electron e IPC](https://www.electronjs.org/docs/latest/tutorial/security).
