# Cuentas institucionales — propiedad-org, acceso configurable, offboarding · y documento de identificación del paciente

> **Estado:** diseño aprobado para implementar por sub-hitos (2026-06-14). NO empezar
> a codificar hasta que esta spec esté validada; luego, sub-hito por sub-hito con el
> ciclo de verificación de §10.
>
> **Contexto previo:** esta fase se construye SOBRE lo que ya existe (organizaciones,
> roles, supervisión, bitácora, consentimiento, núcleo de historia). No reemplaza el
> modelo multi-tenant: lo **estratifica**. Leer junto a `docs/expediente-v2-spec.md`
> (núcleo/bloques, "una sola fuente") y `docs/historia-clinica-spec.md`.

---

## 0. Resumen en una frase

Hoy un expediente pertenece a **una persona** (`patients.owner_user_id`). En cuentas
**institucionales** (universidades/clínicas) el expediente pertenece a la
**organización** (responsable del dato / *data controller*); las personas solo tienen
**acceso prestado** mientras son miembros. Por eso separamos dos capas que hoy están
fundidas en una sola columna:

- **PROPIEDAD** — quién es el responsable legal del dato. Fija. En individual = la
  persona; en institucional = la organización.
- **ACCESO** — quién puede abrir/operar el expediente ahora. Asignable y reasignable
  (tratante actual + supervisor), sin tocar la propiedad.

La continuidad cuando alguien se va = **reasignar el registro vivo** (cambiar quién
accede), **nunca** exportar a PDF y re-importar.

---

## 1. Modelo de propiedad vs. acceso

### 1.1 Lo que ya existe (no se toca)

El aislamiento multi-tenant se apoya en una sola columna, `owner_user_id`, presente en
`patients`, `bookings`, `clinical_records`, `session_notes`, `diagnoses`,
`patient_files`, `patient_reports`, `relational_cases`, etc. (migración v3 en
adelante). Los *choke points* verificados:

- Listado: `SqlitePatientRepository.search()` → `WHERE p.owner_user_id = ?`
  (`src/contexts/patients/infrastructure/persistence/SqlitePatientRepository.ts`).
- Detalle: `SqlitePatientDirectory.findSummary()` → `WHERE id = ? AND owner_user_id = ?`,
  y `if (!patient) notFound()` en `pacientes/[id]/layout.tsx`.
- Resolución del dueño: `resolveDataOwnerUserId(sessionUserId)` en
  `src/shared/infrastructure/auth/dataOwner.ts` (un asistente resuelve al
  `owner_user_id` del titular).
- Único cruce permitido hoy: **supervisión** (read-only), vía `supervision_links`
  (`scope_json {notas, historias, pagos}`), verificada en cada acceso por
  `requireSupervisionLink()`.

**Regla de oro intacta:** todas las consultas siguen filtrando por `owner_user_id`. La
capa institucional se monta encima sin debilitar ese filtro.

### 1.2 Lo que añade esta fase

Dos columnas nuevas en `patients` y una tabla de asignación.

```
patients.organization_id   TEXT  NULL     -- NULL = cuenta individual (sin cambios).
                                          -- No-NULL = paciente institucional; la org
                                          -- es la dueña/responsable del dato.

patients.owner_user_id     TEXT  (ya existe) -- PASA A SIGNIFICAR "tratante con acceso
                                          -- operativo AHORA". En individual = la
                                          -- persona (idéntico a hoy). En institucional
                                          -- = el estudiante/tratante asignado vigente.
```

> **Decisión clave (reusar el choke point en vez de duplicarlo):** `owner_user_id`
> sigue siendo el puntero operativo que TODAS las queries ya respetan. Reasignar un
> paciente institucional = `UPDATE patients SET owner_user_id = <nuevo tratante>`. Así
> el tratante asignado ve "sus" pacientes exactamente como hoy, sin tocar una sola
> query existente. La **propiedad** (responsable legal) queda anclada en
> `organization_id`, separada de quién accede.

