# EscuchaInterna — Especificación de UI completa

> **Fuente:** síntesis de `docs/ui-notes/batch-1.md` … `batch-10.md` (análisis de 76 capturas del producto
> "Elo Business Hub", `hub.holaelo.app`, SaaS en español para psicólogos).
> **Propósito:** única referencia visual para los implementadores de **EscuchaInterna**.
> Las secciones 1–4 documentan el producto observado (con sus labels EXACTOS, conservando incluso
> faltas de tilde cuando se indica `(sic)`); la sección 5 define las diferencias de EscuchaInterna.
>
> **Convenciones de este documento:**
> - `[OBSERVADO]` = visto directamente en capturas. Por defecto todo es observado salvo marca contraria.
> - `[INFERIDO]` = no visto, deducido de la estructura del producto.
> - `[PROPUESTO]` = no existe en el original; diseño propuesto para EscuchaInterna.
> - Las inconsistencias del original (mezcla ES/EN, tildes faltantes) se documentan, pero
>   **EscuchaInterna debe corregirlas**: 100 % español, con tildes (ver §5.7).

---

## 1. Sistema de diseño

El producto observado tiene **dos generaciones de UI**: la "clásica" (mayoría de capturas, azul
`#2180DB`) y la "nueva" (estilo Ant Design, azul `#1677FF`, header con chips, FAB naranja).
**EscuchaInterna usa una sola paleta canónica** basada en la clásica, incorporando los aciertos
de la nueva (badges de estado de paciente, cards de paciente, breadcrumbs).

### 1.1 Paleta canónica (tokens)

| Token | Hex | Uso observado |
|---|---|---|
| `--color-primary` | `#2180DB` | Botones sólidos, links, stepper activo, tabs activas, checkboxes/radios/toggles, mes activo del dashboard, % de barras |
| `--color-primary-hover` | `#1E6FC2` | Hover de botón primario |
| `--color-primary-light` | `#E8F1FD` | Fondo de ítem activo del sidebar, chips de filtro, botón terciario ("Saltarse paso"), acción de fila "Enviar recordatorio" |
| `--color-primary-lighter` | `#DBEAFE` | Celda de día seleccionada en calendario, chips de evento, pills informativas |
| `--color-navy` | `#33475B` | Wordmark del logo |
| `--color-success` | `#22C55E` | Avatares, estado "Pagado", botón outline "Marcar como Pagado", toasts de éxito (check `#5ECD46`), badge "• Activo", barra de distribución |
| `--color-success-bg` | `#E8F8EC` | Caja "Con asistencia", chip modalidad seleccionada (`#E6F7EF` con texto `#16A34A`) |
| `--color-danger` | `#E5484D` | Estado "Sin pagar", acciones destructivas en menús ("Eliminar" rojo `#EF4444`), ✗ canceladas |
| `--color-danger-strong` | `#ED3739` | Header de tabla de errores de import |
| `--color-danger-bar` | `#E24E55` | Barra lateral de toast de error |
| `--color-danger-soft` | `#DC5F62` | Texto de teléfono inválido en tablas |
| `--color-danger-bg` | `#FFE9EC` | Caja "Canceladas", fila de error de import (rosa pálido) |
| `--color-warning` | `#FA8C16` | FAB de ayuda, avatar alterno; badge "demo" amarillo `#FADB14` sobre `#FFF7CC` |
| `--color-accent-yellow` | `#F8EFA9` | Bloques de fecha en eventos de Comunidad; chips "Marzo" `#FFF3BF` |
| `--color-accent-pink` | `#E5638C` | Chips de evento "secundario" en calendario (serie pasada/otro tipo) |
| `--color-accent-purple` | `#A445B2` | Color identificador de tipo de sesión (ejemplo); índigo `#4F46E5` en flechas del Preview |
| `--color-teal-cta` | `#1A93C5` | CTA especial del onboarding ("Empezar", "Finalizar onboarding") — gradiente `#2BB3D0 → #1A9EC9` |
| `--color-text` | `#1F2937` | Texto principal (casi negro, rango `#111827`–`#1F2937`) |
| `--color-text-secondary` | `#6B7280` | Subtítulos, metadatos, labels secundarios |
| `--color-text-placeholder` | `#9CA3AF` | Placeholders |
| `--color-border` | `#E5E7EB` | Bordes de cards, divisores, grid de calendario |
| `--color-border-input` | `#D0D7DE` | Bordes de inputs |
| `--color-bg` | `#FFFFFF` | Fondo de página, sidebar, cards |
| `--color-bg-subtle` | `#F8F8FA` | Banda de header de contenido, fondo de área de trabajo (vista paciente `#F7F8F9`) |
| `--color-bg-muted` | `#F3F4F6` | Inputs deshabilitados, textareas (`#F1F2F5`), botones píldora deshabilitados |
| `--color-table-header` | `#DBDFE4` | Header de tablas (variante `#E9ECEF`) |
| `--color-zebra` | `#F5F5F5` | Filas alternas de tabla (variante `#F4F4F6`) |
| `--color-disabled-bg` | `#EDEFF2` | Botón deshabilitado |
| `--color-disabled-text` | `#9AA4B2` | Texto de botón deshabilitado |
| Pasteles de plantillas | rosa `#F9D7DC`, verde `#D5F0D9`, azul `#CDE6F9`, lila `#E3D7F5`, amarillo `#FCF3C8`, durazno `#FBE3C0` | Bloques de las plantillas terapéuticas (en EscuchaInterna: acentos de secciones del formulario de historia clínica) |

Login de terceros observado (Auth0): botón índigo `#635DFF` sobre fondo negro — solo referencia; EscuchaInterna usa login propio (§3.1).

### 1.2 Tipografía

- **Familia:** sans-serif moderna — usar **Inter** (fallback `system-ui, -apple-system, "Segoe UI", sans-serif`). El logo es el único elemento con tratamiento propio (wordmark minúsculas, navy `#33475B`).
- **Escala:**
  - Headline de onboarding/bienvenida: ~64 px bold.
  - Título de paso de onboarding: 28–32 px bold, centrado, con **subrayado decorativo azul corto** debajo (firma visual del onboarding).
  - H1 de sección ("Dashboard General", "Pacientes", "Pagos", "Marketing"): 24–28 px bold.
  - Título de card / modal: 18–20 px bold.
  - Cuerpo: 14–15 px regular.
  - Labels de formulario: 13–14 px **semibold**, terminados en dos puntos (`Nombre:`, `Celular:`, `Descripción:`).
  - Metadatos / helpers / contadores: 12 px gris secundario.

### 1.3 Espaciado, radios y sombras

- Base de espaciado: **4 px** (gaps habituales 8/12/16/24 px; padding de cards 16–24 px).
- Radios: cards y modales **12 px**; inputs y botones **8 px**; chips/pills **9999 px** (full); avatares círculo.
- Sombra de card: `0 1px 3px rgba(16,24,40,.08)` + borde `--color-border`. Modales/popovers: `0 8px 24px rgba(16,24,40,.16)`.
- Overlay de modal: negro ~50 % de opacidad.
- Sidebar: ~240–280 px de ancho (hasta 340 px en contexto paciente); contenido principal con max-width fluido.

### 1.4 Componentes base

**Botones**
- *Primario:* fondo `--color-primary`, texto blanco, radio 8 px, padding 8×16. Ej.: `Siguiente ›`, `Guardar`, `Crear`, `+ Nueva Reservación`, `Enviar`.
- *Secundario (outline):* fondo blanco, borde `#D0D7DE`, texto azul. Ej.: `‹ Atrás`, `Cancelar`.
- *Terciario:* fondo `--color-primary-light`, texto azul. Ej.: `Saltarse paso`, `Utilizar plantilla`, acción de fila `🔔 Enviar recordatorio de Sesión`.
- *Éxito outline:* borde/texto verde. Ej.: `Marcar como Pagado` (con icono de recibo).
- *Deshabilitado:* fondo `#EDEFF2`, texto `#9AA4B2` (se usa hasta completar campos obligatorios).
- *CTA especial:* sólido/gradiente teal (`Empezar ›`, `Finalizar onboarding`, `Comenzar a usar … ›`).
- *Icono-botón:* cuadrado 32–36 px, borde sutil (toggles de vista, engranes, lápiz, ⋯).

**Inputs**
- Texto/email/número: borde `#D0D7DE`, radio 8 px, foco con borde azul. Asterisco rojo `*` para requeridos.
- **Teléfono compuesto:** select de país con bandera (`🇲🇽 +52 (MX)` por defecto, con chevrones) + input numérico, placeholder `Número de teléfono`.
- Fecha: input date nativo con icono calendario, placeholder `dd/mm/aaaa`. Hora: input time nativo con icono reloj (`--:--` si vacío).
- Textareas: fondo `#F1F2F5`/gris muy claro, **contador de caracteres** abajo a la derecha (`0/390 caracteres` en políticas/ubicación, `0/250` en comentarios públicos).
- Selects nativos con chevrones ⌃⌄; dropdowns con sombra, opción seleccionada con ✓, hover gris `#F5F6F7`.
- Checkbox/radio/toggle: azules al activarse; toggle con check blanco interno.
- Búsqueda: input con icono lupa a la izquierda.

**Cards**
- Blancas, borde `--color-border`, radio 12 px, sombra suave. Variantes: KPI (icono + label arriba, valor grande con subrayado fino), tipo de sesión (barra de acento vertical del color del tipo), card "añadir" (borde punteado gris + botón circular `+`), choice-cards de modal (hover/selección con fondo `#E3F4FD`), card de paciente (borde superior del color del estado).

