# Rediseño de Historia Clínica (mini-spec)

> Estado: **aprobado en diseño** por el usuario (psicólogo). Pendiente de
> implementación por sub-hitos. Este documento es el plano; la implementación
> puede refinar detalles técnicos respetando el modelo y los principios.

## 1. Problema y reencuadre

Hoy "Historia clínica" es **una pestaña más** del paciente, hermana de
"Sesiones" y "Diagnóstico". Para un psicólogo —y legalmente (Resolución 1995
en Colombia)— la historia clínica **es el expediente completo**: identificación,
anamnesis, evolución (sesiones), diagnósticos, plan. El nombre promete el todo
y entrega una parte → confunde ("¿dónde está la historia clínica de verdad?").

**Reencuadre:** *el paciente ES su historia clínica*. Abrir un paciente = abrir
su expediente. La pestaña que hoy se llama "Historia clínica" pasa a llamarse
**"Anamnesis"** o **"Ficha de ingreso"** (la *parte* de admisión), y deja de
competir con el todo.

Principio rector: **la modularidad es cómo se construye; el documento
consolidado (y su PDF firmado) es cómo se lee.** Mismo expediente, dos vistas.

## 2. Modelo conceptual

- **Historia clínica = documento vivo y consolidado** del paciente. Se actualiza
  sesión a sesión; si se exporta y luego siguen sesiones, sigue evolucionando.