La asignación autoritativa + su historia viven en una tabla nueva (no en
`owner_user_id`, que es solo el puntero vivo):

```sql
CREATE TABLE patient_assignments (
  id                  TEXT PRIMARY KEY,
  patient_id          TEXT NOT NULL REFERENCES patients(id),
  organization_id     TEXT NOT NULL REFERENCES organizations(id),
  tratante_user_id    TEXT,            -- NULL = retenido por la institución (sin tratante)
  supervisor_user_id  TEXT,            -- profesor responsable; NULL si aún no asignado
  status              TEXT NOT NULL DEFAULT 'activa', -- 'activa' | 'reasignada' | 'institucion'
  assigned_by         TEXT NOT NULL,   -- quién hizo la asignación (org_master/profesor)
  reason              TEXT NOT NULL DEFAULT '', -- 'alta' | 'reasignacion' | 'offboarding' | 'manual'
  created_at          TEXT NOT NULL
);
CREATE INDEX idx_assignments_patient ON patient_assignments(patient_id, created_at);
CREATE INDEX idx_assignments_org      ON patient_assignments(organization_id);
```

**Invariante** (la respeta el use case de asignación, no la BD):
para un paciente institucional, `patients.owner_user_id` ===
`tratante_user_id` de su asignación `status='activa'`, **salvo** cuando está retenido
por la institución (entonces `tratante_user_id IS NULL` y `owner_user_id` apunta al
custodio institucional, ver §3.3).

`patient_assignments` es **append-only en la práctica**: reasignar = marcar la fila
activa como `reasignada`/`institucion` e insertar una nueva `activa`. Eso da historia
de custodia auditable sin borrar nada.

### 1.3 Alta de un paciente institucional

Cuando el miembro de una organización crea un paciente (o llega por reserva pública a
un agenda institucional), si `context.organization` existe y la cuenta es institucional:

1. Se inserta `patients` con `organization_id = <org>` y `owner_user_id = <tratante que lo crea>`.
2. Se inserta `patient_assignments {tratante = creador, supervisor = supervisor activo del creador si lo hay, status='activa', reason='alta'}`.

En cuentas individuales (`organization_id IS NULL`) nada cambia: `owner_user_id = la persona`.

> **Cómo se decide "institucional":** la organización lo marca. Reusamos
> `organizations.kind` ('universidad' | 'clinica' | 'empresa') más una bandera
> explícita `organizations.patient_ownership` (ver §2.1) para no asumir que toda org
> es dueña de expedientes (una "empresa" podría no serlo). Por defecto
> `'institucion'` para universidad/clínica, `'individual'` para empresa.

---

## 2. Nivel de acceso configurable (no hardcodeado)

La política de quién puede abrir un expediente institucional **no se cablea**: la fija
la **institución** (org_master) como base y el **profesor** la ajusta dentro de los
límites que la institución permita.

### 2.1 Dónde vive la política

```
organizations.patient_ownership  TEXT  DEFAULT 'individual'
   -- 'individual' = los expedientes pertenecen a la persona (comportamiento actual)
   -- 'institucion' = los expedientes pertenecen a la org (esta fase)

organizations.access_policy      TEXT  DEFAULT 'estricto'
   -- preset BASE de la institución (ver §2.2)

organizations.professor_can_widen INTEGER DEFAULT 1
   -- 1 = el profesor puede ampliar el acceso de SUS supervisados dentro de lo
   --     permitido; 0 = la política de la institución es rígida.
```

> Estas tres columnas son aditivas sobre `organizations` (no se reescribe nada). Una
> alternativa evaluada era meterlas en `default_member_policies_json`; se descarta
> porque la política de acceso es estructural y conviene tenerla en columnas
> consultables, no enterrada en JSON.

