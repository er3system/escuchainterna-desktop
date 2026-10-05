# EscuchaInterna — acuerdos de trabajo

- Interfaz y dominio en español.
- Arquitectura DDD por contextos en src/contexts/<contexto>/{domain,application,infrastructure}.
- Value objects y mensajes de aplicación convierten los primitivos en la frontera.
- Repositorios: interfaz de dominio y adaptadores de infraestructura.
- Todo dato operativo se filtra por owner_user_id del usuario autenticado.
- El modo escritorio elimina gates comerciales, nunca autenticación ni permisos.
- SQLite se abre mediante getDb(); esquema nuevo requiere migración versionada.
- Integraciones: puerto y adaptador; el programa debe funcionar sin red.
- Componentes cliente no importan módulos Node; servir ReadStreams mediante Readable.toWeb.
- No publicar .env, claves, datos de pacientes, respaldos ni contenido sin licencia.
- Verificar npm run typecheck, npm test y npm run build. Para desktop: pruebas y smoke empaquetado.
- No ejecutar build y dev contra el mismo directorio de Next.