**Tablas**
- Header gris `#DBDFE4` (texto semibold). Cada columna lleva **icono embudo ▽ (filtro)** e **icono ↑↓ (ordenar)** cuando aplica.
- Zebra striping sutil (`#F5F5F5`). Acciones por fila: lápiz azul (editar) + menú `⋯` (más acciones, incluye eliminar) o botones píldora apilados.
- Paginación al pie — el original la deja en inglés (`Rows per page [10] · 1-N of N · ‹ ›`); **EscuchaInterna:** `Filas por página [10] · 1-N de N · ‹ ›`.
- Estados vacíos dentro del cuerpo: icono gris grande + título bold + subtítulo gris (p. ej. `Sin reservaciones` / `Todavía no tienes reservaciones registradas.`; `Sin resultados` / `No encontramos reservaciones para tu búsqueda.`).

**Badges, chips y tags**
- Estado de pago: texto verde `Pagado` / rojo `Sin pagar`.
- Estado de paciente: badge punto + texto (`• Activo` verde; ALTA gris/azul, ABANDONADO naranja-rojo, EN PAUSA amarillo).
- Tags: chips grises redondeados con `✕` para quitar; input `Busca o agrega una etiqueta` con dropdown de sugerencias.
- Chips de plantilla/sugerencia: pill azul claro `#E7F1FD` con texto azul.
- Chips de filtro aplicado: `Buscando por:` + chip azul claro con el valor.

**Feedback**
- *Toast de éxito:* card blanca flotante arriba-centro, check circular verde + texto bold (`¡Se ha guardado exitosamente!`, `¡Se ha creado al paciente {nombre} exitosamente!`, `Todos los eventos cargados!`), cierre ✕.
- *Toast de progreso:* spinner + `Guardando sus cambios, espere por favor...` (autosave).
- *Toast de error:* card blanca con **barra vertical roja** a la izquierda, texto + botón outline rojo (`Ver errores`) + ✕.
- *Indicadores inline de autosave:* `Guardado`, `Cambios guardados` (check), `Escribiendo...`.

**Modales y drawers**
- Modal centrado, blanco, radio 12 px, título arriba-izquierda + ✕ arriba-derecha, botonera `Cancelar` (outline) / `Guardar` (primario) — centrada o a la derecha.
- Confirmación destructiva: título pequeño `Eliminar`, texto grande `¿Estás seguro?`, subtítulo `Esta acción no se puede deshacer`, botones `Cancelar` / `Eliminar` (el original usa azul para confirmar; **EscuchaInterna: usar rojo** en el botón destructivo).
- Drawer lateral derecho (~25 % del ancho) para detalle de sesión/pago, con scrim.
- Menús dropdown con grupos rotulados en gris y "Zona de Peligro" para acciones destructivas en rojo.

**Stepper de wizard**
- Horizontal, círculos numerados unidos por línea. Completado = círculo azul sólido + check blanco; activo = círculo blanco con anillo azul y número azul; pendiente = círculo `#F1F3F5` con número gris. Línea recorrida en azul.

### 1.5 Iconografía

Set de iconos de línea (estilo **Lucide/Tabler**, trazo 1.5–2 px). Mapeo observado:

| Concepto | Icono |
|---|---|
| Dashboard/Inicio | velocímetro / casa |
| Agenda | calendario |
| Pagos | billete/tarjeta; monedas para "Ingresos"/"Por cobrar" |
| Marketing | sobre |
| Configuración | engrane (chevron `>`/`^` cuando expande) |
| Comunidad | libro abierto |
| Pacientes | dos personas |
| Historial Clínico | reloj con flecha (historial) |
| Sesiones/Notas | documento |
| Archivos | documentos apilados / carpetas |
| Editar | lápiz · Eliminar: papelera · Más acciones: ⋯ |
| Filtro | embudo ▽ · Ordenar: ↑↓ |
| Ayuda contextual | círculo azul con "?" / ⓘ |
| Recordatorio | campana 🔔 |
| Paciente en evento | persona sólida · Presencial: pin 📍 · No pagado: **$ tachado** |
| Confirmación de sesión | doble check (gris = sin confirmar/recibido, azul = confirmado/leído) |
| Email | sobre ✉ · WhatsApp: logo WhatsApp |
| Vínculo a perfil | clip/enlace 🔗 · Copiar: icono copiar |
| Reordenar | drag-handle de 6 puntos · Regenerar: flechas circulares |
| Vista rápida | rayo ⚡ ("trueno", §3.4.4) |

---

## 2. Layout global

### 2.1 Header superior

- Fondo blanco, borde inferior `--color-border`.
- Izquierda: **logo wordmark** (minúsculas, navy) — en EscuchaInterna: `escuchainterna`. Junto al logo, icono de **colapsar sidebar**.
- Derecha: icono **campana** (notificaciones) y **avatar circular** con iniciales del usuario (verde `#22C55E`; abre menú de cuenta/cerrar sesión).
- (La generación nueva añade chips "Programa de referidos"/"Novedades" — **no** se incluyen en EscuchaInterna.)

### 2.2 Sidebar izquierdo — dos modos

Ancho ~260 px, fondo blanco, borde derecho. Estructura de arriba a abajo:

1. **Segmented control de 2 pestañas:** `Administración` | `Pacientes` (la activa con fondo resaltado). Cambia TODO el menú inferior.
2. **Buscador:** input lupa, placeholder `Buscar paciente`.
3. **Lista de pacientes recientes** (ambos modos): cards compactas — avatar circular de iniciales (pasteles verde/rosa/naranja), nombre en bold, teléfono, email truncado. El paciente seleccionado se resalta con `#E8F2FD`. Clic ⇒ abre su expediente y cambia el sidebar a modo Pacientes.
4. **Menú de navegación** (icono + label; ítem activo con fondo `#E8F2FD` y texto/icono azul):

**Modo "Administración" (orden exacto):**
1. `Dashboard` (velocímetro)
2. `Agenda` (calendario)
3. `Pagos` (billete/tarjeta)
4. `Marketing` (sobre)
5. `Configuración` (engrane, expandible `>`/`^`) — submenú indentado, orden exacto:
   - `Agenda`
   - `Pacientes`
   - `Perfil`
   - `Plantillas`
   - `Integraciones`
6. `Comunidad` (libro abierto)

(EscuchaInterna inserta `Biblioteca` entre Marketing y Configuración — ver §5.4.)

**Modo "Pacientes" (contexto del paciente seleccionado):**
1. `Inicio` (velocímetro)
2. `Historial Clínico` (reloj-historial)
3. `Sesiones` (documento, expandible) — subítems: `Ver todas` · `Notas con IA` · `Notas a mano alzada`
   *(EscuchaInterna: sin "Notas a mano alzada"; ver §5.1 — queda `Sesiones` con `Ver todas` y `Notas con IA`, más `Diagnóstico` §5.3)*
4. `Archivos` (documentos apilados)

5. **Footer del sidebar / de la app:** `© Todos los derechos reservados` (+ links `Política de Privacidad`, `Términos y Condiciones`).

### 2.3 Área de contenido

- Banda de header de contenido `#F8F8FA` con H1 (centrado en páginas de configuración, a la izquierda en módulos) + acciones a la derecha.
- En módulos de agenda: selector **`Zona horaria`** con icono reloj a la derecha del header.
- Breadcrumbs en contexto paciente: icono + sección (`Inicio`, `Sesiones / Notas con IA`, `Archivos`), segundo segmento azul tipo link.

### 2.4 Responsive

- **Desktop** (≥1280): sidebar fijo + contenido.
- **Tablet** (observado en iPad): mismo layout; sidebar persiste; grids de KPI fluyen a 2 columnas.
- **Móvil** `[INFERIDO]`: sidebar colapsa a drawer hamburguesa; tablas pasan a cards apiladas; calendario por defecto a vista semana/día; modales a pantalla completa.
- Es una **PWA instalable** (botón "Abrir en la app" observado) — EscuchaInterna: manifest + service worker básico.

---

## 3. Pantallas

### 3.1 Login

Observado: Auth0 Universal Login (página externa, en inglés). **EscuchaInterna implementa login propio replicando la composición:**

- Fondo de página **oscuro/negro**; **card blanca centrada** (radio 12, sombra), pequeño icono de escudo gris bajo la card.
- Componentes (traducidos): logo centrado arriba → título `Bienvenido` → subtítulo `Inicia sesión para continuar` → input `Correo electrónico*` (label flotante) → input `Contraseña*` con **icono de ojo** (mostrar/ocultar) → link azul `¿Olvidaste tu contraseña?` → botón primario ancho completo `Continuar`.
- Estados: requeridos con `*`; error de credenciales como mensaje rojo bajo el campo `[INFERIDO]`.

### 3.2 Onboarding (wizard de 9 pasos)

Pantallas a ancho completo, sin sidebar. **Stepper de 9 nodos** arriba. Cada paso: título centrado bold con subrayado azul + card blanca centrada + botonera centrada `‹ Atrás` (outline) / `Siguiente ›` (primario; deshabilitado gris hasta completar obligatorios); pasos opcionales añaden `Saltarse paso` (terciario). *(El original tuvo variantes de 7 y 9 pasos; esta es la secuencia canónica consolidada — orden de pasos 3/4/5 `[INFERIDO]` a partir de ambas variantes.)*

**Paso 1 — Bienvenida.** Headline gigante `Bienvenido a` + logotipo. Botón único centrado `Empezar ›` (gradiente teal, chevron).

**Paso 2 — `Empieza con tu perfil`.**
- Avatar circular grande verde con iniciales + botón flotante **lápiz** (subir foto).
- `Nombre:` (input; default = email de registro), `Celular:` (select país `🇲🇽 +52 (MX)` + input `Número de teléfono`), helper-link `¿Para qué se usa tu número de teléfono?` con badge circular azul "?", `Descripción:` (textarea, placeholder `Escriba su descripción...`).