El **ajuste del profesor** (cuando `professor_can_widen=1`) se guarda **sin migración**
reusando `user_preferences` (v14, clave-valor por dueño):
`{ owner_user_id: <profesorId>, key: 'access_policy', value: 'cobertura'|'intermedio'|'estricto' }`.
El efectivo de un estudiante = el más restrictivo entre `org.access_policy` (techo) y la
preferencia de su profesor (si la org lo permite ampliar/estrechar). El profesor nunca
puede superar el techo institucional.

### 2.2 Presets

| Preset | Qué ve un miembro |
|---|---|
| **`estricto`** (default) | Solo los expedientes que tiene **asignados** (su `owner_user_id`). Idéntico al aislamiento actual. |
| **`intermedio`** | El **profesor** ve todos los de **sus supervisados**; el **estudiante** solo los suyos. (Generaliza la supervisión actual.) |
| **`cobertura`** (colaborativo) | Cualquier miembro puede **buscar/abrir** cualquier expediente **de su misma organización** (cobertura entre colegas). |

### 2.3 Habeas data — todo acceso a un expediente NO asignado se traza

Más visibilidad es aceptable **siempre que quede trazada**. Hoy existe la bitácora
`record_access_log` (id, actor_user_id, patient_id, area, action default 'ver',
created_at; escritura con throttle de 10 min vía `logRecordAccess()`).

**Regla nueva:** cuando un miembro abre un expediente institucional que **no tiene
asignado** (cobertura o intermedio), se registra obligatoriamente con
`action = 'acceso_cobertura'` (valor nuevo del campo `action`, **sin** migración: la
columna es texto libre con default). El acceso al expediente propio sigue siendo
`'ver'`. La organización ya tiene la pantalla `/organizacion/accesos` que lista la
bitácora; basta con que distinga y resalte los accesos de cobertura.

> **Implicación de seguridad (señalada):** ampliar el acceso afloja el aislamiento por
> dueño, que es el principio inviolable nº 1. Lo compensamos con (a) el techo
> institucional, (b) la traza obligatoria de cobertura, (c) que cobertura/intermedio
> son **opt-in** por la institución (default = `estricto`). El acceso de cobertura es
> de **lectura ampliada**; escribir/operar sigue requiriendo asignación (o el flujo de
> reasignación de §3), para no diluir la responsabilidad clínica.

### 2.4 Dónde se aplica (el nuevo choke point de cobertura)

El acceso por asignación (caso normal) **no cambia**: `owner_user_id` ya filtra. El
acceso de **cobertura** es un segundo camino, análogo al de supervisión, encapsulado en
un lector nuevo:

- `resolveInstitutionalAccess(sessionUserId, patientId)` → decide si el actor puede ver
  un paciente que NO es suyo, consultando: ¿el paciente es institucional?, ¿el actor es
  de esa org?, ¿la política efectiva (org × profesor) lo permite?, ¿es supervisor del
  tratante? Si concede acceso por cobertura, **escribe el log** `acceso_cobertura` y
  devuelve un contexto de solo-lectura-ampliada.
- Se invoca desde `pacientes/[id]/layout.tsx` como *fallback* cuando
  `findSummary(ownerUserId, id)` da `null` pero el paciente existe en la org del actor.
  Nunca al revés: primero lo propio (asignado), luego cobertura trazada.

---

## 3. Offboarding — "desactivar, no borrar" + reasignar

Cuando un miembro se va/gradúa, **no se borra nada**. Se desactiva a la persona y se
reasignan sus pacientes para que ninguno quede huérfano.

### 3.1 Lo que ya existe

- Desactivar persona: `users.status` ('activo' | 'suspendido'); `SetMemberActiveStatus`
  → `account.suspend()`; el login bloquea a suspendidos. No se borra el usuario ni sus
  datos. **Esto ya cumple "desactivar, no borrar" a nivel de cuenta.**
- No existe estado separado en `organization_memberships` (no hace falta: la
  desactivación es por `users.status`).

### 3.2 Lo que falta — la reasignación de la cartera

Un nuevo use case `OffboardMember(orgId, leavingUserId, actor)` ejecuta, en orden:

