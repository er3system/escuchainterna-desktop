# Spec — Consultorios (sub‑unidades opcionales dentro de una organización)

Estado: PROPUESTA para revisión. No tocar código hasta aprobar.
Decisiones ya tomadas por el usuario:
1. **Pertenencia: un solo consultorio por miembro** (profesor/psicólogo/alumno).
2. **Recepción = asistente extendido** (ligado a la organización y a N consultorios, no a un solo titular), habilitado por un permiso de la organización.
3. **Spec primero** (este documento), luego construcción por fases con revisión adversarial.

---

## 1. Objetivo y alcance

Un **consultorio** es una sub‑unidad **opcional** dentro de una **organización** (p. ej. "Sede Centro", "Sede Norte", o un grupo clínico). Permite que el `org_master`:

- Cree varios consultorios y asigne profesores + alumnos/psicólogos a uno.
- Logre **aislamiento intra‑org**: un miembro del consultorio A **no ve datos clínicos** (pacientes, expedientes, agenda, supervisión) de un miembro del consultorio B.
- Tenga una **recepción** que, **si la org lo permite**, agenda para varios consultorios.

**Opcional y retrocompatible**: una org sin consultorios funciona EXACTAMENTE como hoy. `consultorio_id = NULL` en todos lados = comportamiento actual. El `org_master` **no pertenece a ningún consultorio** (queda fuera del aislamiento: ve todo).

**No‑objetivos** (por ahora): jerarquía de consultorios (anidados); mover un consultorio entre orgs; recepción cross‑organización.

---

## 2. Modelo de datos (migración **v43**, aditiva; nunca editar previas)

```sql
-- Sub-unidad dentro de una organización.
CREATE TABLE consultorios (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,           -- FK organizations
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0       -- soft-delete (no romper histórico)
);
CREATE INDEX idx_consultorios_org ON consultorios(organization_id);

-- A qué consultorio pertenece cada miembro (NULL = master / sin consultorio).
ALTER TABLE organization_memberships ADD COLUMN consultorio_id TEXT;  -- FK consultorios, nullable

-- Consultorio del paciente (heredado del dueño al crearse; NULL = sin consultorio / individual / legacy).
ALTER TABLE patients ADD COLUMN consultorio_id TEXT;                  -- FK consultorios, nullable

-- Permiso de la org para habilitar recepción multi-consultorio.
ALTER TABLE organizations ADD COLUMN reception_multi_consultorio INTEGER NOT NULL DEFAULT 0;

-- Recepción ↔ consultorios que atiende (asistente extendido a la org).
CREATE TABLE reception_consultorios (
  id TEXT PRIMARY KEY,
  assistant_user_id TEXT NOT NULL,         -- FK users (role='assistant')
  organization_id TEXT NOT NULL,           -- FK organizations
  consultorio_id TEXT NOT NULL,            -- FK consultorios
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_reception_consultorio ON reception_consultorios(assistant_user_id, consultorio_id);
```