**Paso 3 — `Configura cómo darás tus sesiones`** (organización). Card de 2 columnas:
- Izquierda — `¿De qué forma prefieres organizar tus sesiones?` con dos **radio-cards**:
  - `Pública` (icono candado abierto; seleccionada = borde/título azul) — `Podrás compartir un link a tus pacientes para que agenden contigo`.
  - `Privada` (candado cerrado) — `Solo tú podrás agendar sesiones con tus pacientes`.
- Derecha — `¿Qué tiempo suelen durar tus sesiones?` (select, default `1 hora`) y `¿Qué modalidad de sesiones sueles manejar?` (**chips segmentados de 3**: `Ambas` | `📹 Sólo virtual` | `📍 Sólo presencial`; seleccionado = fondo verde claro `#E6F7EF`, texto verde).

**Paso 4 — `Configura cómo darás tus sesiones`** (ubicación). Card de 1 columna:
- `¿Qué modalidad estará disponible cuando tus pacientes agenden una sesión contigo?` (select `Ambas`).
- `Describe cómo llegar al lugar de las sesiones (incluye dirección y ligas de ubicación si es necesario):` — **textarea grande** fondo gris, placeholder `Ej. La sesión será en la calle 10 Norte 2030, en el edificio color vino, en el segundo piso (Preguntar por la psicóloga Karla Hernández)`, contador `0/390 caracteres`. Obligatorio si la modalidad incluye presencial (`Siguiente` deshabilitado si vacío).

**Paso 5 — `Planifica tu disponibilidad`.** Card de 2 columnas con divisor vertical:
- Izquierda — `Disponibilidad de la semana`: fila por día (`Lun, Mar, Mié, Jue, Vie, Sáb, Dom`) con input hora inicio `09:00` (icono reloj) `–` hora fin `17:00` + `✕` (quitar rango) + `+` (añadir rango). L–V precargados 09:00–17:00; Sáb/Dom solo `+`. Soporta **múltiples rangos por día**.
- Derecha — `Días ocupados`: input fecha `dd/mm/aaaa` + dos time `--:--` – `--:--` (bloqueos puntuales). Link azul subrayado: `Estoy disponible en días específicos ›`.

**Paso 6 — `Configura tus tarifas y pagos`.**
- `Costo de la sesión` (input `$ 500.00`), `Moneda` (select `MXN`; opciones LATAM + CAD: `COP, CLP, ARS, PEN, CAD, PYG, …`).
- `Política de pago` — textarea **pre-llenada con plantilla editable** (texto exacto, §4.5).
- Checkbox marcado: `¿Mostrar el precio de la sesión al paciente al agendar?`.

**Paso 7 — `Crea tu primer paciente`** (opcional). Card estrecha con heading azul + icono persona `Datos del paciente`: `Nombre`, `Email` (placeholder `john.doe@example.com` → EscuchaInterna: `nombre@ejemplo.com`), `Teléfono` (compuesto). Botonera: `‹ Atrás` · `Saltarse paso` · `Siguiente ›`. Al crear: toast `¡Se ha creado al paciente {nombre} exitosamente!`.

**Paso 8 — `Conectar Aplicaciones`.** Card con filas de integración (icono | nombre + descripción | botón derecha):
- **Google Calendar y Meet** — "Conecta tu cuenta de Google para integrar con tu calendario. Sincroniza tus reservaciones y determina tu disponibilidad en función de tu calendario de Google. Genera enlaces de reuniones virtuales con Google Meet." → botón `Conectar`.
- **Stripe** — "Conecta tu cuenta de Stripe para habilitar cobros por reservaciones exitosas." → `Conectar`.
- (El original incluía Zoom con Connect deshabilitado + engrane; EscuchaInterna lo omite.)
- En EscuchaInterna estos botones operan contra **adaptadores locales stub** (§5.5) y muestran badge `Modo local`.
- Botonera: `‹ Atrás` / `Finalizar onboarding` (teal). *(Si se mantiene paso 9, este botón dice `Siguiente ›`.)*

**Paso 9 — `Todo listo para transformar tu consulta`.**
- Subtítulo: `Acceso completo para potenciar tu práctica profesional`.
- **Grid 2×2 de cards** (icono circular azul + título + descripción):
  1. 📅 `Agenda sin límites` — "Citas ilimitadas y recordatorios por WhatsApp"
  2. 👥 `Pacientes ilimitados` — "Gestiona todos tus pacientes sin restricciones"
  3. 📄 `Notas en un solo lugar` — "Escribe tus notas y tu historia clínica en un solo lugar" *(adaptado: el original decía "Escribe a teclado o a mano alzada en tablet")*
  4. 📈 `Organiza tus finanzas` — "Control de cobros y recordatorios automáticos"
- Banda gris con checkbox: `Acepto los términos y condiciones y la política de privacidad de la plataforma` (links azules).
- Botones: `‹ Atrás` / `Comenzar a usar EscuchaInterna ›` (primario).

### 3.3 Dashboard (`/dashboard`)

- H1 `Dashboard General`. Debajo: **navegador de mes** — botones cuadrados azul claro `‹` `›` + mes en azul bold (`septiembre, 2025`) + botón circular azul `?` (ayuda).
- Card flotante a la derecha del header: icono monedas + **`Por cobrar: $ {monto}`** (suma de sesiones sin pagar del mes).
- **Fila de 4 cards KPI** (icono + label arriba, valor grande con subrayado fino):
  1. `Pacientes` (icono dos personas) → conteo de pacientes atendidos en el mes.
  2. `Sesiones` (icono libro/agenda) → conteo de sesiones del mes.
  3. `Ingresos` (icono monedas) → `$ 300.00 MXN` (cobrado en el mes).
  4. `Métodos de pago` (icono tarjeta/billete) → desglose por método: label gris mayúsculas (`STRIPE`, `TRANSFERENCIA BANCARIA`, `EFECTIVO`…), monto, porcentaje azul (`100.00 %`) con **barra de progreso azul** debajo; una fila por método.
- **Gráfica histórica** `[PROPUESTO — no observada en el dashboard general]`: bajo los KPI, card a todo lo ancho `Histórico` con tabs `Ingresos | Sesiones | Pacientes` y gráfica de barras/línea de los últimos 12 meses (barras azul `#2180DB`, eje X meses abreviados, tooltip con valor exacto; mismo estilo que la gráfica de barras observada en el expediente, §3.7.1). El mes seleccionado en el navegador se resalta.
- **Estado vacío:** icono gris de pizarra con gráfico, título `Sin datos`, subtítulo `Parece que no hay actividad este mes.`; `Por cobrar: $ 0.00`.

### 3.4 Agenda (`/agenda`)

**Header del módulo (común a todas las vistas):**
- Título `Reservaciones` + a su lado el **link público de reservas** en azul (`https://{host}/agendar/{slug}`) con **icono lápiz** que abre el popover **`Link principal`**:
  - `Link principal` → prefijo fijo `https://{host}/agendar/` + **input editable del slug**.
  - `Links secundarios` → lista de links autogenerados por tipo de sesión (icono enlace): `…/{slug}/sesion-inicial`, `…/{slug}/sesion-presencial`.
  - Botones `Guardar` / `Cancelar`.
- Botones `Hoy` | `Anterior` | `Siguiente` (navegación temporal).
- Derecha: icono **embudo** (filtros) · botón primario **`+ Nueva Reservación`** · grupo de 4 icon-buttons: **sobre + WhatsApp** (tooltip `Ver historial de mensajes y correos` → vista 3.4.5), **lista ≡** (vista tabla), **calendario** (vista calendario). EscuchaInterna añade un 5.º icono **⚡ rayo** (vista rápida, §3.4.4).
- Segmented control `Mes` | `Semana` | `Día` (solo en vista calendario).
- Sobre la tabla (vista lista): `Recordatorios automáticos de sesión:` + checkbox azul + **icono engrane** (abre modal §3.4.7).

#### 3.4.1 Vista Mes
- Cabecera de días `lun | mar | mié | jue | vie | sáb | dom` (minúsculas, bold); número del día arriba-derecha de cada celda; días fuera de mes en gris; título centrado `Septiembre 2025`.
- Toast al cargar: `Todos los eventos cargados!` (check verde).
- **Chip de evento:** rectángulo redondeado, borde y texto azul sobre fondo blanco/azulado; fila de mini-iconos + hora + nombre del paciente:
  - icono **persona** = paciente asignado · **pin** = presencial · **$ tachado** = pago pendiente.
  - Chips **rosa pálido** = serie pasada/otro tipo de sesión; el color del dot del tipo de sesión tiñe el chip.
- Día seleccionado: celda con fondo `#DBEDFB`, número en bold.
- **Popover de día** ("ver más"): mini-card blanca elevada con la lista `hh:mm Nombre` de los eventos del día.
- Clic en evento ⇒ abre **drawer de detalle** (§3.4.6).

#### 3.4.2 Vista Semana
- Columnas = días (`01 lun … 07 dom`), filas = horas **06:00–23:00**; eventos como bloques posicionados. Mismos chips/iconos que Mes. (Vista `Día`: una sola columna, mismo patrón.)

#### 3.4.3 Vista Tabla (lista)
- Select de filtro a la izquierda: `Todas` (estados de reservación).
- Columnas exactas (con embudo/orden): `Nombre` | `Email` | `Celular` | `Fecha` | `Tipo` | `Tags` | (columna de icono **doble check** = confirmación, con filtro) | `Acciones`.
- Fila: icono 🔗 junto al nombre (abre expediente) · doble check gris = sin confirmar / azul = confirmada.
- **Acciones por fila:** botón outline `Marcar como completada` · botón terciario `🔔 Enviar recordatorio de Sesión` · menú `⋯` (editar/eliminar).
- Estado vacío: `Sin reservaciones` / `Todavía no tienes reservaciones registradas.`
- Paginación: `Filas por página [10] · 1-N de N · ‹ ›`.