1. **Desactivar** al miembro (`account.suspend()`) — no borra nada.
2. **Reasignar sus pacientes institucionales** (`patients WHERE organization_id=org AND owner_user_id=leaving`), uno a uno, con la **regla por defecto**:
   - Si el estudiante tiene **supervisor activo** (de su asignación vigente, y ese
     supervisor **no** está también inactivo) → el paciente pasa a **ese supervisor**
     (`owner_user_id = supervisor`, nueva asignación `tratante=supervisor`,
     `reason='offboarding'`).
   - Si **no hay supervisor activo** (ninguno asignado, o el supervisor también está
     inactivo) → el paciente pasa a la **institución** (ver §3.3).
   - **Nunca** queda huérfano.
3. **Revocar el acceso** del que se va: al estar suspendido no entra; además sus
   asignaciones activas se cierran (`status='reasignada'`).
4. **Retener el dato bajo la institución** (retención legal + continuidad): los
   `patients` y todo su contenido clínico permanecen; cambia el puntero de acceso, no el
   dato.
5. **(Opcional) Portafolio pseudonimizado** de los casos propios del que se va (§3.4).

El **org_master puede reasignar manualmente** cualquier paciente en cualquier momento
(no solo en offboarding) desde `/organizacion`.

### 3.3 "Pasar a la institución" sin romper el choke point

`owner_user_id` no puede quedar vacío sin romper todas las queries existentes. Solución:
retener bajo el **custodio institucional** = `organizations.master_user_id` (el
org_master representa a la institución como responsable del dato).

- `UPDATE patients SET owner_user_id = <master_user_id>`.
- Asignación nueva: `{ tratante_user_id = NULL, supervisor = NULL, status = 'institucion', reason = 'offboarding' }`.
- En la UI del org_master estos aparecen como **"Sin tratante asignado — retenido por la institución"**, accesibles por política hasta que se retomen, y con acción **"Asignar tratante"**.

Así `owner_user_id` siempre está poblado (cero queries rotas) y la capa de asignación
deja explícito que no hay tratante humano: el dato lo sostiene la institución.

### 3.4 Portafolio pseudonimizado (opcional, legítimamente suyo)

El que se va puede llevarse un **portafolio de SUS casos** (su trabajo clínico) en forma
**pseudonimizada**: nombres → iniciales/códigos, documento de identificación y datos de
contacto removidos, fechas conservadas. Es un export distinto del PDF firmable (§4):

- Nuevo use case `BuildPseudonymizedPortfolio(orgId, memberUserId)` que reúne los
  expedientes donde el miembro fue tratante y produce markdown → PDF por la tubería
  existente (Playwright server-side, como el expediente firmable), aplicando una
  transformación de pseudonimización determinista (un código estable por paciente).
- No incluye contenido `confidential` de casos relacionales ni de otros miembros.
- Es una **acción explícita aprobada por el org_master** (o por el propio miembro si la
  institución lo habilita), trazada en la bitácora.

---

## 4. Dónde vive el PDF (no es un mecanismo de continuidad)

El PDF **no** sirve para traspasar un expediente entre personas. Aplana el registro vivo
y rompe la continuidad. El PDF tiene tres usos legítimos y solo esos:

1. **"Historia clínica completa"** firmada (legal) — `patient_report kind='expediente'`,
   determinista, firmable, ya implementado.
2. **Portafolio pseudonimizado** del miembro que se va (§3.4).
3. **Compartir con el paciente o terceros** (a petición del titular del dato).

La pestaña **"Archivos"** (`patient_files`) sigue siendo para **adjuntos externos**
(escaneos, consentimiento en papel, documentos que trae el paciente), **no** para
archivar expedientes como PDFs muertos. La continuidad institucional es **reasignar el
registro vivo** (§3), nunca exportar-y-reimportar.

---

## 5. Documento de identificación del paciente

### 5.1 Qué es

