# Seguridad

No publiques expedientes, datos personales, contraseñas ni claves en issues, capturas o pull requests.

Para reportar una vulnerabilidad utiliza la sección **Security → Report a vulnerability** de este repositorio. Si no está disponible, contacta al mantenedor mediante su perfil de GitHub antes de compartir detalles que permitan explotar la falla.

El programa usa un servidor accesible solo desde la propia PC, una ventana con aislamiento y sandbox, sesión autenticada y separación de datos por profesional. Los campos clínicos y otros campos sensibles usan el cifrado de la aplicación; la base de datos completa y todos sus metadatos no están cifrados como una unidad. Protege también la cuenta de Windows y el disco.

Los respaldos del programa contienen datos y material necesario para recuperarlos. Guarda la contraseña y el archivo por separado. Conserva la carpeta de datos al actualizar o desinstalar; eliminar las claves puede impedir leer los expedientes.

Los ejecutables publicados inicialmente no tienen firma Authenticode. Compara su SHA-256 con el publicado en la release y descarga únicamente desde este repositorio. La firma y las actualizaciones verificadas se incorporarán cuando exista una identidad de publicación configurada.