#### 3.4.4 Vista rápida "trueno" ⚡ `[PROPUESTO — no observada en capturas; nombrada por requerimiento]`
- Se abre con el icono **rayo** del header. Panel lateral derecho (mismo patrón de drawer) titulado `Vista rápida — Hoy`.
- Lista cronológica de las sesiones del día: hora grande, nombre, tipo (dot de color), modalidad (pin/cámara), estado de pago ($ tachado/verde) y confirmación (doble check).
- Acciones de un clic por fila: `Confirmar` · `🔔 Recordatorio` · `Marcar pagada` · `Reagendar`.
- Pie: resumen `N sesiones · $ X por cobrar hoy` y botón `+ Nueva Reservación`.

#### 3.4.5 Vista "Historial de mensajes y correos" (registro WhatsApp/email)
- Activada con el icon-button sobre+WhatsApp. Tabla (todas las columnas con ▽ y ↑↓):
  - `Nombre` | `Tipo` | `Canal` | `Estado` | `Última actualización`.
  - `Tipo` ∈ `Sesión agendada`, `Sesión reagendada`, `Recordatorio de sesión`, `Recordatorio de pago (Sesión)`.
  - `Canal` ∈ `whatsapp` | `email` (cada notificación genera **dos filas**, una por canal).
  - `Estado`: WhatsApp → `✓✓ Recibido` (doble check gris) o `✓✓ Leído` (doble check **azul** `#3B82F6`); email → `✉ Recibido` (sobre gris). (En EscuchaInterna estos estados los simula el outbox local, §5.5.)
  - `Última actualización`: `4/9/2025, 10:17:24 p.m.` (formato `D/M/YYYY, h:mm:ss a.m./p.m.`).
- La misma tabla aparece como pestaña `Historial de mensajes` en Pagos (§3.8) y `Enviados` en Marketing (§3.9).

#### 3.4.6 Drawer "Sesión con {paciente}" (detalle de reservación)
- Header propio: título pequeño + ✕. Título grande `Sesión con David Ortiz` (icono copiar) + horario `11:00 PM - 12:00 AM`.
- Chip/link azul con icono enlace al paciente + **✕ roja** (desvincular).
- Dos columnas: 📞 `Celular` → número · ✉ `Email` → correo.
- Secciones con icono: 💬 `Comentarios del paciente` (solo lectura) · 🏷 `Tags` → input `Busca o agrega una etiqueta` (leyenda `Estás editando tus tags`; chips con ✕; dropdown de sugerencias, p. ej. `Enviar recordatorio de pago`, `Pago anticipado`, `No contesta`) · 📄 `Notas` → textarea `Añade aquí cualquier detalle sobre esta reservación` con autosave `Cambios guardados`.
- `Modalidad` → `Presencial`/`En línea` · `Detalles de la ubicación` → texto + link de Google Maps.
- En contexto Pagos el mismo drawer muestra además: 📅 `Fecha: {fecha larga}`, línea de estado de pago en verde `Pagado | {fecha} | {método}` y monto `$700.0 MXN`.

#### 3.4.7 Modales de la agenda

**`Crear Reservación`** (2 columnas):
- Izquierda: `Asignar paciente:` (combobox con dropdown: `Seleccione un paciente...` ✓ · `+ Crear paciente` · lista de pacientes con icono persona) · `Nombre: *` · `Email:` · `Celular:` (compuesto) — los tres se **autocompletan y bloquean** (gris) al asignar paciente · `Comentarios:` (textarea `Escriba su comentario...`).
- Derecha: `Tipo de Sesión:` (select; deshabilitado hasta elegir paciente) · fila precio `500.0` + moneda `MXN` + duración `1 hora` (heredados del tipo, editables) · `Fecha y hora:` (date + time + select de **recurrencia**) · `Modalidad de la sesión` (select `Presencial`).
- Select de recurrencia (opciones generadas según la fecha elegida, patrón Google Calendar): `No se repite` ✓ · `Cada semana el jueves a las 22:16` · `Todos los meses el primer jueves a las 22:16` · `Todos los meses el 4 a las 22:16` · `Personalizar`.
- `Guardar` deshabilitado hasta formulario válido; validación de teléfono en rojo.

**`Recurrencia personalizada`** (el original lo titula "Custom Recurrence"; EscuchaInterna lo traduce):
- `Repetir cada:` select numérico `1` (1–7) + select unidad `semana`.
- `Repetir el` → 7 botones circulares `D L M M J V S` (día activo relleno azul).
- `Finaliza` → radios: ◉ `nunca` · ○ `el` + input fecha · ○ `después de` + input numérico de repeticiones.
- Botones `Guardar` / `Cancelar`.

**`Editar Reservación`:** `Fecha y hora:` (date + time) + `Comentarios:` + `Cancelar`/`Guardar`.

**`Configuración de recordatorios automáticos`:**
- `Tiempo de anticipación del recordatorio` — select: `3 horas, 4 horas, 8 horas, 12 horas, 16 horas, 20 horas, 24 horas ✓`.
- Texto explicativo + regla de respaldo: si la reservación se crea con menos anticipación que la configurada, el recordatorio se envía select `1 hora` + `del inicio`.
- Nota gris al pie: los cambios solo aplican a reservaciones nuevas; las existentes conservan su configuración.
- `Cancelar` / `Guardar`.

### 3.5 Gestión de agendas — Configuración → Agenda (`/agenda/configuration`)

**Nivel global.** Título centrado `Configuración`; derecha `Zona horaria` (icono reloj + select).
**Tabs (orden exacto):** `Tipos de sesión` · `Disponibilidad` · `Pagos` · `Ubicación` · `Opciones`.

- **Tab `Tipos de sesión`:** grid de **cards de tipo de sesión** — título con **barra de acento vertical** del color del tipo; iconos lápiz/papelera arriba-derecha; metadatos: ⏱ `30m` · 💵 `$500.0 MXN`; descripción o `Sesión sin descripción`; **dot de color** abajo-izquierda; link azul `Ir a configuración →` abajo-derecha. Última card: borde punteado + botón circular `+`.
  - **Modal `Crear tipo de sesión`:** `Nombre:` (input + **círculo selector de color** a la derecha) · `Detalles:` (textarea) · `Cancelar`/`Guardar`.
- **Tab `Disponibilidad`:** mismo formulario del onboarding paso 5 (Disponibilidad de la semana multi-rango + Días ocupados + link `Estoy disponible en días específicos ›`).
- **Tab `Pagos`:** mismo formulario que el de tipo de sesión (abajo) pero a nivel global.
- **Tab `Ubicación`:** select de modalidad + textarea de indicaciones (390 chars).
- **Tab `Opciones`:** card `Opciones adicionales` —
  - ⏱ `Tiempo mínimo para reagendar o cancelar antes de la sesión` (select, `0 minutos`).
  - Toggle azul `Permitir agendar directamente a pacientes` (habilita la página pública).

**Nivel por tipo de sesión** (`/agenda/configuration/:id`). Header: `←` volver + nombre del tipo + dot de color; `Zona horaria` a la derecha. **Tabs:** `Opciones` · `Disponibilidad` · `Pagos` · `Ubicación`.
Patrón clave: checkbox **`Sobreescribir valores globales:`** arriba-derecha de cada tab — apagado = formulario gris/read-only heredando lo global (botón Guardar deshabilitado); encendido = editable. Autosave con toast `Guardando sus cambios, espere por favor...` / `¡Se ha guardado exitosamente!`.

- **Tab `Opciones` (reglas de reserva, estilo Calendly)** — dos columnas, formulario + Preview:
  - `Opciones de la sesión`: `Duración de la sesión` (select en incrementos de 5 min: `…35, 40, 45, 50, 55 minutos, 1 hora, 1 hora 15 minutos…`) · `Incrementos de tiempo para reservar` (select).
  - `Rango para reservar` — "Los pacientes pueden reservar...": radios ◉ `[60]` `días en el futuro` · ○ `entre` [fecha] `y` [fecha] · ○ `en cualquier fecha`.
  - `Tiempo entre sesiones`: `Antes` (select `0 minutos`) · `Después` (select `0 minutos`).
  - `Opciones adicionales`: `Tiempo mínimo para reservar` (select `8 horas`).
  - Columna derecha `Preview`: mini-calendario mensual con flechas ‹ › — refleja en vivo disponibilidad + reglas; días reservables en negro/bold, resto gris. (El original lo muestra en inglés; EscuchaInterna: en español — `Septiembre 2025`, `lu ma mi ju vi sá do`.)
- **Tab `Disponibilidad`:** igual al global (multi-rango por día + Días ocupados), bajo el checkbox de override.
- **Tab `Pagos`:** `Costo de la sesión` (numérico + select moneda `MXN`) · `Opción de pago` (select `Manualmente`) · `Opciones adicionales`: checkbox `¿Mostrar precio?` · checkbox `¿Mostrar link de pago al agendar?` · botón `Guardar opciones de pago` · columna derecha `Política de pago` (textarea `Escriba su política de pago`, `0/390 caracteres`).
- **Tab `Ubicación`:** igual al global (modalidad + textarea indicaciones + `Guardar cambios`).

### 3.6 Pacientes (`/patients`)

#### 3.6.1 Lista
- H1 `Pacientes`; derecha: botón primario `+ Nuevo Paciente` + botón `⋯` con dropdown: `Importar Pacientes` · `Exportar Pacientes`.
- **Tabla** — columnas: `Nombre` | `Email` | `Celular` | `Acciones` (todas con ▽/↑↓). Acciones: lápiz azul + `⋯` (eliminar → modal de confirmación §1.4).
- Semáforo en `Celular`: número inválido/mal formateado en **texto rojo** `#DC5F62`; válido en negro.
- Complementos de la generación nueva (incluir en EscuchaInterna):
  - Barra de búsqueda ancha `Buscar paciente por nombre o correo` + select `Filtrar por estado` (`Todos los estados`) + select `Ordenar por` (`Nombre`) con toggle asc/desc.
  - **Card de estadísticas:** número grande + `Pacientes`; `Distribución por estado` con barra de progreso y 4 mini-celdas: `ACTIVO n — %` (verde) · `ALTA n — %` · `ABANDONADO n — %` (naranja/rojo) · `EN PAUSA n — %`.
  - **Cards de paciente** (alternativa de grid): borde superior del color del estado; avatar, nombre, subtexto (`Sin primera sesión`), badge `• Activo`; filas teléfono/correo/próxima sesión (`Sin teléfono`, `Sin correo`, `Sin próxima sesión`); fila `Sesiones:` con `✓ 0 Asistencias` y `✗ 0 Canceladas`; pie: botón texto `Más` + botón azul claro `Ver paciente`. Paginación `‹ [1] › · Total N pacientes`.

