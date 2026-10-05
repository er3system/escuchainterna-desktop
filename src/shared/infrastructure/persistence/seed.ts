import type { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type { DatabaseAdapter } from './DatabaseAdapter';
import { BUILTIN_CLINICAL_TEMPLATES } from './builtinTemplates';
import { seedDemoData } from './demoData';
import { isProduction } from '../config/runtime';
import { isDesktopEdition } from '../config/desktopEdition';
import { assertStrongPassword } from '@/contexts/identity/domain/value-objects/passwordPolicy';

/**
 * Datos de referencia de la plataforma compartidos entre el seed SÍNCRONO de
 * SQLite (`runSeed`) y el ASÍNCRONO de Postgres (`runSeedOnAdapter`), para que NO
 * deriven entre motores. Los `params` van en el orden de columnas del INSERT.
 */
const PLAN_SEEDS: Array<readonly [
  id: string, name: string, pricesJson: string, aiBudget: number | null,
  aiSoft: number | null, featuresJson: string, highlighted: number, sortOrder: number, storageGb: number,
]> = [
  ['esencial', 'Esencial',
    JSON.stringify({ COP: 79000, MXN: 349, USD: 19, EUR: 18, ARS: 28000, CLP: 18000, PEN: 70 }),
    8000, null,
    JSON.stringify([
      'Agenda y recordatorios ilimitados',
      'Pacientes y expedientes ilimitados',
      'Historia clínica con plantillas y CIE-11',
      'Pagos y facturación',
      'IA con uso limitado mensual',
      'Biblioteca EscuchaInterna',
    ]),
    0, 1, 5],
  ['profesional', 'Profesional',
    JSON.stringify({ COP: 149000, MXN: 649, USD: 36, EUR: 33, ARS: 53000, CLP: 34000, PEN: 135 }),
    null, 25000,
    JSON.stringify([
      'Todo lo del plan Esencial',
      'IA sin bloqueos de uso (uso justo mensual)',
      'Sugerencias de IA a la historia clínica',
      'Reportes clínico-legales asistidos',
      'Temas de correo personalizados',
      'Soporte prioritario',
    ]),
    1, 2, 15],
  ['organizacion', 'Organizaciones',
    JSON.stringify({ COP: 90000 }),
    null, 18000,
    JSON.stringify([
      'Precio por profesional que baja con el tamaño del equipo',
      'Perfil maestro con permisos por miembro',
      'Supervisión académica de practicantes',
      'Retención de porcentaje por cobro',
      'Logo y marca de tu institución',
      'Acompañamiento en la implementación',
    ]),
    0, 3, 50],
];

const AI_COSTING_JSON = JSON.stringify({
  copPerUsd: 4200,
  // Premium = Sonnet 5 (calidad casi-Opus para lo clínico/riesgo). Precio de lista
  // 3/15 USD por MTok; el descuento de lanzamiento (2/10 hasta 2026-08-31) NO se
  // refleja aquí a propósito: costear al precio de lista mantiene la estimación
  // CONSERVADORA (nunca sub-factura el tope de presupuesto ni el dashboard).
  modeloPremium: 'claude-sonnet-5',
  modeloEconomico: 'claude-haiku-4-5',
  tarifas: {
    'claude-sonnet-5': { inPorMTok: 3, outPorMTok: 15 },
    // Se conserva la tarifa del modelo anterior para costear correctamente
    // cualquier evento histórico registrado con él.
    'claude-sonnet-4-6': { inPorMTok: 3, outPorMTok: 15 },
    'claude-haiku-4-5': { inPorMTok: 1, outPorMTok: 5 },
  },
});

/**
 * Seed ASÍNCRONO de DATOS DE REFERENCIA para Postgres (vía el puerto async),
 * idempotente. Lo corre `bin/seed` tras `bin/migrate` en un despliegue. NO siembra
 * datos demo (eso es solo-dev). Espejo del camino de producción de `runSeed`
 * (que sigue siendo síncrono para el boot de SQLite); los datos viven en las
 * constantes de arriba para no derivar entre motores.
 */
export async function runSeedOnAdapter(db: DatabaseAdapter): Promise<void> {
  // Proveedores globales de plataforma (owner_user_id = '').
  for (const provider of ['whatsapp', 'email']) {
    await db.execute(
      `INSERT INTO integration_connections (id, provider, owner_user_id, status)
       VALUES (?, ?, '', 'desconectado') ON CONFLICT DO NOTHING`,
      [randomUUID(), provider],
    );
  }

  // Las automatizaciones NO se siembran: sus defaults viven en el dominio y el
  // repositorio materializa solo personalizaciones ligadas a un owner_user_id.

  // Plantillas clínicas integradas (idempotente por id).
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM clinical_record_templates WHERE is_builtin = 1`,
  );
  const existingIds = new Set(existing.map((row) => row.id));
  for (const template of BUILTIN_CLINICAL_TEMPLATES) {
    if (existingIds.has(template.id)) continue;
    await db.execute(
      `INSERT INTO clinical_record_templates (id, name, therapy_type, description, sections_json, is_builtin, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING`,
      [template.id, template.name, template.therapyType, template.description, JSON.stringify(template.sections), new Date().toISOString()],
    );
  }

  // CIE-11 (catálogo): solo si está vacío y existe el dataset.
  const cie11Count = await db.queryRow<{ n: number }>('SELECT COUNT(*) AS n FROM cie11_entries');
  if ((cie11Count?.n ?? 0) === 0) {
    const datasetPath = path.resolve(process.cwd(), process.env.CIE11_DATASET_PATH ?? './data/cie11/cie11.json');
    if (fs.existsSync(datasetPath)) {
      const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as {
        entries: Array<{ code: string; title: string; parent: string | null; level: number; chapter: string }>;
      };
      await db.transaction(async () => {
        for (const entry of raw.entries) {
          await db.execute(
            `INSERT INTO cie11_entries (code, title, parent, level, chapter) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
            [entry.code, entry.title, entry.parent, entry.level, entry.chapter],
          );
        }
      });
    }
  }

  for (const plan of PLAN_SEEDS) {
    await db.execute(
      `INSERT INTO plans
        (id, name, prices_json, ai_monthly_budget_cop, ai_soft_budget_cop, features_json, highlighted, sort_order, storage_limit_gb)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [...plan],
    );
  }

  await db.execute(
    `INSERT INTO platform_settings (key, value_json) VALUES (?, ?) ON CONFLICT DO NOTHING`,
    ['ai_costing', AI_COSTING_JSON],
  );

  await bootstrapProductionAdminOnAdapter(db);
}

/** Bootstrap del PRIMER admin en producción vía el adapter async (mismo contrato que el sync). */
async function bootstrapProductionAdminOnAdapter(db: DatabaseAdapter): Promise<void> {
  if (isDesktopEdition()) return;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  const hasAdmin = await db.queryRow("SELECT 1 AS x FROM users WHERE role = 'admin' LIMIT 1");
  if (hasAdmin) return;
  assertStrongPassword(password);
  const now = new Date().toISOString();
  const userId = randomUUID();
  await db.execute(
    `INSERT INTO users (id, email, password_hash, created_at, role, status, created_by, email_verified_at)
     VALUES (?, ?, ?, ?, 'admin', 'activo', NULL, ?)`,
    [userId, email, hashSeedPassword(password), now, now],
  );
  await db.execute(
    `INSERT INTO practitioner_profile (id, user_id, full_name, public_slug, onboarding_completed)
     VALUES (?, ?, 'Administración', ?, 1)`,
    [randomUUID(), userId, `admin-${userId.slice(0, 8)}`],
  );
  await db.execute(
    `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, current_period_end, created_at)
     VALUES (?, ?, 'pro', 'activa', ?, ?, ?)`,
    [randomUUID(), userId, now, new Date(Date.now() + 365 * DAY_MS).toISOString(), now],
  );
  console.info('[bootstrap] Cuenta admin de producción creada desde ADMIN_BOOTSTRAP_*.');
}

export function runSeed(db: DatabaseSync): void {
  // Catálogos puros (seguros en cualquier entorno).
  seedIntegrations(db);
  // Automatizaciones: defaults integrados por owner; no existen filas globales de seed.
  if (!isDesktopEdition()) seedCommunityEvents(db);
  seedClinicalTemplates(db);
  seedCie11(db);
  seedPlans(db);
  seedAiCosting(db);
  // Cuentas y datos DEMO: SOLO fuera de producción. En producción JAMÁS se siembra el
  // admin/usuarios demo (tenían contraseña pública conocida = backdoor de admin). El primer
  // admin de producción se provisiona de forma explícita vía ADMIN_BOOTSTRAP_* (abajo).
  if (isDesktopEdition()) {
    // Cada instalación empieza vacía: su usuario crea una cuenta y contraseña propias.
    // Tampoco se provisiona un administrador SaaS desde variables del entorno anfitrión.
    return;
  } else if (isProduction()) {
    bootstrapProductionAdmin(db);
  } else {
    seedIdentityV2(db);
    // Datos de relleno demo (idempotente): tras crear usuarios y antes del pase de cifrado.
    seedDemoData(db);
  }
}

/**
 * Provisión del PRIMER admin en producción: explícita, opcional e idempotente. Solo crea la
 * cuenta si ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD están definidos y aún NO existe
 * ningún admin. Nunca usa una contraseña del repositorio; la clave debe cumplir la política.
 */
function bootstrapProductionAdmin(db: DatabaseSync): void {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;
  const hasAdmin = db.prepare("SELECT 1 AS x FROM users WHERE role = 'admin' LIMIT 1").get();
  if (hasAdmin) return;
  assertStrongPassword(password);
  const now = new Date().toISOString();
  const userId = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at, role, status, created_by, email_verified_at)
     VALUES (?, ?, ?, ?, 'admin', 'activo', NULL, ?)`,
    // Cuenta provisionada (no se auto-registró): nace con el correo verificado.
  ).run(userId, email, hashSeedPassword(password), now, now);
  db.prepare(
    `INSERT INTO practitioner_profile (id, user_id, full_name, public_slug, onboarding_completed)
     VALUES (?, ?, 'Administración', ?, 1)`,
  ).run(randomUUID(), userId, `admin-${userId.slice(0, 8)}`);
  db.prepare(
    `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, current_period_end, created_at)
     VALUES (?, ?, 'pro', 'activa', ?, ?, ?)`,
  ).run(randomUUID(), userId, now, new Date(Date.now() + 365 * DAY_MS).toISOString(), now);
  console.info('[bootstrap] Cuenta admin de producción creada desde ADMIN_BOOTSTRAP_*.');
}