Tipo + número de documento. Catálogo inicial **Colombia**: CC (cédula de ciudadanía),
TI (tarjeta de identidad), CE (cédula de extranjería), Pasaporte, NUIP/RC (registro
civil). Extensible a otros países (el tipo es un `key` con etiqueta; el catálogo es una
tabla de constantes en dominio, no un enum TS — union type, coherente con el resto del
proyecto).

### 5.2 Dónde se guarda — una sola fuente

> **Tensión de solape detectada y resuelta:** el campo "documento" toca DOS sitios — la
> sección **"identificación"** del núcleo de la historia
> (`builtin-historia-general`, hoy con: fecha-evaluación, ocupación, escolaridad,
> estado-civil, vive-con, referido-por; **sin** documento) **y** los filtros de
> `/pacientes` (que consultan la tabla `patients`, no la historia). Si se guarda en los
> dos lados habría dos fuentes de verdad → viola la regla inviolable "una sola fuente".

**Decisión:** la **única fuente** es la tabla `patients` (dos columnas nuevas). La
historia clínica **no** almacena una copia editable: su sección de identificación
**muestra y escribe sobre** el dato del paciente (read-through / write-back), nunca un
`answers_json` paralelo. Así el `/pacientes` filter y el núcleo leen lo mismo.

```
patients.document_type    TEXT NOT NULL DEFAULT ''   -- '' | 'CC' | 'TI' | 'CE' | 'PA' | 'RC' ...
patients.document_number  TEXT NOT NULL DEFAULT ''
```

### 5.3 Cuándo se captura

- **NO** requerido para reservar: el flujo público
  (`/reservar/[slug]`, `requestPublicBookingAction`) mantiene solo nombre/email/teléfono.
- **Debe existir / capturarse desde la PRIMERA SESIÓN**, como parte de la
  identificación del paciente: el formulario de alta interno (`/pacientes/nuevo`,
  `NewPatientForm` → `createPatientAction` → `CreatePatientMessage`) y el de edición
  ganan los dos campos; la sección "identificación" del núcleo los presenta para
  completar si faltan.

### 5.4 Búsqueda

`/pacientes` gana un filtro por **número de documento**: se extiende
`SearchPatientsQuery` / `PatientSearchCriteria` y la `WHERE` de
`SqlitePatientRepository.search()` con `AND p.document_number LIKE ?` (acotado, como
hoy, por `owner_user_id` — y, en institucional con cobertura, por `organization_id`).

### 5.5 PII y cifrado at-rest — decisión y por qué

> **Tensión señalada (privacidad ⟷ funcionalidad):** el brief pide "evaluar cifrado
> at-rest" Y que el documento sea **buscable**. Son incompatibles con el cifrado actual:
> `FieldEncryption` es **AES-256-GCM aleatorio** (IV por valor, prefijo `enc:v1:`), no
> determinista — no se puede hacer `LIKE`/igualdad sobre un campo así cifrado.

**Decisión:** guardar `document_type`/`document_number` **en claro**, igual que los
demás identificadores del paciente que ya se guardan en claro hoy (nombre completo,
email, teléfono, contacto de emergencia — `patients` **no cifra ningún campo** hoy; solo
se cifra el **contenido clínico**: notas de sesión, `answers_json`, reportes,
consentimientos). Cifrar solo el documento sería **inconsistente** (el nombre y el email
son igual de identificatorios y van en claro) y **rompería la búsqueda** requerida.

Mitigaciones que sí aplicamos: tratarlo como PII sensible (mismos controles de acceso
que el resto del paciente: aislamiento por dueño + bitácora), y removerlo del portafolio
pseudonimizado (§3.4) y de la página pública de sesión (que ya no expone documento).

> **Camino futuro (no ahora):** si la institución exige cifrado at-rest de
> identificadores, la vía correcta es un **índice ciego** (hash determinista con sal
> por-dueño para buscar) + valor cifrado para mostrar, aplicado de forma **uniforme** a
> nombre/email/documento, no solo al documento. Es un proyecto transversal aparte; esta
> spec lo deja anotado, no lo implementa.