#### 3.6.2 Modal `Nuevo Paciente`
- Campos: `Nombre` (placeholder `Juan Pérez`), `Email` (`nombre@ejemplo.com`), `Teléfono` (select país + `Número de teléfono`). Botón `Crear`. Alta mínima (los demás datos se completan en el expediente). Toast de éxito al crear.

#### 3.6.3 Importar CSV
- Desde `⋯ → Importar Pacientes` (file picker CSV/Excel). Formato de fecha requerido: **`YYYY-MM-DD`**.
- **Errores:** modal `Errores al importar pacientes` — tabla con header **rojo sólido `#ED3739`** texto blanco, columnas `Fila | Error` (filas sobre rosa claro; ej. `2 | Formato de fecha inválido (debe ser YYYY-MM-DD)`); pie: `Prueba a corregirlos e intentar nuevamente.` Acompañado de **toast de error**: `Hubo un error al importar los pacientes. Intenta nuevamente.` + botón `Ver errores`.
- Éxito parcial/total: refresca la tabla; teléfonos dudosos quedan en rojo para revisión.

### 3.7 Expediente del paciente (`/patients/:id/…`)

El sidebar pasa a **modo Pacientes** (§2.2). Título de página: nombre del paciente + badge de estado; derecha `+ Nueva Reservación` + `⋯`. Pestañas internas tipo navegador junto al logo para pacientes abiertos (chip con avatar + nombre + ✕) `[OBSERVADO en generación nueva]`.

#### 3.7.1 `Inicio` (`/patients/:id/dashboard`)
Layout de 3 columnas (izquierda datos, centro historia clínica, derecha notas/tareas):

- **Panel izquierdo — Datos del paciente** (card con lápiz ✎ que abre `Editar Datos`):
  - Cabecera: avatar, nombre bold, edad (`29 años`), badge `• Activo`, teléfono.
  - Filas-card editables (icono + LABEL EN MAYÚSCULAS + valor/placeholder): `INICIO DE TERAPIA` (`Asigne una fecha...`) · `ZONA HORARIA` (select, ej. `America/Mexico_City`) · `EMAIL` (`Escriba un email...`) · `CELULAR:`.
  - Sección `Sesiones`: `Última sesión — {fecha|No disponible}` + dos cajas de métrica: verde `n Con asistencia` (✓) y rosa `n Canceladas` (✗).
  - Fila `Necesita factura` con **toggle**.
  - Card azul claro `Motivo` (placeholder `Escriba una razón...`).
  - Fila acción teal `CAMBIAR ESTADO DEL PACIENTE / Gestionar estado` con chevron (cambia entre ACTIVO/ALTA/ABANDONADO/EN PAUSA).
  - Sección `Contactos`: vacío = `El paciente no tiene contactos adicionales registrados` + link `Agregar contactos` (lápiz).
- **Panel central — card `Historia Clínica`:** botón terciario `Utilizar plantilla` (icono portapapeles) + contenido. *(En EscuchaInterna este panel muestra el **resumen del formulario de historia clínica** con botón `Abrir historia clínica` — ver §5.2; el original tenía un editor rich-text con toolbar `B I U | H1 H2 H3 | ↶ ↷` e indicador `Guardado`.)*
- **Panel derecho:** card `Notas recientes` (botón `+`; vacío = `No hay notas recientes.`) · card `Tareas recientes` (vacío = `No hay tareas asignadas.`).
- **Card de gráfica** (abajo-izquierda): gráfica de barras de seguimiento (el original: "Anxiety Index", eje Y 0–1, eje X meses) — EscuchaInterna: `Índice de seguimiento` con ⓘ; alimentada por escalas registradas en sesiones `[INFERIDO]`.

**Modal `Editar Datos`:** `Nombre:` · `Email` · `Celular:` (compuesto) · **botón ancho outline con icono persona `{nombre del contacto de emergencia}`** (abre sub-modal) · fila de 2 fechas: `Fecha de nacimiento:` + `Fecha de inicio de terapia:` · `Motivo:` · `Cancelar`/`Guardar`.

**Modal `Contacto de Emergencia`:** `Nombre:` · `Email` · `Celular:` (select `Código de país` + `Número de teléfono`) · `Cancelar`/`Guardar`.

#### 3.7.2 `Historial Clínico` (`/patients/:id/history`)
- Página `Historia Clínica`. **En EscuchaInterna es el formulario estilo Google Forms (§5.2).** El original: editor rich-text + **modal `Plantillas de historial clínico`**:
  - Dos paneles: lista de plantillas a la izquierda (`Plantilla Default 1`, `Plantilla Default 2`, `+ Crear plantilla`), vista previa a la derecha (vacío = `Seleccione una plantilla para su vista previa`).
  - Nota al pie: `La nomenclatura como {NAME} indica que en ese lugar se colocará información de ese paciente en cuestión. Para ver todas las variables disponibles click aquí.`
  - Footer: `Cancelar` (link) / `Usar esta plantilla →` (deshabilitado hasta seleccionar).
- Contenido de anamnesis observado en la plantilla (insumo para §5.2): secciones **Genograma** (`Con quién vives:`, `Te gusta vivir con ellos:`, `Con quién duermes:`, `Cómo es la dinámica del hogar:`), **Nombre y edad de familiares cercanos**, **Historia Personal** (`Cuéntame de ti:`, `Cómo eras de chiquito:`, `Qué te gusta y qué no te gusta:`, `Qué tipo de persona te consideras:`, `Qué actividades te gusta realizar o hobbies:`, `Qué es lo que más te describe:`, `Qué es lo que menos te describe:`), **Historia Familiar** (`Cuéntame acerca de tu familia:`, `Cómo es tu relación con ellos:`, `Con quién sientes más confianza:`, `Con quién te entiendes más:`, `Con quién te entiendes menos:`, `Cómo han sido tus padres contigo a lo largo de la vida:`, `Te gustaría cambiar algo de ti con tu familia:`, `Te gustaría cambiar algo de tu familia:`), **Historia Social** (`Cómo te desenvuelves en la sociedad:`, `Te consideras una persona con habilidades sociales:`, `Quiénes son tus personas cercanas:`, `Qué tipo de relación tienes con tus personas cercanas:`, …), e `Historia de abuso de sustancias:`.

#### 3.7.3 `Sesiones` (`/patients/:id/sessions`)
- Breadcrumb `Sesiones` + título con nombre del paciente + botón primario `Nueva Sesión`.
- **Lista de sesiones:** cards/filas con título, timestamp relativo (`hace unos segundos`) y menú `⋯` `[el original muestra galería para notas a mano; EscuchaInterna: lista de cards de sesión con fecha, título y estado del reporte]`.
- **Modal `Nueva Sesión`** — en el original, dos choice-cards (`Usar Notas` con icono teclado / `Notas a mano alzada` con Excalidraw). **EscuchaInterna elimina la opción a mano alzada (§5.1)**: el modal pide solo título y fecha de la sesión `[ADAPTADO]`.
- **Detalle de sesión** (`/patients/:id/sessions/:sessionId`): banda de header gris con título (default del original: "New Session" → EscuchaInterna: `Nueva sesión`), subtítulo de tiempo relativo, dropdown `Opciones ⌄`. **Tabs:** `Transcripción` | `Reporte` | `Dudas` | `Notas`.
  - **`Notas`:** editor rich-text con toolbar `B I U | H1 H2 H3 | ↶ ↷`; autosave con indicador `Escribiendo...` / `Guardado`.
  - **`Reporte`:** vacío = botón primario centrado `Generar Reporte` (IA a partir de notas/transcripción). Generado = **editor de bloques en acordeón**: cards colapsables (ej. `Ideas principales` expandida, `Intervenciones según TCC`, `Preguntas para la siguiente sesión`), cada una con drag-handle de 6 puntos (reordenar), engrane (configurar/regenerar sección), papelera (eliminar); botones `+` circulares entre secciones (añadir); icono de flechas circulares arriba-derecha (regenerar todo).
  - **`Dudas`:** chat de IA. Columna izquierda: `Nueva conversación` (lápiz) + historial con títulos autogenerados. Estado vacío: avatar del bot + nombre (`Asistente`) + subtítulo `Realiza cualquier pregunta sobre la sesión a nuestro confiable asistente de IA`. Burbuja del usuario alineada a la derecha (fondo casi negro, texto blanco); respuesta del bot como texto plano a la izquierda. Input fijo abajo `Pregunta algo...` + botón circular enviar (flecha ↑).
  - **`Transcripción`:** contenido de audio transcrito; exportable.
  - **Menú `Opciones ⌄`** (grupos): `Transcripciones` → `Exportar` (deshabilitado si no hay) · `Reportes` → `Imprimir`, `Enviar al paciente` (avión de papel) · `Zona de Peligro` → `Eliminar` (rojo).

#### 3.7.4 `Archivos` (`/patients/:id/files`)
- Breadcrumb `Archivos` + título + botón primario `+ Añadir archivo`.
- **Dropzone** ancha: borde punteado azul, fondo gris claro, icono documento + texto azul `Arrastre hasta aquí sus archivos`.
- Tabla: `Nombre` | `Tipo` | `Tamaño` | `Fecha` | `Acciones` (ver/descargar/eliminar). Estado vacío: icono de descarga + `Arrastre hasta aquí sus archivos`. Paginación estándar.

