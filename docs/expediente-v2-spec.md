# Expediente v2 — rediseño del expediente clínico (mini-spec)

> Estado: **aprobado en diseño** por el usuario (psicólogo). Implementación por
> fases. Diseño fundamentado en las 28 publicaciones propias
> (`data/publicaciones/`) y sometido a **revisión adversarial** (workflow
> `expediente-v2-design`). Spec-first: NO tocar código fuera de la fase en curso;
> cada fase = tsc + tests + build + verificación E2E (skill `run-escuchainterna`) + commit.

## 0. Contexto: de dónde venimos

Ya está hecho (commit `f4b95b5`) el **Expediente unificado**: una sola pestaña
"Expediente" que fusiona Historia clínica + Sesiones, con dos vistas —**Evolución**
(por defecto, la casa: registrar sesiones, línea de tiempo, "Iniciar historia
clínica" si no existe) y **Documento** (a la derecha: núcleo + bloques)—. Ruta
`/pacientes/[id]/historia?vista=evolucion|documento`. El "Integrar" se reencuadró
a "Proponer cambios al núcleo" (las sesiones ya viven en la Evolución).

Esta v2 profundiza el MODELO de contenido del expediente.

## 1. Visión

1. **"Iniciar historia clínica" = elegir una PLANTILLA-MODELO que define el
   enfoque** y aporta el núcleo (las preguntas globales de admisión adaptadas a
   ese modelo). Los modelos terapéuticos dejan de ser "bloques" y pasan a ser
   plantillas. Con **previsualizar** y **marcar por defecto**.
2. **Los bloques se curan**: tras mover los modelos a plantillas, los bloques
   quedan como piezas finas reutilizables (técnicas, evaluaciones, procesos) que
   se añaden al núcleo O a una sesión.
3. **Hilos de técnica**: una técnica usada en una sesión puede "continuar" en las
   siguientes (p. ej. "Evolución ABC"), semi-manual (la plataforma sugiere; el
   profesional acepta/quita).
4. **Documento = síntesis editable de la Evolución** (núcleo + bloques). Es el
   `clinical_record` consolidado, ya editable. NO confundir con la "Historia
   clínica completa" firmada (export PDF inmutable), que sigue aparte e intacta.
5. **Multi-track**: desde la Evolución se puede **pivotar / abrir un "registro
   aparte"** con otra plantilla a mitad de proceso (p. ej. pareja en la sesión 5).
6. **Asistente IA solo "preguntar"** (sin generar reporte), orientado a
   consultoría clínica; + **plantillas de técnica** que la IA puede sembrar.
7. **Vínculos pareja/familia**: épica aparte (**Fase 4**, diferida) — diseño ya
   hecho, ver §10.

## 2. Reglas inviolables del modelo (correcciones de la revisión)

- **UNA SOLA FUENTE por contenido**: cada pieza clínica es **núcleo de un modelo
  O un bloque, nunca ambos**. Si el núcleo de TCC ya trae "Análisis funcional
  A-B-C", ese contenido NO se ofrece además como bloque suelto en ese modelo (y
  viceversa: lo que es bloque transversal no se hornea en el núcleo).
- **Una técnica = UN solo artefacto** "técnica con seguimiento": un **formato
  inicial** (cómo se aplica) + una **variante de continuación** ("Evolución X").
  Fusionar los antiguos "hilos" y "plantillas de técnica" en este único concepto;
  no dos UIs paralelas.
- **Documento editable ≠ export inmutable**: el "Documento" es la vista editable
  del `clinical_record` consolidado (ya existe). La "Historia clínica completa"
  (`patient_report kind='expediente'`, firmable/PDF) sigue siendo el snapshot
  inmutable. Son dos cosas distintas; no se rompe la cadena de custodia.
- **Vocabulario de keys unificado**: una sola convención de `key` para los modelos
  y para `relevantModels` de los bloques (sin `humanista` vs `humanismo-centrado-persona`).
