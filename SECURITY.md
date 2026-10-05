# Seguridad

En PC 0.4.0, las claves opcionales de Resend/OpenAI/Anthropic se guardan cifradas con contexto de fila, proveedor y dueño. Las acciones requieren permiso de configuración clínica y nunca aceptan el dueño desde el formulario. Los adaptadores leen únicamente la configuración autorizada del dueño; no heredan credenciales globales de plataforma. Desconectar elimina la clave del almacenamiento activo. Las versiones y respaldos antiguos cifrados pueden conservarla: para invalidarla también hay que revocarla en el proveedor.

No publiques expedientes, datos personales, contraseñas ni claves en issues, capturas o pull requests.

Para reportar una vulnerabilidad utiliza la sección **Security → Report a vulnerability** de este repositorio. Si no está disponible, contacta al mantenedor mediante su perfil de GitHub antes de compartir detalles que permitan explotar la falla.

El programa usa un servidor accesible solo desde la propia PC, una ventana con aislamiento y sandbox, sesión autenticada y separación de datos por profesional. Los campos clínicos y otros campos sensibles usan el cifrado de la aplicación; la base de datos completa y todos sus metadatos no están cifrados como una unidad. Protege también la cuenta de Windows y el disco.

Los respaldos del programa contienen datos y material necesario para recuperarlos. Guarda la contraseña y el archivo por separado. Conserva la carpeta de datos al actualizar o desinstalar; eliminar las claves puede impedir leer los expedientes.

La sincronización con Drive cifra el espacio completo antes de escribirlo en la carpeta compartida y protege la contraseña local con DPAPI. La entrega depende de Google Drive para escritorio. Los metadatos del sistema de archivos —IDs, tamaños y número de versiones— siguen visibles; el cifrado no protege una PC desbloqueada. Las versiones no se fusionan automáticamente ni se borran al resolver un conflicto. La guía de recuperación y el contrato están en `docs/desktop-sync.md`.

Los ejecutables publicados inicialmente no tienen firma Authenticode. Compara su SHA-256 con el publicado en la release y descarga únicamente desde este repositorio. La firma y las actualizaciones verificadas se incorporarán cuando exista una identidad de publicación configurada.