#### 3.7.5 Generar expediente PDF `[ADAPTADO — el original solo imprime reportes]`
- Botón `⋯` del header del expediente → opción **`Generar expediente (PDF)`** (icono documento-descarga).
- Modal `Generar expediente`: checkboxes de secciones a incluir — `Datos del paciente` ✓ · `Historia clínica` ✓ · `Diagnóstico (CIE-11)` ✓ · `Sesiones y reportes` ✓ (con rango de fechas opcional) · `Lista de archivos` ☐. Botones `Cancelar` / `Generar PDF`.
- El PDF replica el estilo del producto: portada con logo + nombre del paciente, secciones con headings azules, respuestas del formulario de historia clínica en pares pregunta/respuesta, footer con paginación y fecha de generación.

### 3.8 Pagos (`/agenda/invoices`)

- Título centrado `Pagos`. **Tabs:** `Reservaciones` (activa, subrayada) | `Pacientes` | `Historial de mensajes`.
- Arriba-derecha, dos controles con ⓘ: `Recordatorios de pago:` checkbox/toggle (global) · `Solo completadas` checkbox.
- **Fila de filtros:** select de estado (`Cualquiera`, `Completadas`, …) · select/búsqueda `Buscar por paciente` · `Buscando por:` + chip azul claro del filtro aplicado.
- **Tabla** — columnas exactas: `Nombre` | `Costo` | `Fecha` | `Estado` | `Fecha de pago` | `Método de pago` | `Tags` | `Acciones`.
  - `Nombre` con icono 🔗 (abre drawer/expediente). `Costo`: `700.0 MXN`. `Fecha` en dos líneas: hora pequeña gris (`8:00 PM`) + `vie, 5 sept 2025`.
  - `Estado`: `Sin pagar` (rojo) / `Pagado` (verde). `Fecha de pago` y `Método de pago` vacíos (—) hasta pagar.
  - **Acciones (apiladas):** `Marcar como Pagado` (outline verde, icono recibo) · `Enviar recordatorio` (terciario azul claro, icono campana) + **icono copiar** (copia el texto/enlace del recordatorio).
- **Marcar como pagada** `[flujo INFERIDO]`: clic en `Marcar como Pagado` ⇒ mini-modal con `Fecha de pago` (default hoy) + `Método de pago` (select: `Efectivo`, `Transferencia bancaria`, `Stripe`, …) + `Guardar` ⇒ fila pasa a verde y alimenta KPIs del dashboard.
- **Drawer de detalle** (§3.4.6, variante pagos) con edición de tags.
- Tab `Pacientes`: saldo por paciente `[INFERIDO — no capturado]`. Tab `Historial de mensajes`: tabla §3.4.5 filtrada a recordatorios de pago.
- Estados vacíos: `Sin resultados` / `No encontramos reservaciones para tu búsqueda.` (icono lupa con "!").

### 3.9 Marketing (`/marketing`)

- Título centrado `Marketing`. **Tabs:** `Pacientes` (activa) | `Enviados`.

**Tab `Pacientes` (destinatarios):**
- Toolbar: búsqueda `Buscar...` · select de orden `Nombre ⇅` · derecha: `Editar Recordatorios` (outline) + `Enviar` (primario).
- **Tabla:** checkbox de selección (sin header) | `Nombre` | `Email` | `Teléfono` | **`Recordatorios`** (header agrupado con 2 sub-columnas identificadas por icono: **✉ sobre** = recordatorio de reactivación por correo · **🎂 pastel** = felicitación de cumpleaños). Checkbox azul por paciente y tipo.
- Seleccionar filas ⇒ chip `Pacientes seleccionados` y habilita `Enviar`.
- Paginación centrada `‹ [1] ›`.

**Modal `Enviar Email` (correo masivo):**
- **Chips de plantilla** (pills azul claro), texto exacto:
  1. `Descuento 50% en primera sesión para amigos/familiares`
  2. `Seguimiento de Bienestar`
  3. `Consejo/Tip de Bienestar`
  4. `Frase de Psicoterapia`
  5. `Descuento especial en curso o taller Online`
  6. `Apoyo para tus seres queridos`
- Campo `Título:` + campo `Mensaje:` (textarea). Clic en un chip rellena ambos (ver plantilla de ejemplo en §4.6).
- Nota con ⓘ: `Puedes usar {PATIENT_NAME} para el nombre del paciente, {MY_NAME} para tu nombre y {SCHEDULE_LINK} para la liga de agendar una sesión. Se reemplazarán automáticamente.`
- Botones `Cancelar` / `Enviar`.

**Modal `Editar Recordatorio`** (desde `Editar Recordatorios`; uno por tipo — cumpleaños 🎂 y reactivación ✉): campos `Título:` y `Mensaje:` precargados con las plantillas de §4.6/§4.7; `Cancelar`/`Guardar`.

**Tab `Enviados`:** misma tabla de registro que §3.4.5 (`Nombre | Tipo | Canal | Estado | Última actualización`), filas cebradas, paginación estándar.

### 3.10 Comunidad (`/community`)

- Título `Agenda Comunidad` + mes (`Septiembre`).
- **Lista de eventos** (filas con 2 eventos, divisores, icono calendario a los extremos). Card de evento: **bloque de fecha amarillo pastel `#F8EFA9`** (día de semana en minúsculas, número grande bold, hora) + categoría en bold + título/tema + descripción corta gris + ponente + link azul `Enlace` (acceso a la videollamada).
- Categorías observadas: `Hablemos`, `Pregúntale al Psiquiatra`, `Curso Elo` (→ `Curso`), `Analizando Artículos`, `Supervisión de Casos Grupal`, `Nutriendo mi consulta`.
- Pie: link azul `Ver eventos pasados →`.
- Generación nueva (referencia para EscuchaInterna §5.4): submenú `Eventos · Biblioteca · Cursos · Mis cursos`; detalle de curso con thumbnail, `Plan de estudios`, banner `Modo de vista previa`, dropdown de nivel (`1: Nivel 1 ⌄`) y lista de lecciones con chips de mes. En EscuchaInterna, Comunidad queda como **Eventos** (lista anterior, con datos seed locales) y **Biblioteca se promueve a módulo propio** (§5.4).

### 3.11 Configuración

Submenú: `Agenda` (§3.5) · `Pacientes` (§3.6) · `Perfil` · `Plantillas` · `Recordatorios` `[de la generación nueva]` · `Integraciones`.

**`Perfil` (`/profile`):**
- Card con: avatar circular grande con iniciales + lápiz (subir foto) · `Nombre:` (input) · `Celular:` (compuesto) · `Descripción:` (textarea multilínea — alimenta la página pública de reservas) · botón `Guardar`.

**`Plantillas`:** `[NO CAPTURADO — estructura INFERIDA]` gestor central de plantillas en dos grupos con tabs: `Historia clínica` (las 9 plantillas de §5.1: listar, previsualizar, duplicar, `+ Crear plantilla`) y `Mensajes` (plantillas de los mensajes del sistema de §4, editables con variables).

**`Recordatorios`:** consolida — toggle `Recordatorios automáticos de sesión` + su modal de anticipación (§3.4.7), toggle `Recordatorios de pago` (§3.8) y los recordatorios de Marketing (cumpleaños 🎂 / reactivación ✉, §3.9).

**`Integraciones`:** misma lista del onboarding paso 8 (Google Calendar y Meet, Stripe + filas para WhatsApp y Email en EscuchaInterna), cada una con icono, descripción, botón `Conectar`/`Desconectar` y badge de estado `Modo local` (§5.5).

### 3.12 Página pública de reservas (`/agendar/:slug`)

Página sin sidebar, fondo `#F7F8FA`. Título centrado `Agendar Sesión` + **stepper de 4 pasos**. Card blanca centrada de 2 columnas: **perfil del terapeuta a la izquierda** (avatar verde con iniciales, nombre bold, bio en gris de la Descripción del perfil; tras elegir tipo: fila ⏱ `1h` | 💵 `$ 500.0 MXN`) y el paso actual a la derecha. Flecha **↩** abajo-izquierda para regresar.

- **Paso 1 — `Tipo de sesión`:** select con icono calendario, placeholder `Seleccione un tipo de sesión`; debajo resumen vacío ⏱ `---` y 💵 `$ ---`; botón `Siguiente →` deshabilitado hasta elegir. (Los links secundarios `/agendar/:slug/:tipo` saltan este paso.)
- **Paso 2 — Fecha y hora:** calendario mensual (en español: `Septiembre 2025`, `lu ma mi ju vi sá do`) con flechas ‹ ›; días disponibles con píldora azul claro y número azul, no disponibles en gris. Al elegir día se carga la **franja de horarios** (lista de slots según disponibilidad + incrementos + buffers + antelación mínima) `[franja INFERIDA — el original muestra su placeholder de carga]`.
- **Paso 3 — `Datos de la sesión`:** formulario 2 columnas —
  - `¿Cómo te gustaría tener tu sesión?` (select: `Presencialmente` / `En línea`; visible solo si modalidad = Ambas)
  - `Nombre:` (placeholder `Nombre...`) · `Email:` (`ejemplo@correo.com`) · `Celular:` (select país + `Número de teléfono`)
  - Columna derecha: `Comentarios:` textarea con contador `0/250 caracteres`.
  - Si el tipo lo configura: precio visible y/o política de pago `[INFERIDO de los checkboxes de §3.5]`.
  - Botón primario `Guardar`.
- **Paso 4 — Confirmación `[NO CAPTURADO — INFERIDO]`:** card con check verde `¡Sesión agendada!` + resumen (fecha, hora, duración, modalidad, ubicación o link de videollamada, precio/política) + nota "Recibirás la confirmación por WhatsApp y correo" + botón `Agendar otra sesión`.

