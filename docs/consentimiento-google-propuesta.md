# Consentimientos con Google y EscuchaInterna

Propuesta de producto del 5 de octubre de 2026. Desde la versión 0.8.0 está implementada la recepción desde una carpeta de Drive y su revisión; la importación de plantillas y la solicitud de firmas quedan pendientes. Consulta [la guía de la recepción disponible](desktop-consent-reception.md).

## Flujo para la consulta

1. **Guardar una plantilla.** Importar el consentimiento que ya usa el profesional: PDF, Word o Google Docs. Conservar el original y crear una versión nueva cuando cambie. Para rellenar nombres y fechas automáticamente, habría que definir campos en el documento editable; un PDF sin campos se conserva tal como está.
2. **Preparar el documento de un paciente.** Desde su expediente, elegir la plantilla y revisar el destinatario. Guardar una copia exacta del documento preparado y un identificador aleatorio de solicitud. El identificador sirve para relacionar la respuesta con el expediente, sin depender del nombre del archivo.
3. **Entregarlo para firmar.** Ofrecer «Descargar para firma presencial» y, si se configura Google, «Abrir en Google para solicitar firma» o «Copiar enlace de recepción». Copiar un enlace no marca el documento como enviado; registrar por separado la entrega confirmada.
4. **Recibir la copia firmada.** Google guarda el archivo recibido en una carpeta privada destinada a consentimientos. Cuando EscuchaInterna esté abierta y Drive haya terminado de descargarlo, importarlo a una bandeja de documentos pendientes de revisión. Conservar el archivo original y la evidencia de recepción.
5. **Revisar y archivar.** Mostrar paciente, versión del consentimiento y documento recibido. El profesional confirma la correspondencia y la firma antes de marcarlo como firmado. Mantener una copia local que pueda abrirse desde el expediente sin internet y que se incluya en los respaldos cifrados.

La pantalla del paciente mostraría el documento, su estado, las fechas y el historial. Cambiar la plantilla no cambia los consentimientos ya emitidos. Revocar uno conserva el documento y registra la revocación.

## Dos opciones de Google

| Opción | Uso previsto | Condición |
|---|---|---|
| Firma electrónica de Google | Pedir la firma de un PDF o documento y recuperar el PDF final con su registro de auditoría. | Workspace Individual u otro plan compatible. La primera versión abriría el trámite en Google; no se promete una API para automatizar la solicitud. |
| Google Forms y Apps Script | Recibir un PDF o una foto que el paciente ya haya firmado, y ordenar la recepción en Drive. | Configurar el formulario y autorizar el script. Para subir archivos, el paciente tiene que iniciar sesión en una cuenta de Google. |

Forms puede registrar una respuesta de aceptación, pero esa respuesta se muestra como tal, no como una firma electrónica verificada. Si el paciente no usa Google, se conserva la opción de adjuntar el documento manualmente en el programa.

Google puede recibir documentos mientras la PC esté apagada. El programa actualiza la bandeja cuando vuelve a abrirse y dispone de los archivos; no debe prometer recepción local inmediata con la aplicación cerrada.

## Qué existe hoy y qué falta

Hoy se puede editar una plantilla de texto en **Configuración → Consentimiento informado** y adjuntar un PDF o una imagen firmada desde el consentimiento del paciente. La página de firma que genera la edición local apunta al servidor de esa PC; ese enlace no resuelve por sí solo la firma remota.

Falta importar y rellenar plantillas de documentos y conservar sus versiones. La recepción de Drive ya conserva un historial y exige revisar el documento antes de archivarlo. En este flujo se separan la recepción, la fecha de firma indicada por el profesional y la revisión. El adjunto manual anterior sigue registrando la fecha de adjunto como fecha de firma.

## Reglas para implementar

- Carpeta de recepción privada y separada de la carpeta de sincronización cifrada de la consulta. Los PDF recibidos son legibles en Drive; no tienen el mismo cifrado con contraseña que los respaldos del programa.
- Enviar solamente el documento necesario al destinatario previsto. No exponer listados de pacientes ni expedientes completos en un formulario.
- Un código prellenado de Forms ayuda a relacionar una respuesta, pero puede ser alterado. Validar la solicitud y presentar la correspondencia al profesional; no usar el código como prueba de identidad o de firma.
- Registrar versión y huella del archivo, identificador de respuesta, origen, destinatario, fecha de recepción y fecha de firma cuando conste. Importar una misma respuesta dos veces no debe duplicar el consentimiento.
- Conservar el archivo recibido sin modificarlo. Un documento nuevo no sobrescribe el anterior. Los documentos sin correspondencia se quedan en la bandeja para revisión.
- Filtrar todas las solicitudes y documentos por el titular de la consulta. Las credenciales de Google se configuran mediante el mecanismo de integraciones del programa.
- Adjuntar o recibir un documento no concede automáticamente autorización para procesar datos con IA. Esa autorización necesita un consentimiento específico registrado.

## Orden de implementación

Primero, importación local, versiones y revisión del documento firmado. Después, bandeja de recepción desde una carpeta de Drive para escritorio, aprovechando la instalación existente. Por último, preparar el formulario y Apps Script o conectar el flujo de firma de Workspace, según la cuenta y el documento que use el profesional.

## Fuentes de Google

- [Firma electrónica: planes compatibles y PDF con auditoría](https://support.google.com/drive/answer/12315692?hl=es).
- [Ejemplo oficial: ordenar archivos recibidos en Forms mediante Apps Script](https://developers.google.com/apps-script/samples/automations/upload-files).
- [Forms: iniciar sesión para subir un archivo](https://support.google.com/docs/answer/15473134?hl=es).