**Cardinalidad** (decisión #1): la pertenencia de un miembro es un **atributo de su membresía** (`organization_memberships.consultorio_id`), no una tabla aparte. Un miembro = un consultorio. Suficiente y de mínima superficie de fuga.

**Pacientes**: `patients.consultorio_id` se setea al crear el paciente = el consultorio del dueño en ese momento. Si el dueño no tiene consultorio (org plana o master), queda NULL.

---

## 3. Reglas de aislamiento (el corazón de seguridad)

> El aislamiento NO es una pantalla: es una frontera de datos clínicos que debe hacerse cumplir en CADA punto de lectura/búsqueda. **Un check olvidado = fuga cross‑consultorio.** Por eso la Fase de enforcement va con revisión adversarial dedicada.

Regla base: **dos miembros de la misma org pero de distinto consultorio se tratan como si fueran de organizaciones distintas** (acceso negado), salvo el `org_master` (sin consultorio → ve todo).

Predicado canónico (a centralizar): `sameConsultorio(actorConsultorioId, targetConsultorioId)` →
`actorConsultorioId === null` (master/sin consultorio) **||** `targetConsultorioId === null` **||** `actorConsultorioId === targetConsultorioId`.

### Puntos de chequeo exactos (del mapeo del código actual)

| # | Archivo / función | Cambio |
|---|---|---|
| 1 | `src/shared/infrastructure/auth/patientAccess.ts` → `resolvePatientAccess()` | Tras validar `sameOrganization`, exigir `sameConsultorio(actor, tratante)`. Aplica a `coverage` y `share`. |
| 2 | `src/shared/infrastructure/auth/accessPolicy.ts` → `coverageAllowed()` | Nuevo parámetro `sameConsultorio: boolean`; rechazar si `sameOrganization && !sameConsultorio`. |
| 3 | `src/shared/infrastructure/auth/patientShares.ts` → `isActiveOrgMember()` | Filtrar por consultorio del actor: `(m.consultorio_id IS NULL OR m.consultorio_id = ?)`. |
| 4 | `patientShares.ts` → `activeShareForGrantee()` | Validar que grantee y owner comparten consultorio (o uno es NULL). |
| 5 | `SqlitePatientDirectory.findOwnership()` | Devolver también `consultorioId` (lectura transversal del resolutor). |
| 6 | `SearchPatients` / `SqlitePatientRepository.search()` | `AND (p.consultorio_id IS NULL OR p.consultorio_id = ?)` con el consultorio del actor. |
| 7 | Agenda `page.tsx` + scheduling reads | Acotar pacientes/calendario al consultorio del actor. |
| 8 | Supervisión: `SupervisionAccessReader`, `supervision_links` | Un profesor supervisa SOLO a supervisados de su mismo consultorio. |
| 9 | `/pacientes`, `/mensajes`, hub `/organizacion` | Listados filtrados por consultorio del actor. |
| 10 | Repos clínicos que tocan `patients` | Auditar que ninguna lectura profunda esquive el filtro (historia, sesiones, diagnóstico, archivos, cuestionarios, vínculos). |

**Invariante existente que NO se rompe** (`patientAccess.ts`): las lecturas profundas se acotan al `ownerUserId` del `PatientAccess`. El consultorio añade una condición **antes** de conceder ese `PatientAccess`; una vez negado, las lecturas profundas devuelven null como hoy.

---

## 4. Casos borde (definidos)

- **org_master sin consultorio** → ve todo (queda fuera del aislamiento). `consultorio_id` de su membresía = NULL.
- **Paciente sin consultorio** (`consultorio_id = NULL`): visible según las reglas de hoy (org plana / individual). No "cae" en ningún consultorio.
- **Supervisión**: el `UNIQUE(org, supervisor, supervised)` se mantiene; el enforcement exige que ambos compartan consultorio en tiempo de lectura (no hace falta cambiar el UNIQUE).
- **Compartir (shares)**: solo entre miembros del MISMO consultorio. (El master puede mover/asignar; un profesor no comparte cross‑consultorio.)
- **Reasignación / offboarding** (`patient_assignments` append‑only): al reasignar tratante puede cambiar el consultorio del paciente; el histórico conserva el consultorio anterior. Definir si el `record_access_log` necesita `consultorio_id` (propuesta: NO; se deriva por join si se requiere auditoría).
- **Importar pacientes (CSV)**: nacen con el consultorio del actor que importa (o NULL si el actor no tiene).
- **Cambiar a un miembro de consultorio**: el master puede mover un miembro de A→B; sus pacientes existentes **no** se mueven solos (decisión: mover miembro ≠ mover su cartera; ofrecer acción explícita "mover cartera" si se necesita, fuera de alcance inicial).

---

## 5. Recepción multi‑consultorio (asistente extendido — decisión #2)

- La recepción es una cuenta `role='assistant'` ligada a la **organización** y a un conjunto de consultorios (`reception_consultorios`), habilitada por `organizations.reception_multi_consultorio = 1`.
- **Diferencia clave con el asistente 1:1 actual**: el asistente de hoy resuelve UN titular (`resolveDataOwnerUserId`). La recepción NO auto‑resuelve un dueño: cada acción de agenda **elige explícitamente al profesional destino**, y la acción **valida** que ese profesional pertenece a uno de los consultorios de la recepción.
- Ve y agenda SOLO en las agendas de profesionales de sus consultorios asignados; nunca expediente clínico (igual que el asistente hoy).
- Se apoya en el **motor de huecos** ya construido (`computeFreeGaps`) para "cuándo está libre cada profesional".
- El `org_master` gestiona: alta de recepción, qué consultorios atiende, y el permiso de la org.

---

## 6. Fases verificables (cada una: tsc + tests + revisión adversarial)

- **F1 — Estructura (sin enforcement)**: migración v43; entidad `Consultorio` (dominio + repo Sqlite); CRUD del `org_master` para crear consultorios y asignar el `consultorio_id` de cada miembro; UI en `/organizacion`. Aún no aísla nada (solo guarda la pertenencia). Bajo riesgo.
- **F2 — Enforcement del aislamiento** (CRÍTICA): `sameConsultorio` centralizado + los puntos 1–6 del §3; tests de fuga (profesor A no alcanza paciente de B por cobertura/share/URL directa); **revisión adversarial multi‑agente** enfocada en fuga cross‑consultorio.
- **F3 — Pacientes + búsquedas**: `patients.consultorio_id` al crear; filtros en `SearchPatients`, `/pacientes`, agenda, mensajes (puntos 6, 7, 9). Tests de listado.
- **F4 — Supervisión acotada** (punto 8): profesor supervisa solo su consultorio; ajustar `SupervisionAccessReader`/UI `/supervision`.
- **F5 — Recepción multi‑consultorio** (§5): `reception_consultorios`, permiso de org, acción de agenda con profesional destino validado, UI de recepción.
- **F6 — Pulido UI**: hub de consultorios, selector/etiquetas de consultorio, estados vacíos, seed demo con 2 consultorios para probar el aislamiento.

Cada fase es un commit (o pocos) con su verificación; F2 y F5 llevan revisión adversarial obligatoria por ser las de mayor superficie de seguridad.

---

## 7. Invariantes a no romper

- Org **sin** consultorios = comportamiento idéntico al actual (todo `consultorio_id` NULL).
- `org_master` siempre ve todo (no se le aísla).
- **Regla de oro** owner_user_id intacta; el consultorio es una condición ADICIONAL, nunca un reemplazo del scoping por dueño.
- Ninguna lectura de pacientes/expediente puede esquivar el filtro de consultorio (auditar repos clínicos en F2/F3).
- La recepción nunca ve expediente clínico; solo agenda/contacto de sus consultorios.

---

## 8. Tests a añadir (mínimo)

- `sameConsultorio` (value-object/predicado) — tabla de verdad (master, NULL, igual, distinto).
- Resolutor: profesor de A pidiendo paciente de B → `null` por cobertura y por share.
- Búsqueda: `SearchPatients` de un miembro de A no incluye pacientes de B.
- Supervisión: profesor de A no obtiene acceso a supervisado de B.
- Recepción: agenda válida en consultorio asignado; rechazo en consultorio no asignado; rechazo si la org no habilitó la recepción multi‑consultorio.
- Retrocompat: org sin consultorios → 0 cambios de comportamiento (tests existentes siguen verdes).