/**
 * Catálogo de planes. Precios de LISTA por moneda de display (marketing, no
 * conversión cambiaria exacta); la moneda por defecto del producto es COP.
 */
function seedPlans(db: DatabaseSync): void {
  const insert = db.prepare(
    `INSERT INTO plans
      (id, name, prices_json, ai_monthly_budget_cop, ai_soft_budget_cop, features_json, highlighted, sort_order, storage_limit_gb)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
  );
  // Datos en PLAN_SEEDS (compartidos con runSeedOnAdapter para no derivar).
  for (const plan of PLAN_SEEDS) {
    insert.run(...plan);
  }
}

/**
 * Parámetros de costeo de IA de la plataforma (editables por el admin):
 * modelos por nivel y tipo de cambio aproximado para convertir USD→COP.
 */
function seedAiCosting(db: DatabaseSync): void {
  db.prepare(`INSERT INTO platform_settings (key, value_json) VALUES (?, ?) ON CONFLICT DO NOTHING`).run(
    'ai_costing',
    AI_COSTING_JSON, // compartido con runSeedOnAdapter
  );
}

function seedIntegrations(db: DatabaseSync): void {
  // Solo los proveedores GLOBALES de plataforma (owner_user_id = ''). Las
  // integraciones personales (pasarelas de cobro, Google Calendar) se crean
  // por profesional bajo demanda desde la v6.
  const insert = db.prepare(
    `INSERT INTO integration_connections (id, provider, owner_user_id, status)
     VALUES (?, ?, '', 'desconectado')
     ON CONFLICT DO NOTHING`,
  );
  for (const provider of ['whatsapp', 'email']) {
    insert.run(randomUUID(), provider);
  }
}

function seedCommunityEvents(db: DatabaseSync): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM community_events').get() as { n: number };
  if (count.n > 0) return;
  const insert = db.prepare(
    `INSERT INTO community_events (id, title, description, starts_at, link, speaker) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date();
  const inDays = (d: number, hour: number): string => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, 0, 0);
    return date.toISOString();
  };
  insert.run(randomUUID(), 'Supervisión de casos clínicos', 'Sesión mensual de supervisión entre colegas: presenta un caso o participa escuchando.', inDays(7, 18), '', 'Comunidad EscuchaInterna');
  insert.run(randomUUID(), 'Taller: primeras entrevistas que generan vínculo', 'Estrategias prácticas para la primera sesión y el encuadre terapéutico.', inDays(14, 17), '', 'Invitado especial');
  insert.run(randomUUID(), 'Círculo de lectura: biblioteca clínica', 'Discusión del libro del mes de la biblioteca de EscuchaInterna.', inDays(21, 19), '', 'Comunidad EscuchaInterna');
}