**Página de detalle de sesión para el paciente** (abierta desde "Ver detalles" del mensaje):
- Card centrada: título `Sesión con {terapeuta/paciente}` · esquina superior derecha: estado `Sesión sin confirmar` + icono doble check (gris = sin confirmar, azul = confirmada) · dos botones píldora `Cancelar Sesión` y `Cambiar fecha y hora` (deshabilitados según reglas de antelación) · separador · detalle en 2 columnas (label bold + valor): `Nombre:` · `Email:` · `Ubicación del consultorio:` (+ link Maps) · `Link de pago:` · `Fecha y hora:` · `Celular:`.
- Botón/acción `Confirmar asistencia` ⇒ doble check azul `[INFERIDO del botón del mensaje]`.

### 3.13 Registro de mensajes WhatsApp/correo

Ya especificado en §3.4.5; accesible desde tres lugares (icono sobre+WhatsApp de Agenda, tab `Historial de mensajes` de Pagos, tab `Enviados` de Marketing). En EscuchaInterna las filas provienen de la **tabla outbox** local (§5.5) y los estados (`En cola → Enviado → Recibido → Leído`) se simulan con transiciones temporizadas del adaptador stub.

---

## 4. Mensajes del sistema (WhatsApp + correo)

Reglas generales:
- Cada evento envía **por ambos canales** (WhatsApp y email) y registra dos filas en el outbox/registro.
- Formato WhatsApp: imagen de cabecera (ilustración con degradado cálido + icono de calendario), emojis por campo, **valores en negritas**, cierre con nota `Mensaje automatizado: no responder a este mensaje.` y **botones de plantilla** (`Ver detalles` ↗, `Confirmar asistencia` ↗).
- El email replica el mismo contenido con asunto = primera línea `[INFERIDO]`.
- Variables: `{PATIENT_NAME}`, `{MY_NAME}`, `{SCHEDULE_LINK}` (+ internas: fecha, hora con zona horaria, duración, ubicación, links).

### 4.1 Sesión agendada `[OBSERVADO — plantilla exacta]`

```
✅ Sesión agendada
Ha agendado una sesión con *{MY_NAME}*.

*Detalles de la sesión*
🗓️ *Fecha:* {DD/MM/YYYY}
⏰ *Hora:* {hh:mm AM/PM} ({GMT±hh:mm}) {Zona/Horaria}
⏳ *Duración:* {1h}
📍 *Ubicación:* {dirección del consultorio}
{link de Google Maps}
🔗 *Liga de pago:* {link de pago}

Más información en Ver detalles.
Mensaje automatizado: no responder a este mensaje.
[Botones: Ver detalles ↗ · Confirmar asistencia ↗]
```
Variante observada con sección `📍 *Ubicación del consultorio*` como bloque propio. En sesiones virtuales, `📍 Ubicación` se sustituye por `🎥 *Link de la sesión:* {link}` `[INFERIDO]`.

### 4.2 Sesión reagendada `[tipo OBSERVADO en el registro; cuerpo INFERIDO con el mismo formato]`

```
🔄 Sesión reagendada
Su sesión con *{MY_NAME}* ha cambiado de fecha y hora.

*Nuevos detalles de la sesión*
🗓️ *Fecha:* {DD/MM/YYYY}
⏰ *Hora:* {hh:mm AM/PM} ({GMT±hh:mm}) {Zona/Horaria}
⏳ *Duración:* {1h}
📍 *Ubicación:* {dirección} {link Maps}

Más información en Ver detalles.
Mensaje automatizado: no responder a este mensaje.
[Botones: Ver detalles ↗ · Confirmar asistencia ↗]
```

### 4.3 Recordatorio de sesión `[tipo OBSERVADO; cuerpo INFERIDO]`

Enviado según la configuración de anticipación (default **24 horas**; respaldo **1 hora** antes si la reserva se creó con poca anticipación — §3.4.7), o manualmente con `🔔 Enviar recordatorio de Sesión`.

```
⏰ Recordatorio de sesión
Hola {PATIENT_NAME}, te recordamos tu sesión con *{MY_NAME}*.

*Detalles de la sesión*
🗓️ *Fecha:* {DD/MM/YYYY}
⏰ *Hora:* {hh:mm AM/PM} ({GMT±hh:mm}) {Zona/Horaria}
⏳ *Duración:* {1h}
📍 *Ubicación:* {dirección} {link Maps}

Más información en Ver detalles.
Mensaje automatizado: no responder a este mensaje.
[Botones: Ver detalles ↗ · Confirmar asistencia ↗]
```

### 4.4 Recordatorio de pago (Sesión) `[tipo OBSERVADO; cuerpo INFERIDO]`

Enviado con el toggle `Recordatorios de pago` o manualmente desde Pagos (`Enviar recordatorio`).

```
💳 Recordatorio de pago
Hola {PATIENT_NAME}, tienes un pago pendiente de tu sesión con *{MY_NAME}*.

*Detalles del pago*
🗓️ *Sesión:* {DD/MM/YYYY} {hh:mm AM/PM}
💵 *Monto:* ${monto} {moneda}
🔗 *Liga de pago:* {link de pago}

{Política de pago del terapeuta}

Mensaje automatizado: no responder a este mensaje.
[Botón: Ver detalles ↗]
```

### 4.5 Plantilla de "Política de pago" `[OBSERVADA — texto exacto del default]`

```
💳 Pago y cancelaciones
El pago de tu sesión debe realizarse por adelantado para confirmar tu cita.
Puedes pagar en efectivo o por transferencia bancaria 🏦 Cuenta: 000000000
Una vez realizado el pago, tu espacio queda reservado.
No es posible cancelar con menos de 24 hrs de anticipación; en ese caso, la sesión se considera realizada.
```

### 4.6 Plantillas de Marketing `[OBSERVADAS — texto exacto]`

**Cumpleaños (🎂)** — Título: `¡Feliz cumpleaños, {PATIENT_NAME}!`
```
Hola {PATIENT_NAME},

Quería tomarme un momento para desearte un muy feliz cumpleaños. Espero que este nuevo año te traiga
mucha paz, alegría y momentos especiales rodeado de las personas que más quieres.

Que sea un día para celebrar, pero también para reconocer todo lo que has avanzado y lo que viene por delante.
¡Te lo mereces!

Un abrazo grande,
{MY_NAME}
```

**Reactivación (✉)** — Título: `¿Cómo has estado?`
```
Hola {PATIENT_NAME},

Estaba pensando en ti y en cómo has estado últimamente. A veces, la rutina o las responsabilidades diarias
hacen que dejemos de lado espacios importantes para nosotros mismos, como estos momentos de reflexión y
acompañamiento.

Si sientes que podría ser útil retomar nuestras sesiones, aquí estoy para acompañarte en lo que necesites. No
hay prisa, solo quería recordarte que este espacio sigue abierto para ti cuando lo consideres necesario.

Espero que estés bien. ¡Cuídate mucho!

Un abrazo,
{MY_NAME}
```

**Campaña ejemplo ("Descuento especial en curso o taller Online")** — Título: `¡Descuento exclusivo en mi curso de [tema]!`
```
Hola {PATIENT_NAME},

Por ser parte de mi comunidad, este mes te ofrezco un descuento exclusivo en mi
curso/taller de [nombre del curso]. Este cupón lo pueden usar tus amigos y familiares,
es una gran forma de fomentar el bienestar en la comunidad.

Código de Descuento: [descuento del curso]
Más info aquí: [Enlace del curso]

¡Espero que les guste!
{MY_NAME}
{SCHEDULE_LINK}
```
(Las otras 5 plantillas de campaña conservan título de chip observado; cuerpos `[INFERIDOS]` con el mismo tono y variables.)

---

## 5. Cambios para EscuchaInterna

La app que se construye se llama **EscuchaInterna**. Replica todo lo anterior con estas diferencias:

### 5.1 Sin notas a mano alzada — 9 plantillas de HISTORIA CLÍNICA

- Se **elimina** todo el flujo Excalidraw: la choice-card `Notas a mano alzada`, el subítem del sidebar, la galería `?type=excalidraw` y el selector de plantillas de lienzo.
- Las **plantillas por tipo de terapia pasan a ser PLANTILLAS DE HISTORIA CLÍNICA** (formularios estructurados, §5.2). Son **9**; las 6 observadas con su descripción exacta:
  1. **TCC** — "Plantilla de Terapia Cognitivo-Conductual (TCC), orientada a identificar y modificar pensamientos y conductas disfuncionales."
  2. **DBT** — "Plantilla de Terapia Dialéctica Conductual (DBT) enfocada en la regulación emocional, habilidades sociales y mindfulness."
  3. **TREC** — "Plantilla de Terapia Racional Emotiva Conductual (TREC), centrada en la identificación de creencias irracionales y su reestructuración."
  4. **TBCS** — "Plantilla para Terapia Breve Centrada en Soluciones (TBCS), enfocada en identificar recursos y construir soluciones prácticas."
  5. **Humanista** — "Plantilla inspirada en el enfoque Humanista, centrada en la empatía, la autenticidad y el crecimiento personal."
  6. **Psicodinámica** — "Plantilla basada en el modelo Psicodinámico, orientada a la exploración del inconsciente, los conflictos internos y las relaciones tempranas."
  7. **ACT** `[PROPUESTA — las capturas solo mostraron 6 de las plantillas; el modal tenía scroll]` — "Plantilla de Terapia de Aceptación y Compromiso (ACT), centrada en la flexibilidad psicológica y los valores."
  8. **Gestalt** `[PROPUESTA]` — "Plantilla del enfoque Gestalt, centrada en el aquí y ahora, la conciencia y el cierre de asuntos inconclusos."
  9. **Sistémica** `[PROPUESTA]` — "Plantilla de Terapia Sistémica/Familiar, orientada a los patrones de interacción y la estructura familiar."
