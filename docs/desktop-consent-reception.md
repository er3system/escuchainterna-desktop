# Recepción automática de consentimientos

Disponible desde EscuchaInterna para PC 0.8.0. El programa importa PDF e imágenes desde una carpeta local, incluida una carpeta de Google Drive para escritorio. Google Forms y Apps Script pueden alimentar esa carpeta con documentos que el paciente ya haya firmado.

## Conectar una carpeta

1. Abre **Consulta → Consentimientos** en el programa instalado.
2. Pulsa **Conectar carpeta** y selecciona una carpeta privada destinada a recibir documentos. Usa una carpeta distinta de los respaldos cifrados de la consulta.
3. Si está en Drive, márcala **Disponible sin conexión** desde Drive para escritorio.
4. Abre el expediente de un paciente y pulsa **Preparar recepción**. El programa crea un código para sugerir ese paciente cuando llegue el documento.
5. Para probar sin formulario, coloca un PDF firmado en la carpeta con el nombre `CODIGO__firmado.pdf`, sustituyendo `CODIGO` por el código mostrado. Un documento sin código también se recibe; tendrás que elegir su paciente.

Se admiten PDF, PNG, JPG y WebP de hasta 20 MiB. Los archivos deben conservar su tamaño y fecha de modificación en dos revisiones separadas al menos un segundo. También se comprueban la cabecera y la terminación del formato. Los enlaces de archivos y carpetas no se siguen.

Con una sesión válida, el programa revisa la carpeta cada 30 segundos mientras está abierto, aunque estés en otra sección. En carpetas grandes continúa la lectura entre revisiones. Los archivos nuevos pueden tardar más de un intervalo en aparecer; depende también de la descarga de Drive. **Revisar ahora** permite comprobar la carpeta manualmente.

## Recibir desde Google Forms

El archivo [google-consent-reception.gs.txt](../public/google-consent-reception.gs.txt), también descargable desde la bandeja, prepara un formulario y el activador de recepción en tu propia cuenta.

1. Crea un proyecto en [Google Apps Script](https://script.google.com) y pega el script.
2. Ejecuta `crearFormulario`. Google solicitará los permisos correspondientes. El registro de ejecución mostrará un formulario de edición y la carpeta privada **EscuchaInterna - Recepción de consentimientos**.
3. Abre el formulario y añade **una pregunta obligatoria «Subir archivo»**. Permite solo PDF e imágenes, con un máximo de 10 MB (el límite disponible en Forms que cabe dentro de los 20 MiB del programa). Comprueba que acepta respuestas y configura quién puede responder. Mantén el campo «Código de recepción».
4. Ejecuta `conectarRecepcion`. Instala un activador de envío y muestra un enlace prellenado cuyo código es `CODIGO`.
5. Selecciona la carpeta creada desde Drive para escritorio en el programa. Pega el enlace prellenado en **Configurar la entrega con Google Forms → Guardar enlace del formulario**.
6. Desde cada expediente, **Preparar recepción** ofrecerá el enlace con el código del paciente. Puedes copiarlo para entregarlo por el canal habitual. Copiarlo no registra un envío.

El paciente necesita iniciar sesión en Google para usar la pregunta de subida de archivos. El formulario recibe documentos ya firmados; no realiza ni verifica una firma electrónica. [Ayuda de Google Forms](https://support.google.com/docs/answer/15473134?hl=es).

El script copia los archivos en la carpeta de recepción con un código de paciente y una referencia derivada de la respuesta. Conserva los originales y no cambia los permisos de compartición. Las ejecuciones repetidas de una respuesta no crean copias nuevas. Revisa los errores en Apps Script; `recuperarRecepciones` permite reintentar las últimas veinte respuestas. [Ejemplo oficial de recepción de archivos](https://developers.google.com/apps-script/samples/automations/upload-files).

No compartas la carpeta de respuestas con los pacientes ni uses una carpeta compartida públicamente. Los documentos son legibles en Drive; el cifrado con contraseña de los respaldos de EscuchaInterna no se aplica a esos archivos.

## Revisar y archivar

La llegada de un documento muestra un aviso y crea una entrada **Pendiente de revisión**. Abre el original, confirma el paciente, escribe la fecha que consta en la firma y marca la confirmación antes de pulsar **Confirmar y archivar**.

El código del nombre del archivo es solo una sugerencia: una persona puede alterar un código prellenado. Nunca se usa como prueba de identidad ni de firma. Los códigos de otra cuenta no sugieren pacientes de esa cuenta.

Al archivar se crea un consentimiento nuevo con el archivo original, sin sobrescribir documentos anteriores. Se registran por separado la fecha de importación en esta PC, la fecha de firma indicada por el profesional y la fecha de revisión. El consentimiento queda disponible en el expediente y en el historial de recepción. Un archivo genérico no autoriza por sí solo el tratamiento con IA.

**Descartar de la bandeja** retira un documento de pendientes y conserva su copia en el historial. El mismo contenido no se importa otra vez aunque cambie de nombre. Desconectar o cambiar la carpeta tampoco borra los documentos guardados. El listado presenta hasta doscientas entradas, con los pendientes primero.

## Datos, respaldo y límites

- La copia local del documento y sus metadatos se cifran. El original de Drive se conserva sin modificarlo.
- Cada cuenta accede a sus propios documentos. Los asistentes de recepción y profesores no acceden a esta bandeja.
- Los documentos importados se incluyen en los respaldos y versiones cifradas de la consulta. La carpeta se configura por PC; al restaurar en otra instalación debes volver a seleccionarla.
- El registro de recepción demuestra cuándo el programa importó el archivo, no cuándo una persona lo firmó ni cuándo llegó a los servidores de Google.
- Google puede recibir respuestas con la PC apagada. La importación local requiere el programa abierto, una sesión activa y archivos disponibles. No hay servicio de Windows que funcione con la aplicación cerrada.
- Esta versión no importa ni rellena plantillas Word o Google Docs, no solicita firmas electrónicas de Google y no envía enlaces automáticamente a los pacientes.

## Verificación

Las pruebas usan cuentas y documentos ficticios: descarga incompleta, duplicados, concurrencia, carpetas grandes, códigos ajenos, revisión explícita, fecha de firma, cifrado, selección nativa firmada y restauración en otra PC. El flujo de navegador cubre recepción automática desde otra sección, visor, archivo en el expediente y bloqueo de acceso anónimo o de otra cuenta.