### 5.6 Dedupe (nice-to-have, avisa — no bloquea)

Al guardar un paciente con un documento que ya existe **dentro del mismo dueño/institución**,
**avisar** (no bloquear): "Ya existe un paciente con este documento: <nombre>". El
booking público nunca bloquea por esto. Es un aviso de UI calculado en el server action,
no una restricción `UNIQUE` (un `UNIQUE` rompería el alta y el modelo institucional donde
el mismo documento podría reaparecer legítimamente).

---

## 6. Construir sobre lo que existe — inventario

**Ya existe (se reusa, no se reimplementa):**

- Organizaciones, roles (`admin | org_master | professor | psychologist | assistant`),
  `organization_memberships` (con `permissions_json`), `supervision_links` (scope
  granular, read-only), `SessionContext` (rol, org, permisos, `isSupervisor`,
  `dataOwnerUserId`).
- Aislamiento por `owner_user_id` + helpers de `dataOwner.ts`.
- Bitácora `record_access_log` + `logRecordAccess()` + `/organizacion/accesos`.
- Consentimiento (`patient_consents`, avisa, no bloquea).
- Núcleo de historia (`builtin-historia-general`, sección `identificacion`).
- Desactivar persona (`users.status`, `SetMemberActiveStatus`).
- Tubería PDF/firma (Playwright server-side) y `BuildCaseExport` (invariante de no
  filtrar `confidential`).

**Nuevo en esta fase:**

1. Propiedad-org de pacientes institucionales (`patients.organization_id`).
2. Capa de asignación paciente↔tratante↔supervisor (`patient_assignments`) + invariante
   con `owner_user_id`.
3. Política de acceso configurable (`organizations.patient_ownership / access_policy /
   professor_can_widen` + override de profesor en `user_preferences`) y el lector
   `resolveInstitutionalAccess` con log de cobertura.
4. Acción de reasignación + `OffboardMember` (regla supervisor-activo-si-no-institución).
5. Export de portafolio pseudonimizado.
6. Campo documento de identificación (`patients.document_type/number`) + filtro de
   búsqueda + captura en alta/edición/núcleo + dedupe-avisa.

---

## 7. Plan de migración (aditivo · v17)

Una sola migración nueva, **v17**, append-only (nunca editar v1–v16). Patrón existente:
`{ version, statements }`, transacción + `PRAGMA user_version`. Todo `ALTER ... ADD
COLUMN ... NOT NULL DEFAULT` o `NULL`.

```sql
-- v17 — Cuentas institucionales + documento de identificación
ALTER TABLE patients      ADD COLUMN organization_id  TEXT;                       -- NULL = individual
ALTER TABLE patients      ADD COLUMN document_type     TEXT NOT NULL DEFAULT '';
ALTER TABLE patients      ADD COLUMN document_number   TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_patients_org      ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_document ON patients(document_number);

ALTER TABLE organizations ADD COLUMN patient_ownership   TEXT NOT NULL DEFAULT 'individual'; -- 'individual'|'institucion'
ALTER TABLE organizations ADD COLUMN access_policy       TEXT NOT NULL DEFAULT 'estricto';   -- 'estricto'|'intermedio'|'cobertura'
ALTER TABLE organizations ADD COLUMN professor_can_widen INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS patient_assignments (
  id                 TEXT PRIMARY KEY,
  patient_id         TEXT NOT NULL REFERENCES patients(id),
  organization_id    TEXT NOT NULL REFERENCES organizations(id),
  tratante_user_id   TEXT,
  supervisor_user_id TEXT,
  status             TEXT NOT NULL DEFAULT 'activa',  -- 'activa'|'reasignada'|'institucion'
  assigned_by        TEXT NOT NULL,
  reason             TEXT NOT NULL DEFAULT 'alta',    -- 'alta'|'reasignacion'|'offboarding'|'manual'
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assignments_patient ON patient_assignments(patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assignments_org      ON patient_assignments(organization_id);
```