function seedClinicalTemplates(db: DatabaseSync): void {
  const insert = db.prepare(
    `INSERT INTO clinical_record_templates (id, name, therapy_type, description, sections_json, is_builtin, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       therapy_type = excluded.therapy_type,
       description = excluded.description,
       sections_json = excluded.sections_json,
       is_builtin = excluded.is_builtin,
       created_at = excluded.created_at`,
  );
  const existing = db.prepare(
    `SELECT id FROM clinical_record_templates WHERE is_builtin = 1`,
  ).all() as Array<{ id: string }>;
  const existingIds = new Set(existing.map((row) => row.id));
  for (const template of BUILTIN_CLINICAL_TEMPLATES) {
    if (existingIds.has(template.id)) continue;
    insert.run(
      template.id,
      template.name,
      template.therapyType,
      template.description,
      JSON.stringify(template.sections),
      new Date().toISOString(),
    );
  }
}

function seedCie11(db: DatabaseSync): void {
  const count = db.prepare('SELECT COUNT(*) AS n FROM cie11_entries').get() as { n: number };
  if (count.n > 0) return;
  const datasetPath = path.resolve(process.cwd(), process.env.CIE11_DATASET_PATH ?? './data/cie11/cie11.json');
  if (!fs.existsSync(datasetPath)) return;
  const raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8')) as {
    entries: Array<{ code: string; title: string; parent: string | null; level: number; chapter: string }>;
  };
  const insert = db.prepare(
    `INSERT INTO cie11_entries (code, title, parent, level, chapter) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
  );
  db.exec('BEGIN');
  try {
    for (const entry of raw.entries) {
      insert.run(entry.code, entry.title, entry.parent, entry.level, entry.chapter);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// ============================ Seed v2 (identidad) ============================

const SEED_PASSWORD = 'escucha2026';
const DAY_MS = 24 * 60 * 60 * 1000;

function hashSeedPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

interface SeedUserSpec {
  email: string;
  fullName: string;
  role: 'admin' | 'org_master' | 'professor' | 'psychologist' | 'assistant';
  publicSlug: string;
  /** activa = cubierta (admin/org); trial = prueba de 7 días. */
  subscription: 'activa' | 'trial';
  createdBy?: string | null;
}

/**
 * Crea (si no existe) la cuenta + perfil + suscripción de un usuario demo.
 * Si la cuenta ya existe solo garantiza rol, perfil y suscripción coherentes
 * (no toca la contraseña). Devuelve el id del usuario.
 */
function ensureSeedUser(db: DatabaseSync, spec: SeedUserSpec): string {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(spec.email) as
    | { id: string }
    | undefined;
  let userId: string;
  if (existing) {
    userId = existing.id;
    db.prepare(`UPDATE users SET role = ?, status = 'activo' WHERE id = ?`).run(spec.role, userId);
  } else {
    userId = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, created_at, role, status, created_by, email_verified_at)
       VALUES (?, ?, ?, ?, ?, 'activo', ?, ?)`,
      // Cuentas demo provisionadas: nacen con el correo verificado (no ven el banner).
    ).run(
      userId,
      spec.email,
      hashSeedPassword(SEED_PASSWORD),
      createdAt,
      spec.role,
      spec.createdBy ?? null,
      createdAt,
    );
  }

  const profile = db.prepare('SELECT id FROM practitioner_profile WHERE user_id = ?').get(userId) as
    | { id: string }
    | undefined;
  if (!profile) {
    db.prepare(
      `INSERT INTO practitioner_profile (id, user_id, full_name, public_slug, onboarding_completed)
       VALUES (?, ?, ?, ?, 1)`,
    ).run(randomUUID(), userId, spec.fullName, spec.publicSlug);
  }

  const subscription = db.prepare('SELECT id, status FROM subscriptions WHERE user_id = ?').get(userId) as
    | { id: string; status: string }
    | undefined;
  const now = new Date();
  if (!subscription) {
    if (spec.subscription === 'activa') {
      db.prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, current_period_end, created_at)
         VALUES (?, ?, 'pro', 'activa', ?, ?, ?)`,
      ).run(
        randomUUID(),
        userId,
        now.toISOString(),
        new Date(now.getTime() + 365 * DAY_MS).toISOString(),
        now.toISOString(),
      );
    } else {
      db.prepare(
        `INSERT INTO subscriptions (id, user_id, plan, status, trial_ends_at, current_period_end, created_at)
         VALUES (?, ?, 'pro', 'trial', ?, NULL, ?)`,
      ).run(randomUUID(), userId, new Date(now.getTime() + 7 * DAY_MS).toISOString(), now.toISOString());
    }
  } else if (spec.subscription === 'activa' && subscription.status !== 'activa') {
    // Cuentas cubiertas (admin/organización) nunca deben caer en el paywall.
    db.prepare(`UPDATE subscriptions SET status = 'activa', current_period_end = ? WHERE id = ?`).run(
      new Date(now.getTime() + 365 * DAY_MS).toISOString(),
      subscription.id,
    );
  }

  return userId;
}

function ensureMembership(
  db: DatabaseSync,
  organizationId: string,
  userId: string,
  memberRole: 'master' | 'professor' | 'psychologist',
  permissions: Record<string, boolean | number>,
): void {
  db.prepare(
    `INSERT INTO organization_memberships (id, organization_id, user_id, member_role, permissions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
  ).run(randomUUID(), organizationId, userId, memberRole, JSON.stringify(permissions), new Date().toISOString());
}