- **Núcleo** (siempre presente) + **Módulos por enfoque** (opcionales, "las
  herramientas" de cada psicólogo) + **Evolución** (las sesiones integradas).
- **Export consolidado**: "Historia clínica completa", firmada. Comparte la
  tubería de PDF/firma con el **informe clínico** (que sigue siendo un documento
  *derivado* y aparte: extracto para un tercero).

### Núcleo (siempre)
1. Identificación (reusa datos del paciente)
2. Motivo de consulta
3. Anamnesis / historia del problema actual
4. Antecedentes (personales, médicos/psiquiátricos, consumo, familiares, desarrollo)
5. Historia biográfica (familiar, escolar/laboral, pareja/social)
6. Examen mental / observación clínica
7. Impresión diagnóstica (dx hipotético + CIE-11, enlaza con Diagnóstico)
8. Plan de tratamiento (objetivos, encuadre, frecuencia, técnicas)
9. **Evolución** (sesiones integradas, cronológico) — el corazón vivo
10. Riesgo (ideación, autolesión, etc.)
11. Cierre / alta / remisión · + Consentimiento (enlaza con el módulo existente)

### Módulos por enfoque (catálogo, se añaden con desplegable + buscador/lupa)
- **TCC**: análisis funcional ABC, registro de pensamientos automáticos,
  jerarquía de exposición, autorregistros/tareas
- **Conductual/ABA**: línea base, definición operacional de conducta, registro
  de frecuencia/intensidad, reforzadores
- **Tercera ola (ACT/DBT)**: matriz y valores (ACT), habilidades DBT, diario
- **Sistémico/familiar**: genograma (ya existe como *Mapa familiar*), hipótesis
  sistémica, mapa relacional
- **Psicodinámico**: vínculos, mecanismos de defensa, transferencia
- **Humanista/Gestalt**: fenomenología, recursos del consultante
- **Infantil**: hitos del desarrollo, observación de juego, reporte escolar
- **Evaluación/psicometría**: pruebas aplicadas, resultados, interpretación

### Sesión estructurada (alimenta la Evolución)
- **Primera sesión (rica)**: motivo · exploración · impresión/**dx hipotético** ·
  **plan inicial** · **tareas/ejercicios** · riesgo. *Siembra* la historia.
- **Seguimiento (ligera)**: cómo llega/avance · qué se trabajó hoy · técnicas
  aplicadas · tareas asignadas · plan próxima sesión · riesgo.

### Puentes desde la sesión
- **"Integrar a historia clínica"**: anexa un resumen de la sesión a la sección
  *Evolución* y, opcional, la IA **propone** actualizar bloques concretos del
  núcleo (plan, dx) que el profesional **aprueba** campo por campo.
- **"Pulir con IA"**: genera un borrador editable del texto. Nunca cambio
  automático.

## 3. Cómo se monta sobre lo existente (no se reconstruye)

Tablas actuales relevantes:
- `clinical_record_templates(sections_json, therapy_type, is_builtin, …)` —
  plantillas tipo Google-Forms con secciones+campos. **Base del catálogo de
  módulos.**
- `clinical_records(patient_id, template_id, title, answers_json, …)` —
  instancia rellenada. **Base de la historia clínica del paciente.**
- `session_notes(patient_id, booking_id, title, content, …)` — **base de la
  Evolución** y de la sesión estructurada.
- `diagnoses(…)` — impresión diagnóstica.
- `patient_reports(kind: clinico|legal|**expediente**, status:
  borrador|revisado|firmado, signed_by, license_number, signed_at, …)` — **ya
  existe `kind='expediente'` con firma**: es la tubería del export consolidado.
- `patient_files`, mapa familiar, consentimiento — se enlazan.

## 4. Plan de datos (migración v13 — NUNCA editar migraciones previas)

Decisiones a refinar en implementación, pero la dirección:
- **Catálogo de bloques (enfoque A+B aprobado por el usuario)**: NO se autorizan
  módulos nuevos. El catálogo del desplegable+lupa **deriva de las 9 plantillas
  integradas que ya existen** (`builtinTemplates.ts`): cada SECCIÓN de cada
  plantilla por enfoque (TCC, psicodinámica, familiar, infantil, pareja,
  neuropsicología, adicciones, triaje, general) se ofrece como un bloque
  reutilizable. El **núcleo** por defecto = secciones de "Historia general
  (adultos)". (B) Además se puede arrancar la historia desde una plantilla base
  y sumar bloques. Esto reusa el contenido clínico existente; no lo duplica.
- **Historia compuesta por paciente**: la historia clínica es **un**
  `clinical_record` marcado como primario. Para permitir añadir módulos por
  paciente, el registro guarda **su propio set de secciones compuesto**
  (snapshot): añadir columna `sections_json` a `clinical_records` (independiente
  del template), con `answers_json` por id de campo. Marcar el registro primario
  (p. ej. columna `kind='historia'` o `is_primary`).
- **Sesión estructurada**: `session_notes` gana `template_id` + `answers_json`
  opcionales (plantillas builtin "Primera sesión" y "Seguimiento"); se conserva
  `content` para texto libre. Marca de "integrada a historia" (timestamp/flag).
- **Auditoría de documento vivo**: conservar quién/qué/cuándo (reusar
  `record_access_log` / `updated_at`; registrar integraciones y aprobaciones).
- Cifrado at-rest se mantiene en los campos de contenido clínico (igual que hoy).

## 5. UI

- **Reencuadre de pestañas**: el detalle del paciente se presenta como el
  expediente; pestaña de admisión renombrada (Anamnesis/Ficha de ingreso).
  Evaluar el rótulo del módulo en el sidebar ("Pacientes" se mantiene o pasa a
  "Expediente"/"Historias clínicas" — decisión menor del usuario).
- **Editor de historia** (estilo Google-Forms ya existente) + control **"Añadir
  bloque"** con **desplegable + buscador** sobre el catálogo de módulos.
- **Vista de Evolución**: línea de tiempo que interleava sesiones (y cambios de
  dx) cronológicamente, dentro de la historia.
- **Sesión**: formulario por plantilla (1ª vs seguimiento) + botones "Integrar a
  historia clínica" y "Pulir con IA" (con aprobación humana de sugerencias,
  reusando el flujo `suggestRecordUpdates` ya existente).
- **Export**: botón "Historia clínica completa" → ensambla núcleo + módulos +
  evolución + diagnósticos en un `patient_report` `kind='expediente'`, firmable
  (reusa Playwright PDF + firma). El informe clínico/legal sigue como documento
  aparte derivado.

## 6. Principios inviolables

- **IA sugiere, humano aprueba.** Nunca reescritura automática (documento legal).
- **Aislamiento por `owner_user_id`** en toda lectura/escritura (regla de oro).
- **Cifrado at-rest** del contenido clínico.
- **No romper lo existente**: la suite (411 tests) debe seguir verde; el flujo
  actual de sesiones/expediente sigue funcionando durante la transición.

## 7. Sub-hitos de implementación (cada uno: tsc + tests + build + verificación + commit)

1. Migración v13 + dominio (catálogo de módulos, historia compuesta, sesión con
   plantilla) + seeds builtin.
2. Catálogo/biblioteca de bloques con desplegable + buscador en el editor.
3. Sesión estructurada (plantillas 1ª vs seguimiento).
4. Puentes "Integrar a historia clínica" + "Pulir con IA" (aprobación humana).
5. Export consolidado "Historia clínica completa" firmada (tubería compartida).
6. Reencuadre de navegación + renombrado de la pestaña de admisión.

## 8. Criterios de aceptación

- Abrir un paciente comunica claramente "esto es su historia clínica".
- Se puede añadir un módulo por enfoque desde un buscador y queda en la historia.
- Una sesión se integra a la Evolución y la IA propone (no aplica) cambios al
  núcleo, que el profesional aprueba.
- Se exporta "Historia clínica completa" firmada en PDF; el informe sigue aparte.
- 411+ tests verdes; sin regresiones en agenda/pagos/IA existentes.
