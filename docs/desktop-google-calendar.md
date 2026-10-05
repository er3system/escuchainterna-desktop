# Google Calendar en la aplicación de PC

Desde 0.7.0, Agenda enlaza directamente a `/configuracion/google-calendar`. Servicios opcionales también muestra Calendar. Un cliente OAuth guardado o el estado simulado de la web nunca cuentan como conexión de escritorio.

## Configuración personal

1. Seleccionar el proyecto propio en Google Cloud y habilitar Google Calendar API.
2. Configurar Google Auth Platform y, si la audiencia está en pruebas, añadir la cuenta como usuario de prueba.
3. Crear un cliente OAuth de tipo **Aplicación de escritorio**, descargar su JSON y usar «Importar cliente» en EscuchaInterna. No usar una API key, cliente web ni cuenta de servicio.
4. Confirmar los permisos, preparar la conexión y continuar en Google desde el navegador del sistema. Mantener abierta la app durante el retorno.

Google requiere registrar un cliente. Este repositorio no incluye credenciales, tokens ni un proyecto compartido. Las apps externas en pruebas pueden tener permisos renovables que expiran a los siete días; volver a autorizar cuando Google lo solicite. La verificación pública de Google es un proceso independiente de publicar el código MIT.

Fuentes oficiales: [OAuth para aplicaciones instaladas](https://developers.google.com/identity/protocols/oauth2/native-app), [alcances de Calendar](https://developers.google.com/workspace/calendar/api/auth).

## Comportamiento

- OAuth Authorization Code con PKCE S256, estado aleatorio de un solo uso y cinco minutos de vigencia, ligado al dueño de la sesión local y al origen `http://127.0.0.1:<puerto>` del programa. El navegador del sistema devuelve el resultado a `/api/desktop/google-calendar/callback`; no usa la sesión de Google del conector de Codex ni pide pegar códigos.
- Alcances: `openid`, `email`, `calendar.app.created` y `calendar.freebusy`. Se crea un calendario secundario llamado **EscuchaInterna**. Al reautorizar el mismo cliente y cuenta se conserva su calendario.
- «Revisar coincidencias» consulta intervalos ocupados del calendario **principal** y muestra sesiones locales que se cruzan; no lee títulos o participantes, no bloquea automáticamente reservas y no consulta calendarios secundarios personales.
- «Publicar horarios» envía únicamente el título genérico **Sesión de consulta**, inicio y fin. No envía nombres, correos, notas, expedientes, ubicaciones ni invitados. Los eventos son privados y no mandan invitaciones.
- Publicación manual de un intervalo de hasta 120 días y 500 sesiones. Actualiza horarios existentes, añade los nuevos y retira eventos gestionados por esta cuenta que ya no correspondan al intervalo. Conserva eventos ajenos. Los IDs deterministas y marcadores derivados de hashes permiten reintentar sin duplicar. Las operaciones tienen límites de red y volumen; ante un fallo puede haber avances parciales y la fecha de última publicación solo se actualiza tras terminar.
- La app local es la fuente de los horarios. No importa modificaciones hechas en Google ni realiza tareas en segundo plano cuando está cerrada. Publicar después de crear, mover o cancelar citas.
- «Desconectar de esta consulta» elimina tokens locales e invalida solicitudes pendientes. Conserva el calendario y eventos de Google. La revocación global se realiza desde las conexiones de la cuenta de Google: puede afectar otras apps del mismo proyecto, por eso no se ejecuta silenciosamente.

## Persistencia y aislamiento

Se reutiliza la fila `integration_connections` del proveedor `google_calendar`, filtrada por `owner_user_id`. El contrato de configuración de escritorio lleva `desktop_oauth: v1`, cliente, tokens, caducidad, alcances, correo de la cuenta, referencia del calendario y fecha de última publicación. Todo `config_json` se cifra con AES-256-GCM y AAD por fila/proveedor/dueño. Solo el resumen de cuenta y publicación pasa a la UI; los secretos no se devuelven. El respaldo cifrado de Drive incluye estas credenciales, como las demás integraciones.

Las operaciones se serializan por dueño en el servidor local para impedir que una renovación concurrente reintroduzca credenciales tras desconectar. El callback comprueba que la cuenta local siga activa. Los asistentes no ven la invitación y los guards de Configuración también restringen el acceso directo.

Los endpoints de Google son fijos; los tokens van en headers o cuerpos POST y los adaptadores no siguen redirecciones. Los errores no muestran cuerpos del proveedor, códigos ni tokens. No registrar URLs completas del callback. Los campos `refresh_token` y `code_verifier` también se redactan en cualquier proyección antigua de integraciones.

## Verificación

Pruebas de PKCE/estado/expiración/replay/origen, consentimiento, permisos incompletos, cuenta suspendida, conexión efectiva, reutilización de calendario, cifrado por dueño, proyección mínima de horarios, errores opacos, publicación idempotente, limpieza selectiva y free/busy. El E2E de escritorio comprueba la entrada desde Servicios y Agenda, el formulario, limpieza del secreto, URL OAuth y callback cancelado desde un navegador sin cookie, sin llamar a Google con credenciales ficticias. La autorización real requiere el cliente y el consentimiento de su propietario.
