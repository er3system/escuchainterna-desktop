# Acceso local y cuenta recordada — 0.8.1

En el inicio de sesión, «Recordar cuenta en esta PC» conserva únicamente el correo en una cookie HttpOnly de 30 días y hace persistente la cookie de sesión durante ese mismo plazo. Las cookies pertenecen al host local y siguen disponibles cuando el servidor arranca en otro puerto. La firma, el plazo y el epoch se verifican en el servidor. La elección se incluye en el reto firmado del segundo factor; recordar una cuenta nunca lo omite.

Sin marcar la casilla, la sesión utiliza una cookie de sesión. Cerrar sesión elimina la autorización y conserva el correo recordado. Para olvidarlo, inicia sesión con la casilla desmarcada. No se guarda la clave ni un token en localStorage.

## Recuperar una cuenta

Escribe el correo local y pulsa «¿Olvidaste tu contraseña?» dentro de la aplicación de Windows. El proceso nativo abre la pantalla para crear la nueva clave. Esta operación confía en el acceso al perfil de Windows, igual que los datos y respaldos locales: no verifica la propiedad de una cuenta Google ni recupera una cuenta del sitio web. En equipos compartidos utiliza perfiles de Windows distintos y bloquea tu sesión cuando te ausentes.

La contraseña nueva debe tener al menos 10 caracteres con letras y números, o ser una frase de 14 caracteres o más; se rechazan claves comunes. El enlace dura una hora y solo puede usarse una vez. El cambio, el consumo del token, la invalidación de sesiones y la limpieza del bloqueo por intentos se confirman juntos en una transacción. Los expedientes, archivos, catálogos y claves de cifrado permanecen iguales.

## Frontera nativa

- IPC `desktop:recover-account(email)`: solo el WebContents principal, su frame principal y la ruta `/login` del origen local exacto. El preload expone `recoverLocalAccount(email)`; el token no se devuelve al renderer de login.
- `POST /api/desktop/account-recovery`: cuerpo `{ email }`, cabecera `X-Desktop-Recovery`. La prueba HMAC, con propósito separado, vincula correo, origen, fecha y nonce. Dura 30 segundos y se consume una sola vez. Se rechazan cabeceras Origin, peticiones sin firma, otros puertos, cuerpos grandes y la edición web.
- Se reutiliza `RequestPasswordReset` con el adaptador `DesktopPasswordResetNotifier`: la entrega ocurre abriendo el enlace desde el proceso nativo, sin correo, outbox ni proveedor externo. El guardado reutiliza `ResetPassword` y el hash scrypt.
- El ejecutable admite `--recover-local-account=correo` para abrir esta misma recuperación al arrancar; no recibe contraseñas por argumentos. Esto tampoco cambia la clave hasta que la persona complete el formulario.
- La recuperación pública `/recuperar` conserva su política: el enlace no se devuelve a un navegador anónimo de producción.

## Comprobar

Ejecuta `npm run typecheck`, `npm test`, `npm run build`, `npm run desktop:test`, `npm run desktop:build`, `npm run desktop:dir`, `npm run desktop:smoke` y `node scripts/desktop-account-smoke.mjs`. El último script crea cuentas ficticias en una carpeta aislada: comprueba recuperación, rechazo de pruebas repetidas y anónimas, invalidación de sesiones, ausencia de envíos externos, correo al cambiar de puerto y cookies con/sin persistencia. Nunca usa la base instalada del usuario.