- **Selector de plantillas:** se conserva el modal observado (`← Cambiar tipo de plantilla`, título `Seleccione una plantilla`, grid 3×3 de cards con miniatura de bloques pastel + nombre bold + descripción gris, selección con fondo `#CDE6F9`), pero la miniatura previsualiza las **secciones del formulario** (bloques pastel = secciones).
- Campos base heredados del lienzo TCC observado (núcleo común de toda plantilla): `Nombre`, `Fecha`, `Sesión #`, `Observaciones clínicas generales`, `Motivo de consulta`, `Contenido relevante de la sesión`, `Técnicas e intervenciones aplicadas`, `Avances y mejorías observadas` — más las secciones de anamnesis de §3.7.2 en la plantilla por defecto.

### 5.2 Historia clínica como formulario estilo Google Forms

Sustituye al editor rich-text de `/patients/:id/history`.

**Renderizado (modo llenado):**
- Columna central de ~720 px sobre fondo `#F7F8F9`.
- **Card de cabecera** con barra superior del color primario: título de la plantilla, descripción, chips de metadatos (paciente, fecha de creación, % completado con barra de progreso).
- **Una card blanca por sección** (radio 12, borde, barra de acento izquierda en un pastel rotativo de la paleta §1.1): título de sección bold + descripción opcional; dentro, las preguntas apiladas.
- **Pregunta:** label semibold (con `*` si obligatoria) + control + helper opcional. Autosave por campo (indicador `Guardado` arriba-derecha de la card).
- Navegación lateral flotante de secciones (lista con check de completitud) + botón `Generar expediente (PDF)`.

**Tipos de campo soportados:**
| Tipo | Control |
|---|---|
| Respuesta corta | input de texto |
| Párrafo | textarea autoexpandible |
| Opción múltiple | radios verticales (+ opción `Otro…` con input) |
| Casillas | checkboxes (+ `Otro…`) |
| Desplegable | select |
| Escala lineal | botones 1–10 en fila con etiquetas en extremos |
| Fecha / Hora | inputs nativos con icono |
| Número | input numérico con stepper |
| Sí/No | toggle |
| Cuadrícula | tabla filas×columnas de radios `[para escalas tipo inventario]` |

**Editor de plantillas (Configuración → Plantillas → Historia clínica):** lista de secciones reordenables (drag-handle de 6 puntos, mismo patrón del reporte §3.7.3), `+ Añadir sección` / `+ Añadir pregunta`, selector de tipo de campo, toggle `Obligatoria`, duplicar/papelera por pregunta, y soporte de variables `{PATIENT_NAME}`, `{MY_NAME}` en textos.

**Estructura de la plantilla por defecto (de la anamnesis observada §3.7.2):**
1. *Datos generales* (nombre, fecha de nacimiento, motivo de consulta — respuesta corta/fecha/párrafo)
2. *Historia del problema* (párrafos; incluye `Historia de abuso de sustancias`)
3. *Genograma* (4 párrafos: con quién vives / te gusta vivir con ellos / con quién duermes / dinámica del hogar)
4. *Familiares cercanos* (cuadrícula o lista nombre+edad+relación)
5. *Historia Personal* (7 párrafos observados)
6. *Historia Familiar* (8 párrafos observados)
7. *Historia Social* (4+ párrafos observados)
8. *Escalas iniciales* (escalas lineales 1–10: ansiedad, ánimo, sueño `[PROPUESTO — alimentan la gráfica de seguimiento]`)

### 5.3 Sección "Diagnóstico" — CIE-11 capítulo 06

Nuevo ítem en el sidebar modo Pacientes: **`Diagnóstico`** (icono portapapeles-check), entre `Historial Clínico` y `Sesiones`. Ruta `/patients/:id/diagnosis`.

- **Buscador jerárquico del CIE-11, capítulo 06** ("Trastornos mentales, del comportamiento y del neurodesarrollo"):
  - Input de búsqueda arriba (`Buscar por código o nombre… (ej. 6B00, ansiedad)`) con resultados resaltando la coincidencia y mostrando la ruta jerárquica (migas: agrupación › categoría › entidad).
  - Debajo, **árbol expandible** (chevrons) de todo el capítulo 06: agrupaciones (p. ej. "Trastornos de ansiedad o relacionados con el miedo") → entidades (`6B00 Trastorno de ansiedad generalizada`) → subcategorías. Código en monoespaciada gris + título; hover con fondo `#F5F6F7`; botón `+ Asignar` al final de cada fila.
- **Diagnósticos asignados:** cards apiladas arriba — chip del código (pill azul claro) + título + selector `Principal | Secundario` + campo `Especificadores/notas` (párrafo) + fecha de asignación + papelera. El diagnóstico principal se muestra como badge en la cabecera del expediente y se incluye en el PDF (§3.7.5).
- Datos servidos desde dataset local del CIE-11 cap. 06 (sin llamadas externas).

### 5.4 Nueva sección "Biblioteca" (~1000 libros)

Ítem propio del sidebar modo Administración: **`Biblioteca`** (icono libro abierto), entre `Marketing` y `Configuración`. (Comunidad conserva solo Eventos.)

UI basada en la "Biblioteca de la Comunidad" observada:
- H1 `Biblioteca` · flecha azul `←` (subir nivel) · **buscador centrado** `Buscar` (lupa; busca por título/autor en todo el catálogo) · breadcrumb azul/gris `Inicio / {Categoría}`.
- **Nivel categorías:** grid de 4 columnas de cards (icono carpeta azul + nombre bold). Categorías semilla observadas: `Manuales y Guías Clínicas` → `Adicciones`, `Suicidio`, `TDAH`, `Terapia de Familia`, `TCA`; ampliar con las categorías reales del catálogo de ~1000 libros (p. ej. `TCC`, `Psicoanálisis`, `Neuropsicología`, `Infanto-juvenil`, `Pareja`, `Evaluación y tests`, …).
- **Nivel libros:** grid de **cards de libro** — portada (o placeholder con iniciales sobre pastel), título bold (2 líneas máx.), autor en gris, badges (formato `PDF`/`EPUB`, año), menú `⋯` (`Abrir`, `Descargar`, `Detalles`). Toolbar con `Ordenar por` (`Título`, `Autor`, `Año`) y paginación estándar.
- **Drawer de detalle:** portada grande, título/autor/año/páginas, categoría (chips), sinopsis, botón primario `Abrir libro` + `Descargar`.
- Fuente de datos: índice local del catálogo (`Libros de psicología`), servido por el backend local.

### 5.5 Integraciones como puertos con adaptadores stub/outbox (todo local)

Arquitectura de puertos y adaptadores; la UI es idéntica a la real pero todo corre local:

| Puerto | Adaptador local | Comportamiento |
|---|---|---|
| `PaymentPort` (Stripe) | `StripeStubAdapter` | "Conectar" marca la integración como conectada (badge `Modo local`); genera links de pago ficticios `http://localhost/pay/{id}`; el pago se completa con un botón `Simular pago` en la página del link, que dispara el webhook interno (marca pagada, KPIs). |
| `CalendarPort` (Google Calendar/Meet) | `CalendarStubAdapter` | Persiste eventos en tabla local `calendar_events`; "genera" links de Meet ficticios `http://localhost/meet/{id}`; sin sincronización externa. |
| `MessagingPort` (WhatsApp) | `WhatsAppOutboxAdapter` | Cada envío inserta fila en tabla **`outbox`** (canal `whatsapp`, tipo, payload renderizado de §4). Estados simulados con transiciones temporizadas `En cola → Enviado → Recibido → Leído`. Vista previa del mensaje renderizado (burbuja estilo WhatsApp) al hacer clic en la fila del registro. |
| `EmailPort` | `EmailOutboxAdapter` | Igual: fila en `outbox` canal `email`, estados `En cola → Enviado → Recibido`; vista previa del correo. |

- La pantalla `Configuración → Integraciones` muestra cada fila con botón `Conectar` funcional (cambia estado local) y badge gris `Modo local — sin conexión externa`.
- El registro de mensajes (§3.4.5/3.13) lee directamente del outbox; el botón `🔔 Enviar recordatorio` y los automáticos (cron local de recordatorios con la anticipación de §3.4.7) escriben en él.
- Los puertos exponen interfaces limpias para sustituir los stubs por adaptadores reales (Stripe/Google/Twilio/SMTP) sin tocar UI ni dominio.

### 5.6 Otros renombres

- Marca: logo wordmark `escuchainterna` (navy `#33475B`); CTA final del onboarding: `Comenzar a usar EscuchaInterna ›`.
- "Elo Bot" → **`Asistente`** (chat de Dudas). "Curso Elo" → `Curso`. Remitente de mensajes: **EscuchaInterna**.
- Título default de sesión nueva: `Nueva sesión` (no "New Session").

### 5.7 Correcciones de calidad sobre el original (obligatorias)

1. **i18n 100 % español**: paginación (`Filas por página`, `1-10 de 10`), calendarios (`Septiembre 2025`, `lu ma mi ju vi sá do`), `Recurrencia personalizada` (no "Custom Recurrence"), `Código de país` (no "Country code"), placeholders (`Juan Pérez`, `nombre@ejemplo.com`).
2. **Tildes y gramática**: `Tipos de sesión`, `Ubicación`, `Política de pago`, `Número de teléfono`, `Métodos de pago`, `después de`, `Sesión sin confirmar` (no "sin confirmada"), `Sin primera sesión` (no "primea").
3. Botón de confirmación destructiva en **rojo** (el original usaba azul).
4. Evitar labels superpuestos con mensajes de validación (reservar espacio bajo el campo).
5. Formato de moneda consistente: `$ 500.00 MXN` (dos decimales, espacio antes del código).
