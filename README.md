# EscuchaInterna para PC

Programa de escritorio en español para gestionar una consulta psicológica: agenda, pacientes, expedientes, notas de sesión, pagos y archivos. Funciona en la propia PC y reutiliza la aplicación web de EscuchaInterna.

**Windows de 64 bits · Código abierto MIT · Temas y sincronización cifrada con Drive**

## Instalar

Descarga el instalador `.exe` desde [Releases](https://github.com/er3system/escuchainterna-desktop/releases). El programa incluye los componentes necesarios; no necesitas instalar Node.js ni configurar una base de datos.

La primera vez crea tu cuenta local. Esta edición no tiene período de prueba ni suscripción. La cuenta y los expedientes pertenecen a esta instalación; no son una cuenta de la web. Usa el menú del programa para crear un respaldo y restaurarlo en otra instalación.

El respaldo inicial admite hasta 256 MiB de datos antes de comprimir. Conserva su contraseña: será necesaria para restaurar. Para imprimir o guardar una vista como PDF, usa el menú del programa y el diálogo de Windows.

## Apariencia y continuidad entre PCs

Elige modo **Día**, **Noche** o **Automático**, con las paletas Bosque, Océano, Lavanda y Terracota. La bienvenida y **Configuración → Apariencia** guardan tu elección en este equipo. Las transiciones respetan el movimiento reducido de Windows y se pueden desactivar.

En **Configuración → Sincronización con Drive**, conecta una carpeta de Google Drive para escritorio que esté disponible sin conexión. Usa la misma contraseña en ambas PCs. Publica los cambios al terminar, espera a que Drive los entregue y recibe la versión antes de continuar en la otra PC. Una instalación vacía puede recibir desde **Continuar desde otra PC** o el menú Archivo.

Se transfieren versiones cifradas del espacio completo, incluidas todas las cuentas, adjuntos y claves; la base activa permanece en el disco local. Las versiones divergentes se conservan y requieren elegir cuál continuar. La app no combina expedientes automáticamente ni confirma la entrega a la nube. Consulta [la guía de sincronización y recuperación](docs/desktop-sync.md).

Los datos se guardan en la carpeta de usuario de Windows, fuera del programa. Las actualizaciones conservan ese espacio de trabajo. El instalador inicial no tiene firma Authenticode; en la release se publica su SHA-256.

## Qué funciona en local

Agenda, registro e importación de pacientes, expedientes clínicos, notas, archivos y registro de pagos usan SQLite y archivos en la PC. La autenticación, los permisos por profesional y el cifrado de campos se conservan. El modo escritorio no crea usuarios ni pacientes demo.

Las integraciones externas necesitan conectividad y un proveedor configurado. El outbox local registra mensajes, pero no significa que se hayan entregado por correo o WhatsApp. Los enlaces con dirección local solo funcionan en esta PC. Los recordatorios no se ejecutan si el programa está cerrado.

El catálogo CIE-11 y las publicaciones de la instalación original se distribuyen por separado y no vienen incluidos en esta primera versión pública. Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Desarrollar

Requisitos: Windows de 64 bits, Node.js 24 y npm. La descarga de dependencias y la compilación necesitan internet; el programa instalado puede trabajar sin conexión.

```powershell
npm ci
npm run typecheck
npm test
npm run desktop:test
npm run desktop:build
npm run desktop:start
```

Para construir el instalador y verificar el programa empaquetado:

```powershell
npm run desktop:build
npm run desktop:package
npm run desktop:smoke
```

La prueba de flujo completo usa un navegador de prueba y datos ficticios:

```powershell
npx playwright install chromium
node scripts/desktop-e2e.mjs
```

El proceso de escritorio construye una copia del código sin `.env` ni datos locales. Las claves de cada instalación se generan al iniciar. El runtime de Node incluido se descarga de la distribución oficial y se verifica contra su SHA-256.

Para desarrollar la web por separado:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

En desarrollo web se pueden sembrar cuentas y datos ficticios. Nunca despliegues ese entorno con datos reales. En producción web, configura los secretos obligatorios y el aprovisionamiento explícito del administrador descritos en `.env.example`.

## Arquitectura y contribuciones

`src/contexts/<contexto>/{domain,application,infrastructure}` contiene el negocio. Las acciones de Next.js conectan la interfaz con los casos de uso. `desktop` contiene la ventana Electron, el servidor local y las operaciones de respaldo. `ESCUCHAINTERNA_DESKTOP=1` activa las diferencias de la edición para PC.

Consulta [el concepto de escritorio](docs/desktop-concept.md), [la guía de contribución](CONTRIBUTING.md) y [la política de seguridad](SECURITY.md). El portal remoto, la fusión automática de cambios y las actualizaciones automáticas firmadas quedan como trabajo futuro.

La licencia MIT cubre el código propio. Las dependencias y los catálogos externos conservan sus licencias originales.