- Inviolables de siempre: **IA sugiere / humano aprueba**, aislamiento por
  `owner_user_id`, **cifrado at-rest** del contenido clínico (`answers_json`,
  `content`), y **no romper la suite** (hoy 445 tests).

## 3. Catálogo de modelos-plantilla (al "Iniciar historia clínica")

14 plantillas. "General" es la base transversal; el resto adapta el núcleo a su
enfoque. Contenido de núcleo fundamentado en la publicación homónima
(`data/publicaciones-src/html/<id>.html`) y reusando los campos buenos de
`builtinTemplates.ts` donde apliquen.

| key | nombre | publicación fuente | existe hoy en builtinTemplates |
|---|---|---|---|
| `general` | General (admisión transversal) | — (builtin-historia-general) | sí |
| `tcc` | Cognitivo-conductual (TCC) | tcc | sí |
| `trec` | TREC / Modelo ABC (Ellis) | trec-modelo-abc | **no (crear)** |
| `act` | Contextual (ACT y mindfulness) | act-mindfulness | **no (crear)** |
| `activacion-conductual` | Activación conductual | activacion-conductual | **no (crear)** |
| `dbt` | Dialéctico-conductual (DBT) | dbt | **no (crear)** |
| `psicodinamica` | Psicodinámica / psicoanalítica | psicodinamica | sí |
| `humanista` | Humanista / centrado en la persona | humanismo-centrado-persona | **no (crear)** |
| `gestalt` | Gestalt | gestalt | **no (crear)** |
| `sistemica-familiar` | Sistémica / familiar | sistemica-familiar | sí |
| `breve-soluciones` | Breve centrada en soluciones | breve-soluciones | **no (crear)** |
| `parejas` | Parejas | terapia-pareja | sí (pareja) |
| `infantil` | Infantil y adolescentes | psicologia-infantil + adolescencia | sí (infantil) |
| `evaluacion` | Evaluación / neuropsicología | — | sí (neuropsicologica) |

Cada plantilla-modelo: `key`, `name`, `enfoque`, `whenToUse` (1 frase),
`preview` (2-3 frases para previsualizar), `nucleoSections` (3-6 secciones con
campos). El diseño detallado de núcleo por modelo quedó redactado por el workflow
(fundamentado en las publicaciones); finalizarlo en Fase 2 leyendo cada
publicación + reusando builtinTemplates.

**Funciones nuevas**: previsualizar una plantilla antes de elegirla; marcar una
como **por defecto** del profesional (preferencia persistida por usuario).

> SMART NO es un modelo (era un ejemplo del usuario): los objetivos SMART son un
> **formato de campo** (campo "Objetivos terapéuticos (SMART)"), no una plantilla.

## 4. Catálogo de bloques curados

Piezas finas reutilizables; `addableIn` ∈ [primera | sesion | nucleo]; cada uno
declara `relevantModels` y si `hasContinuation` (genera hilo, §5).

- **Evaluación**: Examen mental · Evaluación del riesgo (suicida/autolesión/terceros) ·
  Genograma/mapa relacional · Escala SUDs · PHQ-9 · GAD-7 · Etapa de cambio y
  motivación · Escala/instrumento personalizado.
- **Técnica**: Plan de seguridad · Análisis funcional (A-B-C) · Registro de
  pensamientos automáticos · Distorsiones cognitivas · Creencias intermedias y
  nucleares · Debate de creencias irracionales (ABC-DE) · Jerarquía de exposición ·
  Activación conductual / programación · Habilidades DBT por módulo · Análisis en
  cadena · Valores y defusión (ACT) · Silla vacía / dos sillas · Pregunta del
  milagro y escalas · Prevención de recaídas.
- **Proceso**: Autorregistro / tarea entre sesiones · Defensas y transferencia.
- **Estructural**: Objetivos terapéuticos (SMART).

**Poda (removed)**: el catálogo actual `historiaBlocks.ts` deriva MECÁNICAMENTE un
bloque por cada sección de las 9 plantillas → se elimina esa derivación. Se quitan
los bloques que son redundantes con un núcleo-de-modelo (regla §2). `historiaBlocks.ts`
se **reescribe como catálogo CURADO** (no derivado), con su contrato (`category`,
`addableIn`, `relevantModels`, `hasContinuation`) y sus tests.

