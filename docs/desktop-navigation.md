# Navegación y apariencia de escritorio · 0.5

## Problemas comprobados

- La distribución pública instala catálogos vacíos; no ofrece acceso a los libros locales anteriores.
- Fondo, tarjetas y navegación comparten prácticamente el mismo tinte en modo noche.
- Diez enlaces del menú tienen la misma jerarquía; sincronización y servicios quedan dentro de Configuración.
- La banda superior repite un aviso local en todas las páginas sin orientar sobre la sección actual.
- El menú móvil no devuelve el foco ni permite cerrarlo con Escape.

## Cambios

1. Agrupar navegación por Consulta, Comunicación, Recursos y Tu aplicación, respetando los permisos existentes. Sincronización y Servicios opcionales tienen acceso directo en PC.
2. Añadir un buscador de secciones con Ctrl+K, diálogo accesible y resultados limitados a las opciones del rol. No busca ni transmite información clínica.
3. Mostrar ubicación y enlaces de regreso en la banda superior; añadir salto al contenido y cierre accesible del menú móvil.
4. Separar fondos neutros, superficies, navegación y acciones; combinar verdes pino, helecho, salvia y oliva. Conservar las paletas anteriores y añadir Salvia y Jardín, con modos día/noche/automático y movimiento reducido.
5. Instalar contenidos locales fuera del espacio clínico sincronizado. La biblioteca de varios GB no debe romper el límite de respaldo clínico de 256 MiB. Los catálogos privados se instalan aparte en cada equipo; no se incluyen en GitHub ni en el instalador público.
6. Recuperar los libros locales con búsqueda, categorías y paginación; la colección mantiene su lector, índice y favoritos por usuario.

## Verificación

Compilación, tipos y pruebas; contraste AA en las seis paletas y ambos modos; navegación con teclado; filtros y paginación del catálogo; lectura sin red; denegación de archivos fuera de las carpetas autorizadas. Verificar también el instalador con datos ficticios antes de actualizar la consulta existente.
