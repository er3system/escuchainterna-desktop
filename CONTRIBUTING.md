# Contribuir a EscuchaInterna

Este proyecto usa TypeScript, Next.js, React y Electron. La interfaz y los conceptos de negocio están en español.

1. Abre un issue para describir el problema o la mejora. Usa ejemplos ficticios, nunca expedientes ni datos identificables de pacientes.
2. Crea una rama a partir de `main` y limita el cambio a una función o corrección verificable.
3. Respeta los contextos DDD de `src/contexts`, los value objects, los mensajes de aplicación y los repositorios. Las acciones de Next son fronteras delgadas.
4. Conserva la autenticación y el aislamiento por `owner_user_id`. El modo escritorio elimina la suscripción, no los controles de acceso.
5. Ejecuta `npm run typecheck`, `npm test` y `npm run build`. Si cambias el escritorio, ejecuta también sus pruebas y el smoke del programa empaquetado.
6. En el pull request explica el problema, el comportamiento final y la verificación. Añade una captura solo cuando ayude a revisar la interfaz.

No incluyas `.env`, claves, bases de datos, respaldos, adjuntos o catálogos sin autorización de redistribución. Los cambios de esquema se añaden como nuevas migraciones; no se reescriben migraciones publicadas. Los componentes cliente no deben importar módulos de Node ni value objects que dependan de Node.

Las integraciones externas deben pasar por un puerto y un adaptador. La consulta local debe funcionar sin conexión. Las nuevas dependencias necesitan una finalidad concreta y una licencia compatible.