**Patrón "Otro → ¿cuáles?"**: las casillas/selección con opción "Otro/Otras"
despliegan un campo de texto **opcional "¿cuáles?"**. Extender el tipo de campo
(p. ej. `field.otherField?: boolean` o convención de opción especial) en
`builtinTemplates.ts` + el render en `@/components/clinical/FieldControl`.

## 5. Técnicas con seguimiento (hilos)

5 hilos (semi-manuales): cuando su técnica disparadora se usó antes, la plataforma
**sugiere** en sesiones siguientes un bloque de continuación (aceptar/quitar):

- Exposición (jerarquía/SUDs) → **"Evolución exposición"**
- ABC / reestructuración cognitiva → **"Evolución ABC"**
- Activación conductual → **"Evolución activación conductual"**
- Habilidades DBT → **"Evolución habilidades DBT"**
- Autorregistros / tareas → **"Evolución de tareas"** (transversal; define
  precedencia: si la tarea pertenece a otro hilo, usa ese).

Cada hilo: campos de continuación que registran el progreso de ESA técnica en ESA
sesión (p. ej. SUDs antes/después, ítem de jerarquía trabajado, adherencia a
tarea, obstáculo, siguiente paso). "Técnica activa" = usada en una sesión reciente
y no cerrada.

## 6. Sesión, Evolución y multi-track

- Registrar sesión sigue el modelo de la historia primaria (núcleo + plantillas de
  sesión 1ª/seguimiento que ya existen en `sessionTemplates.ts`).
- **Pivote / registro aparte** desde la Evolución: abrir otra plantilla-modelo a
  mitad de proceso (reusa `clinical_records.kind='registro'`). Definir cómo el
  registro aparte se relaciona con la historia primaria y aparece en la Evolución.

## 7. Asistente IA (poda)

- **Quitar** "generar reporte de sesión" (la rama `reporte` del AiPanel +
  `generateReportAction`/`GenerateNotesReport` quedan sin productor de UI).