**Sin migración** (reuso): override de acceso del profesor en `user_preferences`
(v14, clave `access_policy`); valor `acceso_cobertura` del campo `record_access_log.action`
(texto libre).

**Retrocompatibilidad:** todos los pacientes existentes quedan `organization_id = NULL`
→ siguen siendo individuales, comportamiento idéntico. Ninguna query existente cambia su
resultado hasta que una org marque `patient_ownership='institucion'`.

---

## 8. Reglas inviolables (heredadas + de esta fase)

- **IA sugiere / humano aprueba** (nada de esta fase genera contenido clínico).
- **Aislamiento por dueño** sigue siendo la base; la cobertura es opt-in, acotada por
  organización y **siempre trazada** (habeas data). Escribir/operar requiere asignación.
- **Cifrado at-rest del contenido clínico** intacto (las columnas nuevas son
  identificadores no-clínicos, en claro como el resto de identificadores; ver §5.5).
- **Una sola fuente por contenido:** el documento vive solo en `patients`; el núcleo lo
  lee/escribe, no lo duplica.
- **Migraciones SIEMPRE aditivas**, nunca editar v1–v16.
- **No romper la suite de tests.**
- **El PDF no es continuidad** (§4): la continuidad es reasignar el registro vivo.

---

## 9. Sub-hitos verificables (cada uno = su commit)

Orden propuesto, de menor a mayor riesgo. Cada sub-hito: `npm run typecheck` →
`npm run test` → build aislado (`npm run build`) → verificación E2E en navegador
(preview MCP, cuentas demo: `maestro@uni-demo.test`, `profesor@uni-demo.test`,
`estudiante1@uni-demo.test` / `escucha2026`) → commit. No commitear `next.config.ts`.

- **H1 · Migración v17 + dominio de asignación.** Migración aditiva; entidad
  `PatientAssignment` + repo; tests de migración/round-trip. (Sin UI todavía.)
- **H2 · Documento de identificación.** Columnas + catálogo de tipos (CO) + alta/edición
  + sección identificación del núcleo (read-through) + dedupe-avisa. Verificar que el
  booking público **no** lo pide.
- **H3 · Filtro de búsqueda por documento** en `/pacientes` (`SearchPatientsQuery` +
  repo + UI del filtro). Verificar acotado por dueño.
- **H4 · Propiedad institucional + alta.** `organizations.patient_ownership`; alta de
  paciente institucional crea `organization_id` + asignación `activa`. Individual
  intacto.
- **H5 · Política de acceso + cobertura trazada.** `access_policy` /
  `professor_can_widen` + override de profesor; `resolveInstitutionalAccess` con log
  `acceso_cobertura`; `/organizacion/accesos` resalta cobertura. Verificar techo
  institucional y default `estricto`.
- **H6 · Reasignación manual** (org_master) desde `/organizacion`: cambiar tratante /
  retener-en-institución, escribiendo `owner_user_id` + nueva asignación.
- **H7 · Offboarding.** `OffboardMember` (desactivar + reasignar a supervisor-activo /
  institución + cerrar asignaciones). Verificar que ningún paciente queda huérfano.
- **H8 · Portafolio pseudonimizado** (export PDF del miembro saliente).

> Coordinación con el expediente en curso: H2/H3 tocan la identificación del núcleo y los
> filtros de `/pacientes` — implementar sobre el `builtin-historia-general` y
> `SearchPatientsQuery` actuales sin duplicar el dato (read-through), respetando la regla
> "una sola fuente" del expediente v2.

---

## 10. Verificación (ciclo por sub-hito)

Idéntico al del expediente v2: implementar → `npm run typecheck` → `npm run test`
(vitest) → `npm run build` (dist aislado en `.next-build`) → E2E navegador con preview
MCP y cuentas demo → commit con trailer
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
Gotchas conocidos: tras `npm run build` con dev server vivo puede corromperse `.next`
(`Cannot find module './vendor-chunks/...'`) → `rm -rf .next` + reiniciar preview. No
usar `--` como comentario en TS.