/**
 * Seed v2: admin de plataforma, organización demo (universidad) con maestro,
 * profesor supervisor y dos estudiantes, psicóloga independiente en trial,
 * adopción de los datos v1 sin dueño y datos clínicos mínimos de supervisión.
 */
function seedIdentityV2(db: DatabaseSync): void {
  // --- Admin de la plataforma ---
  const adminId = ensureSeedUser(db, {
    email: 'admin@demo.test',
    fullName: 'Administración EscuchaInterna',
    role: 'admin',
    publicSlug: 'admin-escuchainterna',
    subscription: 'activa',
  });

  // --- Adopción de datos v1 sin dueño: pasan al admin ---
  const adoptables = [
    'patients',
    'agendas',
    'bookings',
    'clinical_records',
    'session_notes',
    'diagnoses',
    'patient_files',
    'outbox_messages',
    'marketing_campaigns',
    'ai_interactions',
  ];
  for (const table of adoptables) {
    db.prepare(`UPDATE ${table} SET owner_user_id = ? WHERE owner_user_id IS NULL`).run(adminId);
  }
  // Las plantillas integradas (is_builtin=1) son compartidas: owner NULL.
  db.prepare(
    `UPDATE clinical_record_templates SET owner_user_id = ? WHERE owner_user_id IS NULL AND is_builtin = 0`,
  ).run(adminId);

  // --- Organización demo: Universidad ---
  db.prepare(
    `INSERT INTO organizations (id, name, slug, kind, master_user_id, created_at)
     VALUES (?, 'Universidad Demo de Psicología', 'universidad-demo', 'universidad', NULL, ?)
     ON CONFLICT DO NOTHING`,
  ).run(randomUUID(), new Date().toISOString());
  const organization = db
    .prepare(`SELECT id FROM organizations WHERE slug = 'universidad-demo'`)
    .get() as { id: string };

  const maestroId = ensureSeedUser(db, {
    email: 'maestro@uni-demo.test',
    fullName: 'Dirección Universidad Demo',
    role: 'org_master',
    publicSlug: 'universidad-demo-maestro',
    subscription: 'activa',
    createdBy: adminId,
  });
  db.prepare(`UPDATE organizations SET master_user_id = ? WHERE id = ? AND master_user_id IS NULL`).run(
    maestroId,
    organization.id,
  );

  const profesorId = ensureSeedUser(db, {
    email: 'profesor@uni-demo.test',
    fullName: 'Prof. Hugo Salgado',
    role: 'professor',
    publicSlug: 'universidad-demo-profesor',
    subscription: 'activa',
    createdBy: maestroId,
  });
  const estudiante1Id = ensureSeedUser(db, {
    email: 'estudiante1@uni-demo.test',
    fullName: 'Ana Sofía Beltrán',
    role: 'psychologist',
    publicSlug: 'universidad-demo-estudiante1',
    subscription: 'activa',
    createdBy: maestroId,
  });
  const estudiante2Id = ensureSeedUser(db, {
    email: 'estudiante2@uni-demo.test',
    fullName: 'Julián Ortega',
    role: 'psychologist',
    publicSlug: 'universidad-demo-estudiante2',
    subscription: 'activa',
    createdBy: maestroId,
  });

  ensureMembership(db, organization.id, maestroId, 'master', {
    can_charge: true,
    retention_percent: 0,
    force_app_payments: false,
    payments_disabled: false,
    can_supervise_patients: true,
    can_configure_payments: true,
  });
  ensureMembership(db, organization.id, profesorId, 'professor', {
    can_charge: false,
    retention_percent: 0,
    force_app_payments: false,
    payments_disabled: true,
    can_supervise_patients: true,
    can_configure_payments: false,
  });
  ensureMembership(db, organization.id, estudiante1Id, 'psychologist', {
    can_charge: true,
    retention_percent: 10,
    force_app_payments: false,
    payments_disabled: false,
    can_supervise_patients: false,
    can_configure_payments: true,
  });
  ensureMembership(db, organization.id, estudiante2Id, 'psychologist', {
    can_charge: true,
    retention_percent: 0,
    force_app_payments: false,
    payments_disabled: true,
    can_supervise_patients: false,
    can_configure_payments: false,
  });

  // --- Consultorios demo (F6): dos sedes para mostrar el aislamiento intra-org ---
  // Sede Centro = Prof. Hugo + Ana (supervisión dentro del consultorio); Sede Norte =
  // Julián (aislado). El maestro NO pertenece a ningún consultorio (ve todo). Idempotente.
  function ensureConsultorio(name: string): string {
    const existing = db
      .prepare('SELECT id FROM consultorios WHERE organization_id = ? AND name = ?')
      .get(organization.id, name) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = randomUUID();
    db.prepare(
      `INSERT INTO consultorios (id, organization_id, name, created_at, archived) VALUES (?, ?, ?, ?, 0)`,
    ).run(id, organization.id, name, new Date().toISOString());
    return id;
  }
  const sedeCentro = ensureConsultorio('Sede Centro');
  const sedeNorte = ensureConsultorio('Sede Norte');
  const assignConsultorio = (userId: string, consultorioId: string) =>
    db
      .prepare('UPDATE organization_memberships SET consultorio_id = ? WHERE organization_id = ? AND user_id = ?')
      .run(consultorioId, organization.id, userId);
  assignConsultorio(profesorId, sedeCentro);
  assignConsultorio(estudiante1Id, sedeCentro);
  assignConsultorio(estudiante2Id, sedeNorte);

  // --- Supervisión: el profesor supervisa DENTRO de su consultorio (Sede Centro) ---
  // Solo a Ana (estudiante1, misma sede): con consultorios, un profesor no supervisa
  // cross-consultorio (F4), así que NO se siembra un vínculo inerte hacia Julián (Norte).
  const supervisionScope = JSON.stringify({ notas: true, historias: true, pagos: false });
  db.prepare(
    `INSERT INTO supervision_links (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`,
  ).run(randomUUID(), organization.id, profesorId, estudiante1Id, supervisionScope, new Date().toISOString());

  // --- Recepción multi-consultorio demo (F6): atiende AMBAS sedes ---
  // Cuenta role='assistant' ligada a la org + los 2 consultorios; agenda para Ana (Centro)
  // y Julián (Norte) eligiendo el destino. Se habilita el permiso de la organización.
  const recepcionId = ensureSeedUser(db, {
    email: 'recepcion@uni-demo.test',
    fullName: 'Recepción Universidad Demo',
    role: 'assistant',
    publicSlug: 'universidad-demo-recepcion',
    subscription: 'activa',
    createdBy: maestroId,
  });
  db.prepare('UPDATE organizations SET reception_multi_consultorio = 1 WHERE id = ?').run(organization.id);
  for (const consultorioId of [sedeCentro, sedeNorte]) {
    db.prepare(
      `INSERT INTO reception_consultorios (id, assistant_user_id, organization_id, consultorio_id, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    ).run(randomUUID(), recepcionId, organization.id, consultorioId, new Date().toISOString());
  }

  // --- Psicóloga independiente en trial ---
  ensureSeedUser(db, {
    email: 'psicologa@demo.test',
    fullName: 'Psic. Valeria Domínguez',
    role: 'psychologist',
    publicSlug: 'valeria-dominguez',
    subscription: 'trial',
  });

  // --- Datos clínicos mínimos del estudiante 1 (para que supervisión muestre algo) ---
  const hasPatients = db
    .prepare('SELECT COUNT(*) AS n FROM patients WHERE owner_user_id = ?')
    .get(estudiante1Id) as { n: number };
  if (hasPatients.n === 0) {
    const patientId = randomUUID();
    db.prepare(
      `INSERT INTO patients (id, full_name, email, phone, gender, consultation_reason, notes, created_at, owner_user_id)
       VALUES (?, 'Paciente Demo Universidad', 'paciente.demo@uni-demo.test', '5512345678', 'femenino',
               'Ansiedad ante evaluaciones académicas', 'Caso de práctica supervisada.', ?, ?)`,
    ).run(patientId, new Date().toISOString(), estudiante1Id);
    db.prepare(
      `INSERT INTO session_notes (id, patient_id, title, content, created_at, updated_at, owner_user_id)
       VALUES (?, ?, 'Primera sesión — encuadre', ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      patientId,
      'Se establece el encuadre terapéutico y se exploran los motivos de consulta. La paciente refiere síntomas de ansiedad ante periodos de exámenes. Se acuerda trabajar con técnicas de regulación emocional. (Nota de demostración para la vista de supervisión.)',
      new Date().toISOString(),
      new Date().toISOString(),
      estudiante1Id,
    );
  }
}