- **Dejar** solo "preguntar a la IA", orientado a consultoría: prompts ejemplo
  ("recomiéndame una técnica para la rumiación", "¿qué opinas de la evolución de
  este caso?", "¿sería útil exposición aquí?", "diseña una intervención de 3
  sesiones para X"). El resultado puede **sembrar una plantilla de técnica**.
- **Plantillas de técnica** (la IA o el profesional las eligen): Reestructuración
  cognitiva · Exposición gradual · Activación conductual · Defusión/aceptación
  (ACT) · Análisis en cadena (DBT) · Plan de prevención de recaídas · Pregunta del
  milagro y escalas · Psicoeducación.
- Datos existentes: los `ai_interactions kind='reporte'` ya guardados quedan sin
  UI; decidir conservarlos en solo-lectura u ocultarlos (recomendado: ocultar,
  sin borrar).

## 8. Riesgo

Bloque de riesgo fundamentado en `riesgo-suicida` (C-SSRS): ideación, plan,
factores de riesgo/protección, restricción de medios, **plan de seguridad**.
Aclarar relación con el campo "Riesgo" que ya traen las plantillas de sesión
(`sessionTemplates.ts`): el bloque es la evaluación profunda (1ª entrevista /
cuando hay señal); el de sesión es el chequeo rápido por sesión.

## 9. Fases de implementación

- **Fase 0** — Poda de IA (AiPanel: quitar "generar reporte", dejar "preguntar";
  retirar `generateReportAction` de la UI; decidir destino de reportes existentes).
  *Verificado por la revisión: calza exacto con el código, bajo riesgo.*
- **Fase 1** — Unificar vocabulario de keys + fijar la regla modelo↔bloque (una
  sola fuente) + **"Otro→¿cuáles?"** + **previsualizar** + **marcar por defecto**.
- **Fase 2** — Crear los 7 modelos nuevos como plantillas (contenido de las
  publicaciones) + **reescribir `historiaBlocks.ts` como catálogo curado** (con
  contrato + tests). Incluye estrategia de **migración de IDs** de secciones ya
  guardadas en `sections_json` (ver §10).
- **Fase 3** — **Pivote de plantilla / registro aparte** desde la Evolución.
- **Fase 4** (épica aparte, diferida) — **Vínculos pareja/familia** (ver §10).
  Fusionar antes hilos+plantillas-de-técnica en el artefacto único (§2).

## 10. Migración y riesgos (de la revisión de coherencia)

- `clinical_records` **NO tiene** columna `scope` (solo id, patient_id, template_id,
  title, answers_json, sections_json, kind, owner_user_id, timestamps). Cualquier
  cosa que la asuma necesita migración nueva.
- `historiaBlocks.ts` deja de ser derivación mecánica de `BUILTIN_CLINICAL_TEMPLATES`
  → pasa a **catálogo curado**; rompe el contrato `HistoriaBlock` y sus consumidores
  (el editor). Reescribir con cuidado + actualizar tests.
- **IDs de sección en `sections_json`**: hoy un bloque añadido lleva id
  `${templateId}:${sectionId}`. Al recurar/renombrar bloques, las historias ya
  guardadas pueden quedar huérfanas → definir mapeo de migración de IDs.
- El "Documento editable" **no** debe colisionar con `patient_report kind='expediente'`
  firmado⇒inmutable (`SignedReportIsImmutableError`). Son distintos (§2).
- `generateReportAction`/`GenerateNotesReport` quedan huérfanos al podar IA: decidir
  conservar (solo-lectura) u ocultar; no romper `ai_interactions`.
- Reusar exactamente repos + columnas cifradas existentes; filtrar siempre por
  `owner_user_id`. Migraciones aditivas (`ALTER ADD COLUMN ... DEFAULT`), nunca
  editar migraciones previas.
- **Fase 4 (vínculos)** — diseño ya hecho (impecable clínicamente) a recuperar del
  output del workflow `expediente-v2-design`: entidad `relational_cases` +
  `case_members`; tres círculos de visibilidad (compartido del caso / privado del
  individual / privado-de-sesión-individual `confidential`); **consentimiento
  doble** por miembro + **política de secretos** obligatoria antes de la 1ª sesión
  individual; **cribado de violencia** que SOLO se hace por separado y puede poner
  el caso en `status='contraindicado'`; sesiones conjuntas que aparecen como
  entrada-referencia en cada individual sin duplicar; `relational_cases.owner_user_id`
  como frontera; **lanzar pareja primero, familia después**. NUNCA un export del
  caso debe filtrar contenido `confidential` de otro miembro (requisito de
  seguridad, no preferencia).

## 11. Decisiones cerradas (usuario)

- "SMART" era un ejemplo; **no** es modelo → objetivos SMART = formato de campo.
- Se hace primero el **expediente individual v2 (Fases 0–3)**; los **vínculos
  pareja/familia (Fase 4)** van como épica aparte.
- Regla **modelo↔bloque de una sola fuente**; técnica = artefacto único con
  continuación; Documento editable ≠ export firmado inmutable.
- Track **primario + poder pivotar** (no todos lo usarán, pero el hub lo contempla).
- Continuidad de técnica **semi-manual**; patrón **"Otro→¿cuáles?"**.
- IA **solo preguntar** (sin reporte) + plantillas de técnica.

## Apéndice — grounding durable

- Publicaciones curadas (modelos y temas): `data/publicaciones/manifest.json` +
  `data/publicaciones-src/html/<id>.html`.
- Plantillas/campos actuales a reusar/reclasificar:
  `src/shared/infrastructure/persistence/builtinTemplates.ts`.
- Catálogo de bloques a reescribir: `src/contexts/clinical-records/domain/historiaBlocks.ts`.
- Plantillas de sesión: `src/contexts/clinical-records/domain/sessionTemplates.ts`.
- Editor + componentes: `src/app/(app)/pacientes/[id]/historia/` y
  `@/components/clinical/FieldControl`.
