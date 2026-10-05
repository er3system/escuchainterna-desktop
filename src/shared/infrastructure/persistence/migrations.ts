import type { DatabaseSync } from 'node:sqlite';
import type { DatabaseAdapter } from './DatabaseAdapter';

interface Migration {
  version: number;
  statements: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      // --- Identidad y perfil del profesional ---
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS practitioner_profile (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        full_name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        photo_path TEXT,
        public_slug TEXT NOT NULL DEFAULT '',
        modality TEXT NOT NULL DEFAULT 'ambas', -- presencial | virtual | ambas
        address TEXT NOT NULL DEFAULT '',
        maps_url TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL DEFAULT 'MXN',
        default_price REAL NOT NULL DEFAULT 0,
        payment_mode TEXT NOT NULL DEFAULT 'manual', -- manual | requerido
        show_price INTEGER NOT NULL DEFAULT 1,
        payment_policies TEXT NOT NULL DEFAULT '',
        availability_json TEXT NOT NULL DEFAULT '[]', -- [{day:0..6, ranges:[{from:'09:00',to:'19:00'}]}]
        session_reminder_hours INTEGER NOT NULL DEFAULT 24,
        cancellation_min_hours INTEGER NOT NULL DEFAULT 24,
        auto_payment_reminders INTEGER NOT NULL DEFAULT 1,
        onboarding_completed INTEGER NOT NULL DEFAULT 0
      )`,
      // --- Integraciones (puertos listos, credenciales locales) ---
      `CREATE TABLE IF NOT EXISTS integration_connections (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL UNIQUE, -- stripe | google_calendar | whatsapp | email
        status TEXT NOT NULL DEFAULT 'desconectado', -- desconectado | conectado | simulado
        config_json TEXT NOT NULL DEFAULT '{}',
        connected_at TEXT
      )`,
      // --- Agendas (tipos de sesión) ---
      `CREATE TABLE IF NOT EXISTS agendas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#5B5BD6',
        slug TEXT NOT NULL UNIQUE,
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        slot_interval_minutes INTEGER NOT NULL DEFAULT 60,
        min_booking_hours INTEGER NOT NULL DEFAULT 8,
        overrides_availability INTEGER NOT NULL DEFAULT 0,
        availability_json TEXT,
        overrides_payment INTEGER NOT NULL DEFAULT 0,
        price REAL,
        payment_mode TEXT,
        show_price INTEGER,
        show_stripe_link INTEGER NOT NULL DEFAULT 0,
        overrides_location INTEGER NOT NULL DEFAULT 0,
        modality TEXT,
        address TEXT,
        maps_url TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )`,
      // --- Pacientes ---
      `CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        birth_date TEXT,
        gender TEXT NOT NULL DEFAULT '',
        consultation_reason TEXT NOT NULL DEFAULT '',
        therapy_start_date TEXT,
        emergency_contact_name TEXT NOT NULL DEFAULT '',
        emergency_contact_phone TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      // --- Reservas / sesiones ---
      `CREATE TABLE IF NOT EXISTS recurrences (
        id TEXT PRIMARY KEY,
        frequency TEXT NOT NULL, -- semanal | quincenal | mensual
        repeat_count INTEGER,
        until_date TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        agenda_id TEXT NOT NULL REFERENCES agendas(id),
        patient_id TEXT NOT NULL REFERENCES patients(id),
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        modality TEXT NOT NULL DEFAULT 'presencial', -- presencial | virtual
        meet_url TEXT,
        status TEXT NOT NULL DEFAULT 'agendada', -- agendada | confirmada | completada | cancelada | inasistencia
        payment_status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | pagada
        payment_method TEXT, -- transferencia | efectivo | tarjeta | stripe
        paid_at TEXT,
        recurrence_id TEXT REFERENCES recurrences(id),
        booked_by TEXT NOT NULL DEFAULT 'profesional', -- profesional | paciente
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_at)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_patient ON bookings(patient_id)`,
      // --- Outbox de notificaciones (WhatsApp / correo, adaptadores locales) ---
      `CREATE TABLE IF NOT EXISTS outbox_messages (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL, -- whatsapp | email
        recipient TEXT NOT NULL,
        recipient_name TEXT NOT NULL DEFAULT '',
        template TEXT NOT NULL, -- sesion_agendada | recordatorio_sesion | sesion_reagendada | sesion_cancelada | recordatorio_pago | cumpleanios | reactivacion | correo_masivo
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'enviado', -- pendiente | enviado | recibido | leido | fallido
        booking_id TEXT,
        patient_id TEXT,
        created_at TEXT NOT NULL,
        sent_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_outbox_patient ON outbox_messages(patient_id)`,
      // --- Expediente clínico ---
      `CREATE TABLE IF NOT EXISTS clinical_record_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        therapy_type TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        sections_json TEXT NOT NULL, -- [{id,title,description,fields:[{id,label,type,options?,required?,placeholder?}]}]
        is_builtin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS clinical_records (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        template_id TEXT REFERENCES clinical_record_templates(id),
        title TEXT NOT NULL,
        answers_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS session_notes (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        booking_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ai_interactions (
        id TEXT PRIMARY KEY,
        session_note_id TEXT NOT NULL REFERENCES session_notes(id),
        kind TEXT NOT NULL, -- pregunta | reporte
        prompt TEXT NOT NULL DEFAULT '',
        response TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'local', -- local | anthropic
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS patient_files (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        filename TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        mime TEXT NOT NULL DEFAULT 'application/octet-stream',
        size INTEGER NOT NULL DEFAULT 0,
        uploaded_at TEXT NOT NULL
      )`,
      // --- Diagnóstico CIE-11 ---
      `CREATE TABLE IF NOT EXISTS cie11_entries (
        code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        parent TEXT,
        level INTEGER NOT NULL DEFAULT 1,
        chapter TEXT NOT NULL DEFAULT '06'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cie11_parent ON cie11_entries(parent)`,
      `CREATE TABLE IF NOT EXISTS diagnoses (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        cie11_code TEXT NOT NULL,
        cie11_title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'activo', -- activo | descartado | remitido
        diagnosed_at TEXT NOT NULL
      )`,
      // --- Biblioteca ---
      `CREATE TABLE IF NOT EXISTS library_books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL DEFAULT '',
        relative_path TEXT NOT NULL UNIQUE,
        extension TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        favorite INTEGER NOT NULL DEFAULT 0,
        indexed_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_library_category ON library_books(category)`,
      // --- Marketing ---
      `CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        audience_json TEXT NOT NULL DEFAULT '[]', -- ids de pacientes
        sent_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS marketing_automations (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL UNIQUE, -- cumpleanios | reactivacion
        enabled INTEGER NOT NULL DEFAULT 0,
        interval_months INTEGER, -- solo reactivacion
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT ''
      )`,
      // --- Comunidad ---
      `CREATE TABLE IF NOT EXISTS community_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        starts_at TEXT NOT NULL,
        link TEXT NOT NULL DEFAULT '',
        speaker TEXT NOT NULL DEFAULT ''
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      // Conteo de reagendas por reserva (métrica "sesiones reprogramadas" del dashboard).
      `ALTER TABLE bookings ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 3,
    statements: [
      // ============ v2: multi-tenant, roles, suscripciones y SaaS ============
      // --- Roles y estado de cuenta ---
      `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'psychologist'`, // admin | org_master | professor | psychologist
      `ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'activo'`, // activo | suspendido
      `ALTER TABLE users ADD COLUMN created_by TEXT`,
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      // --- Organizaciones (perfiles maestros: empresas, universidades, clínicas) ---
      `CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL DEFAULT 'empresa', -- empresa | universidad | clinica
        logo_path TEXT,
        master_user_id TEXT REFERENCES users(id),
        default_member_policies_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS organization_memberships (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        user_id TEXT NOT NULL REFERENCES users(id),
        member_role TEXT NOT NULL DEFAULT 'psychologist', -- master | professor | psychologist
        -- permisos: {can_charge, retention_percent, force_app_payments, payments_disabled,
        --            can_supervise_patients, can_configure_payments}
        permissions_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        UNIQUE(organization_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS supervision_links (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        supervisor_user_id TEXT NOT NULL REFERENCES users(id),
        supervised_user_id TEXT NOT NULL REFERENCES users(id),
        scope_json TEXT NOT NULL DEFAULT '{"notas":true,"historias":true,"pagos":false}',
        created_at TEXT NOT NULL,
        UNIQUE(supervisor_user_id, supervised_user_id)
      )`,
      // --- Suscripciones (trial de 7 días, cobro simulado en local) ---
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        plan TEXT NOT NULL DEFAULT 'pro',
        status TEXT NOT NULL DEFAULT 'trial', -- trial | activa | vencida | cancelada
        trial_ends_at TEXT NOT NULL,
        current_period_end TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS subscription_payments (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MXN',
        provider TEXT NOT NULL DEFAULT 'simulado',
        paid_at TEXT NOT NULL
      )`,
      // --- Scoping multi-tenant: dueño en todos los datos clínicos/operativos ---
      `ALTER TABLE patients ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE agendas ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE bookings ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE clinical_records ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE clinical_record_templates ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE session_notes ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE diagnoses ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE patient_files ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE outbox_messages ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE marketing_campaigns ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE marketing_automations ADD COLUMN owner_user_id TEXT`,
      `ALTER TABLE ai_interactions ADD COLUMN owner_user_id TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_patients_owner ON patients(owner_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_outbox_owner ON outbox_messages(owner_user_id)`,
      // --- Perfil profesional: cédula, contacto, lada, tarifas y tema de correo ---
      `ALTER TABLE practitioner_profile ADD COLUMN professional_license TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE practitioner_profile ADD COLUMN contact_address TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE practitioner_profile ADD COLUMN contact_phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE practitioner_profile ADD COLUMN phone_country_code TEXT NOT NULL DEFAULT '+52'`,
      `ALTER TABLE practitioner_profile ADD COLUMN no_show_fee_enabled INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE practitioner_profile ADD COLUMN no_show_fee_amount REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE practitioner_profile ADD COLUMN late_cancel_fee_enabled INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE practitioner_profile ADD COLUMN late_cancel_fee_amount REAL NOT NULL DEFAULT 0`,
      `ALTER TABLE practitioner_profile ADD COLUMN email_theme TEXT NOT NULL DEFAULT 'calido'`,
      // --- Lada del país en teléfonos de pacientes ---
      `ALTER TABLE patients ADD COLUMN phone_country_code TEXT NOT NULL DEFAULT '+52'`,
      `ALTER TABLE patients ADD COLUMN emergency_phone_country_code TEXT NOT NULL DEFAULT '+52'`,
      // --- Tarifa cobrada por inasistencia/cancelación tardía ---
      `ALTER TABLE bookings ADD COLUMN fee_charged REAL NOT NULL DEFAULT 0`,
      // fee_reason: inasistencia | cancelacion_tardia
      `ALTER TABLE bookings ADD COLUMN fee_reason TEXT NOT NULL DEFAULT ''`,
      // --- Facturas ---
      `CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL REFERENCES bookings(id),
        patient_id TEXT NOT NULL REFERENCES patients(id),
        owner_user_id TEXT NOT NULL,
        folio TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MXN',
        outbox_message_id TEXT,
        sent_at TEXT NOT NULL
      )`,
      // --- Chat de IA (asistente con alcance limitado a pacientes propios) ---
      `CREATE TABLE IF NOT EXISTS ai_chat_threads (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Nueva conversación',
        patient_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES ai_chat_threads(id),
        role TEXT NOT NULL, -- usuario | asistente
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      // --- Sugerencias de IA a la historia clínica (requieren aprobación) ---
      `CREATE TABLE IF NOT EXISTS clinical_record_suggestions (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL REFERENCES clinical_records(id),
        owner_user_id TEXT NOT NULL,
        source_note_id TEXT,
        -- [{fieldId, sectionId, label, currentValue, suggestedValue, reason, status}]
        suggestions_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | resuelta
        created_at TEXT NOT NULL,
        resolved_at TEXT
      )`,
      // --- Mapas familiares (genogramas) ---
      `CREATE TABLE IF NOT EXISTS family_maps (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        owner_user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Mapa familiar',
        data_json TEXT NOT NULL DEFAULT '{"members":[],"links":[]}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      // --- Biblioteca v2: publicaciones propias de EscuchaInterna ---
      `CREATE TABLE IF NOT EXISTS library_publications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL, -- p. ej. "Modelos terapéuticos", "Temas clínicos", "Marcos normativos"
        kind TEXT NOT NULL DEFAULT 'tema', -- modelo | tema | marco_normativo
        country TEXT NOT NULL DEFAULT '',
        html_path TEXT NOT NULL,
        pdf_path TEXT NOT NULL DEFAULT '',
        sources_json TEXT NOT NULL DEFAULT '[]',
        favorite INTEGER NOT NULL DEFAULT 0,
        published_at TEXT NOT NULL
      )`,
      // --- Reportes clínico-legales con revisión y firma ---
      `CREATE TABLE IF NOT EXISTS patient_reports (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        owner_user_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'clinico', -- clinico | legal | expediente
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'borrador', -- borrador | revisado | firmado
        signed_by TEXT NOT NULL DEFAULT '',
        license_number TEXT NOT NULL DEFAULT '',
        signed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      // --- Plantillas de mensajes editables por el profesional ---
      `CREATE TABLE IF NOT EXISTS message_templates (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT, -- NULL = plantilla base de la plataforma
        template_key TEXT NOT NULL, -- sesion_agendada | recordatorio_sesion | recordatorio_pago | cumpleanios | reactivacion | ...
        name TEXT NOT NULL,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`,
      // --- Configuración de plataforma (proveedores administrados por el admin) ---
      `CREATE TABLE IF NOT EXISTS platform_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL DEFAULT '{}'
      )`,
      `CREATE TABLE IF NOT EXISTS admin_audit_log (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 4,
    statements: [
      // ============ v3 de producto: planes con precio por moneda y medición de IA ============
      `CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY, -- esencial | profesional | organizacion
        name TEXT NOT NULL,
        -- Precio de lista mensual por moneda de display: {"COP":79000,"MXN":349,...}
        prices_json TEXT NOT NULL DEFAULT '{}',
        -- Tope DURO de gasto de IA al mes en COP (NULL = sin tope duro).
        ai_monthly_budget_cop REAL,
        -- Umbral SUAVE en COP: al superarlo se cambia al modelo económico (NULL = nunca).
        ai_soft_budget_cop REAL,
        features_json TEXT NOT NULL DEFAULT '[]',
        highlighted INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS ai_usage_events (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        kind TEXT NOT NULL, -- chat | pregunta_nota | reporte_sesion | sugerencias_historia | borrador_reporte
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        est_cost_usd REAL NOT NULL DEFAULT 0,
        est_cost_cop REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_ai_usage_owner_fecha ON ai_usage_events(owner_user_id, created_at)`,
      // El plan histórico 'pro' pasa a llamarse 'profesional'.
      `UPDATE subscriptions SET plan = 'profesional' WHERE plan = 'pro'`,
    ],
  },
  {
    version: 5,
    statements: [
      // Moneda del cobro POR SESIÓN (las ganancias pueden mezclar monedas si el
      // profesional cambió de moneda con el tiempo). Backfill con la moneda
      // actual del perfil del dueño.
      `ALTER TABLE bookings ADD COLUMN currency TEXT NOT NULL DEFAULT ''`,
      `UPDATE bookings SET currency = COALESCE(
        (SELECT pp.currency FROM practitioner_profile pp WHERE pp.user_id = bookings.owner_user_id),
        'MXN'
      ) WHERE currency = ''`,
    ],
  },
  {
    version: 6,
    statements: [
      // Integraciones POR PROFESIONAL: cada psicólogo configura SU pasarela de
      // cobro (los pacientes le pagan directo a él). owner_user_id = '' marca
      // las filas globales de plataforma (whatsapp, email). Rebuild porque la
      // tabla original tenía provider UNIQUE.
      `CREATE TABLE integration_connections_v6 (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        owner_user_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'desconectado',
        config_json TEXT NOT NULL DEFAULT '{}',
        connected_at TEXT,
        UNIQUE(provider, owner_user_id)
      )`,
      `INSERT INTO integration_connections_v6 (id, provider, owner_user_id, status, config_json, connected_at)
        SELECT id, provider, '', status, config_json, connected_at FROM integration_connections`,
      `DROP TABLE integration_connections`,
      `ALTER TABLE integration_connections_v6 RENAME TO integration_connections`,
      `CREATE INDEX IF NOT EXISTS idx_integration_owner ON integration_connections(owner_user_id)`,
    ],
  },
  {
    version: 7,
    statements: [
      // Moneda opcional POR AGENDA ("usar otra moneda" en el override de pago).
      // '' = usar la moneda preferida del perfil del profesional.
      `ALTER TABLE agendas ADD COLUMN currency TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 8,
    statements: [
      // ============ v3: consentimiento, seguridad, asistentes, universidades ============
      // --- Consentimiento informado digital ---
      `CREATE TABLE IF NOT EXISTS consent_templates (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT 'Consentimiento informado',
        body TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS patient_consents (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        owner_user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        template_title TEXT NOT NULL,
        template_body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | firmado | papel_adjunto | revocado
        sent_at TEXT,
        signed_at TEXT,
        signed_name TEXT NOT NULL DEFAULT '',
        signature_kind TEXT NOT NULL DEFAULT '', -- digital | papel
        file_path TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_consents_patient ON patient_consents(patient_id)`,
      // --- Bitácora de acceso a expedientes (trazabilidad de historia clínica) ---
      `CREATE TABLE IF NOT EXISTS record_access_log (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        area TEXT NOT NULL, -- resumen | historia | sesiones | diagnostico | archivos | exportar | supervision
        action TEXT NOT NULL DEFAULT 'ver',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_access_patient ON record_access_log(patient_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_access_actor ON record_access_log(actor_user_id, created_at)`,
      // --- Endurecimiento de login ---
      `CREATE TABLE IF NOT EXISTS login_attempts (
        email TEXT PRIMARY KEY,
        failed_count INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_attempt_at TEXT
      )`,
      `ALTER TABLE users ADD COLUMN totp_secret TEXT`,
      `ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`,
      // --- Rol asistente/recepcionista (agenda y pagos del titular, sin clínica) ---
      `CREATE TABLE IF NOT EXISTS assistants (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        assistant_user_id TEXT NOT NULL UNIQUE,
        permissions_json TEXT NOT NULL DEFAULT '{"agenda":true,"pagos":true,"pacientes_basico":true}',
        created_at TEXT NOT NULL
      )`,
      // --- Universidades: servicio sin costo a nivel organización ---
      `ALTER TABLE organizations ADD COLUMN free_service INTEGER NOT NULL DEFAULT 0`,
      // --- Presupuesto de mensajes WhatsApp por plan (NULL = ilimitado) ---
      `ALTER TABLE plans ADD COLUMN wa_monthly_limit INTEGER`,
      `UPDATE plans SET wa_monthly_limit = 100 WHERE id = 'esencial'`,
      `UPDATE plans SET wa_monthly_limit = 1500 WHERE id = 'profesional'`,
      `UPDATE plans SET wa_monthly_limit = 800 WHERE id = 'organizacion'`,
      // --- Revisión editorial de la biblioteca ---
      `ALTER TABLE library_publications ADD COLUMN reviewed INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE library_publications ADD COLUMN reviewed_at TEXT`,
    ],
  },
  {
    version: 9,
    statements: [
      // ============ v3.1: referidos y notificaciones ============
      `CREATE TABLE IF NOT EXISTS referral_codes (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        code TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referrer_user_id TEXT NOT NULL REFERENCES users(id),
        referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'registrado', -- registrado | activo | cancelado
        created_at TEXT NOT NULL,
        activated_at TEXT
      )`,
      // Notificaciones in-app (campana): novedades de plataforma, recordatorios
      // propios sobre pacientes y avisos de la organización a sus miembros.
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        recipient_user_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'novedad', -- novedad | recordatorio | aviso_org
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        link TEXT NOT NULL DEFAULT '',
        patient_id TEXT,
        remind_at TEXT, -- para recordatorios programados: visible desde esta fecha
        created_by TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, read_at)`,
      // Novedades publicadas por el admin (fan-out perezoso a notifications).
      `CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL DEFAULT '',
        audience TEXT NOT NULL DEFAULT 'todos', -- todos | psicologos | organizaciones
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 10,
    statements: [
      // ============ v3.2: supervisión académica activa ============
      // Retroalimentación del supervisor sobre una nota de sesión del
      // supervisado: comentario (cifrado at-rest) + marca de "revisado".
      `CREATE TABLE IF NOT EXISTS supervision_session_reviews (
        id TEXT PRIMARY KEY,
        session_note_id TEXT NOT NULL,
        supervisor_user_id TEXT NOT NULL,
        supervised_user_id TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        reviewed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(session_note_id, supervisor_user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_supervision_reviews_note ON supervision_session_reviews(session_note_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supervision_reviews_supervised ON supervision_session_reviews(supervised_user_id)`,
    ],
  },
  {
    version: 11,
    statements: [
      // Colchón POR AGENDA: minutos libres tras cada sesión (tareas, notas,
      // descanso). Los slots disponibles avanzan en duración + colchón, así
      // surgen horarios como 9:15 o 10:30, no solo en punto.
      `ALTER TABLE agendas ADD COLUMN buffer_minutes INTEGER NOT NULL DEFAULT 0`,
      // Nota opcional del paciente al agendar (motivo de consulta en sus
      // palabras); se muestra en el detalle de la reserva del profesional.
      `ALTER TABLE bookings ADD COLUMN patient_note TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 12,
    statements: [
      // Espacios bloqueados manualmente por el profesional (no son pacientes):
      // almuerzo puntual, cita personal, vacaciones… Por dueño, así tapan la
      // disponibilidad de TODAS sus agendas. Restan de los cupos reservables.
      `CREATE TABLE IF NOT EXISTS blocked_slots (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_blocked_slots_owner_start ON blocked_slots(owner_user_id, start_at)`,
    ],
  },
  {
    version: 13,
    statements: [
      // ===== Rediseño de historia clínica como documento vivo y modular =====
      // (ver docs/historia-clinica-spec.md). Todo aditivo con defaults: el flujo
      // actual de expediente/sesiones sigue funcionando sin cambios.
      //
      // La historia clínica puede llevar su PROPIO set de secciones compuesto
      // (snapshot) además del template, para añadir módulos por paciente; y se
      // marca cuál registro es la historia clínica primaria.
      `ALTER TABLE clinical_records ADD COLUMN sections_json TEXT NOT NULL DEFAULT ''`,
      // clinical_records.kind: 'historia' (la historia clínica primaria) | 'registro'.
      `ALTER TABLE clinical_records ADD COLUMN kind TEXT NOT NULL DEFAULT 'registro'`,
      // Sesión estructurada (plantilla 1ª vs seguimiento) sin perder el texto
      // libre, y marca de integración a la historia clínica.
      `ALTER TABLE session_notes ADD COLUMN template_id TEXT`,
      `ALTER TABLE session_notes ADD COLUMN answers_json TEXT NOT NULL DEFAULT '{}'`,
      // session_notes.session_kind: 'primera' | 'seguimiento'.
      `ALTER TABLE session_notes ADD COLUMN session_kind TEXT NOT NULL DEFAULT 'seguimiento'`,
      // integrated_at: marca de "Integrar a la historia". INERTE desde el pivote
      // del Expediente (el Documento compila TODAS las sesiones no archivadas, no
      // filtra por esta columna). Las migraciones son inmutables, así que la
      // columna queda pero ya NADIE la lee ni la escribe. No reutilizar.
      `ALTER TABLE session_notes ADD COLUMN integrated_at TEXT`,
      // Catálogo de bloques: distingue plantillas completas de los módulos por
      // enfoque (que se añaden con desplegable+lupa) y del núcleo de la historia.
      // El enfoque para filtrar reusa la columna existente `therapy_type`.
      // clinical_record_templates.kind: 'plantilla' | 'historia_nucleo' | 'modulo'.
      `ALTER TABLE clinical_record_templates ADD COLUMN kind TEXT NOT NULL DEFAULT 'plantilla'`,
    ],
  },
  {
    version: 14,
    statements: [
      // ===== Expediente v2 (docs/expediente-v2-spec.md) =====
      // Preferencias por usuario (clave-valor, acotadas por dueño). Primera
      // preferencia: la plantilla-modelo por defecto del profesional al iniciar
      // una historia clínica (§3, "marcar por defecto"). Aditiva y opcional.
      `CREATE TABLE IF NOT EXISTS user_preferences (
        owner_user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_user_id, key)
      )`,
    ],
  },
  {
    version: 15,
    statements: [
      // ===== Expediente v2 · Fase 4: vínculos pareja/familia (docs/expediente-v2-spec.md §10) =====
      // Un "caso relacional" agrupa a varios pacientes (la pareja/familia) bajo un
      // mismo proceso. owner_user_id es la frontera (regla de oro). La política de
      // secretos es obligatoria antes de la 1ª sesión individual; el cribado de
      // violencia (coercitiva) puede poner el caso en status='contraindicado'.
      `CREATE TABLE IF NOT EXISTS relational_cases (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'pareja',            -- 'pareja' | 'familia'
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'activo',          -- 'activo' | 'contraindicado' | 'cerrado'
        secrets_policy TEXT NOT NULL DEFAULT '',        -- '' | 'no_secretos' | 'confidencialidad_limitada'
        secrets_policy_set_at TEXT,
        contraindication_reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_relational_cases_owner ON relational_cases(owner_user_id)`,
      // Cada miembro vincula un paciente al caso, con su consentimiento (doble) y
      // su cribado de violencia (que se hace por separado, por miembro).
      `CREATE TABLE IF NOT EXISTS case_members (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES relational_cases(id),
        patient_id TEXT NOT NULL REFERENCES patients(id),
        owner_user_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        consent_status TEXT NOT NULL DEFAULT 'pendiente',   -- 'pendiente' | 'otorgado'
        screening_status TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'sin_hallazgos' | 'violencia_situacional' | 'violencia_coercitiva'
        screening_at TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_case_members_case ON case_members(case_id)`,
      `CREATE INDEX IF NOT EXISTS idx_case_members_patient ON case_members(patient_id)`,
    ],
  },
  {
    version: 16,
    statements: [
      // ===== Expediente v2 · Fase 4c: sesiones del caso con 3 círculos de visibilidad =====
      // visibility: 'compartido' (sesión conjunta, visible a todo el caso) |
      // 'individual' (privado del miembro) | 'confidential' (privado de esa sesión
      // individual; NUNCA se filtra en el export del caso, §10). member_id null =
      // sesión conjunta. content cifrado at-rest.
      `CREATE TABLE IF NOT EXISTS case_session_notes (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL REFERENCES relational_cases(id),
        owner_user_id TEXT NOT NULL,
        member_id TEXT,
        patient_id TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        visibility TEXT NOT NULL DEFAULT 'compartido',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_case_session_notes_case ON case_session_notes(case_id)`,
    ],
  },
  {
    version: 17,
    statements: [
      // ===== Cuentas institucionales (docs/cuentas-institucionales-spec.md) =====
      // PROPIEDAD vs ACCESO: en cuentas individuales el expediente pertenece a la
      // persona (owner_user_id, sin cambios). En institucionales pertenece a la
      // ORGANIZACIÓN (responsable del dato): patients.organization_id la ancla, y
      // owner_user_id pasa a significar "tratante con acceso operativo AHORA"
      // (reasignable). organization_id NULL = individual (retrocompatible: todos los
      // pacientes existentes siguen siendo individuales).
      `ALTER TABLE patients ADD COLUMN organization_id TEXT`,
      // Documento de identificación del paciente (§5). UNA sola fuente (la historia
      // lo lee/escribe, no lo duplica). En claro como el resto de identificadores
      // (nombre/email/teléfono); cifrarlo rompería la búsqueda y sería inconsistente.
      `ALTER TABLE patients ADD COLUMN document_type TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN document_number TEXT NOT NULL DEFAULT ''`,
      `CREATE INDEX IF NOT EXISTS idx_patients_org ON patients(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patients_document ON patients(document_number)`,
      // Política de acceso configurable por la institución (§2). 'individual' =
      // los expedientes pertenecen a la persona (comportamiento actual). El preset
      // de acceso (estricto|intermedio|cobertura) y si el profesor puede ampliarlo
      // los fija el org_master; el ajuste del profesor reusa user_preferences (v14).
      `ALTER TABLE organizations ADD COLUMN patient_ownership TEXT NOT NULL DEFAULT 'individual'`,
      `ALTER TABLE organizations ADD COLUMN access_policy TEXT NOT NULL DEFAULT 'estricto'`,
      `ALTER TABLE organizations ADD COLUMN professor_can_widen INTEGER NOT NULL DEFAULT 1`,
      // Capa de ASIGNACIÓN (registro autoritativo de tratante+supervisor + historia
      // de custodia, §1.2). Append-only en la práctica: reasignar = cerrar la fila
      // viva ('reasignada') e insertar otra. status 'institucion' = retenido por la
      // organización sin tratante humano (tratante_user_id NULL). Acotada por
      // organization_id (un paciente institucional pertenece a una sola org).
      `CREATE TABLE IF NOT EXISTS patient_assignments (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL REFERENCES patients(id),
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        tratante_user_id TEXT,
        supervisor_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'activa',   -- 'activa' | 'reasignada' | 'institucion'
        assigned_by TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT 'alta',     -- 'alta' | 'reasignacion' | 'offboarding' | 'manual'
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_patient ON patient_assignments(patient_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_org ON patient_assignments(organization_id)`,
    ],
  },
  {
    version: 18,
    statements: [
      // ===== Aislamiento multi-tenant de supervision_links =====
      // El UNIQUE original era GLOBAL (supervisor_user_id, supervised_user_id): impedía
      // que el mismo par supervisor↔supervisado existiera en DOS organizaciones. Pasa a
      // ser POR ORGANIZACIÓN. SQLite no permite ALTER de un constraint, así que se
      // reconstruye la tabla (sin FK entrantes, el DROP/RENAME es seguro). Los datos
      // existentes satisfacían un constraint MÁS estricto, así que la copia nunca choca.
      `CREATE TABLE supervision_links_new (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id),
        supervisor_user_id TEXT NOT NULL REFERENCES users(id),
        supervised_user_id TEXT NOT NULL REFERENCES users(id),
        scope_json TEXT NOT NULL DEFAULT '{"notas":true,"historias":true,"pagos":false}',
        created_at TEXT NOT NULL,
        UNIQUE(organization_id, supervisor_user_id, supervised_user_id)
      )`,
      `INSERT INTO supervision_links_new (id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at)
         SELECT id, organization_id, supervisor_user_id, supervised_user_id, scope_json, created_at FROM supervision_links`,
      `DROP TABLE supervision_links`,
      `ALTER TABLE supervision_links_new RENAME TO supervision_links`,
    ],
  },
  {
    version: 19,
    statements: [
      // Archivar sesiones (recuperable): el psicólogo puede quitar una sesión de la
      // Evolución sin borrarla. archived=1 la oculta del expediente; se puede restaurar.
      `ALTER TABLE session_notes ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 20,
    statements: [
      // Contexto clínico-médico en la ficha del paciente (P5). Campos aditivos, en
      // claro como el resto de la ficha demográfica (consultation_reason, notes);
      // no son el contenido clínico pesado que se cifra (session_notes, records).
      // - medicación actual + quién la prescribe: seguridad (interacciones, adherencia).
      // - alergias / antecedentes médicos relevantes: seguridad ante derivación/crisis.
      // - encuadre: frecuencia + modalidad del proceso (el "contrato" terapéutico).
      // - estado del proceso: ciclo clínico (activo/pausa/alta/abandono), más rico que
      //   el binario `archived`. Default 'activo' para los expedientes existentes.
      `ALTER TABLE patients ADD COLUMN current_medication TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN medical_history TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN session_frequency TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN session_modality TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN process_status TEXT NOT NULL DEFAULT 'activo'`,
    ],
  },
  {
    version: 21,
    statements: [
      // Bloques por sesión (P6.1): una SessionNote puede llevar ahora sus propios
      // bloques curados (Evaluación/Técnica/Proceso/Estructural), igual que la
      // historia primaria. Simétrico a clinical_records.sections_json (v13): es
      // ESTRUCTURA (snapshot de secciones), no PII → va EN CLARO; las respuestas
      // de esos bloques siguen en answers_json (ya cifrado). '' = sin bloques.
      `ALTER TABLE session_notes ADD COLUMN sections_json TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 22,
    statements: [
      // Orden manual de las sesiones en la Evolución (P8): el psicólogo puede
      // reordenar las viñetas (p. ej. poner una nota antes de un seguimiento).
      // `position` ASC = orden de lectura/cronológico. Se backfillea con el rango
      // por fecha (más antigua = 0) para conservar el orden actual; las nuevas
      // sesiones se anexan al final (position = MAX+1).
      `ALTER TABLE session_notes ADD COLUMN position INTEGER NOT NULL DEFAULT 0`,
      `UPDATE session_notes SET position = (
         SELECT COUNT(*) FROM session_notes s2
         WHERE s2.patient_id = session_notes.patient_id AND s2.created_at < session_notes.created_at
       )`,
    ],
  },
  {
    version: 23,
    statements: [
      // Preferencia de recordatorios por paciente y por canal (Ajustes del paciente).
      // 1 = recibe; 0 = no recibe. Default 1 = conserva el comportamiento actual.
      // Solo afecta a los RECORDATORIOS (sesión y pago), no a confirmaciones/cancelaciones.
      `ALTER TABLE patients ADD COLUMN reminders_whatsapp INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE patients ADD COLUMN reminders_email INTEGER NOT NULL DEFAULT 1`,
    ],
  },
  {
    version: 24,
    statements: [
      // Compartir un expediente en SOLO LECTURA con un colega de la MISMA organización
      // (Ajustes del paciente › Compartir). No cambia la propiedad ni el tratante: es un
      // permiso de lectura explícito, por paciente, revocable y trazado ('acceso_compartido').
      // El resolutor de acceso (resolvePatientAccess) re-verifica en cada lectura que el
      // que comparte SIGA siendo dueño y que ambos sigan en la org: si algo cambia, falla
      // cerrado. owner_user_id = quien comparte; grantee_user_id = colega receptor.
      `CREATE TABLE patient_shares (
         id TEXT PRIMARY KEY,
         patient_id TEXT NOT NULL,
         owner_user_id TEXT NOT NULL,
         grantee_user_id TEXT NOT NULL,
         organization_id TEXT NOT NULL,
         created_by TEXT NOT NULL,
         created_at TEXT NOT NULL,
         revoked_at TEXT
       )`,
      // A lo sumo UNA concesión viva por (paciente, colega); re-compartir tras revocar
      // crea una fila nueva (la anterior queda con revoked_at).
      `CREATE UNIQUE INDEX ix_patient_shares_active
         ON patient_shares (patient_id, grantee_user_id) WHERE revoked_at IS NULL`,
      // Búsqueda del resolutor: ¿qué me han compartido a mí? (grantee, vivo).
      `CREATE INDEX ix_patient_shares_grantee
         ON patient_shares (grantee_user_id) WHERE revoked_at IS NULL`,
    ],
  },
  {
    version: 25,
    statements: [
      // Cuota de almacenamiento de adjuntos POR PLAN (GB). NULL = sin valor
      // explícito → se usa un default en código (StorageQuotaGate). El límite
      // POR ARCHIVO (20 MB) sigue en UploadPatientFileMessage; esto es el tope
      // ACUMULADO por dueño. La cuota agrupada por organización queda para la
      // fase de propiedad-org; hoy es por owner_user_id.
      `ALTER TABLE plans ADD COLUMN storage_limit_gb INTEGER`,
      `UPDATE plans SET storage_limit_gb = 5 WHERE id = 'esencial'`,
      `UPDATE plans SET storage_limit_gb = 15 WHERE id = 'profesional'`,
      `UPDATE plans SET storage_limit_gb = 50 WHERE id = 'organizaciones'`,
    ],
  },
  {
    version: 26,
    statements: [
      // FIX del typo de v25: el id del plan es 'organizacion' (no 'organizaciones'),
      // así que su cuota de 50 GB nunca se aplicó (quedó NULL → default 15 en código).
      // Además, en BD nuevas el seed corre DESPUÉS de las migraciones e insertaba sin
      // storage_limit_gb (todas NULL → default 15). Re-asentamos las tres cuotas con
      // el id correcto (idempotente) y el seed ya las inserta para BD nuevas.
      `UPDATE plans SET storage_limit_gb = 5 WHERE id = 'esencial'`,
      `UPDATE plans SET storage_limit_gb = 15 WHERE id = 'profesional'`,
      `UPDATE plans SET storage_limit_gb = 50 WHERE id = 'organizacion'`,
      // Alinea el precio público de ORGANIZACIONES con el modelo por ASIENTO
      // (orgSeatPricing.ts es la fuente de verdad; "desde" = ORG_PRICE_FROM = 90.000
      // COP). El 59.000 anterior quedó obsoleto. COP-only: las demás monedas son
      // "a convenir" (el landing y el paywall muestran ORG_PRICE_FROM directo).
      `UPDATE plans SET prices_json = '{"COP":90000}' WHERE id = 'organizacion'`,
      // El bullet "desde 5 perfiles" quedó desfasado (el mínimo real es 2 y el precio
      // baja por volumen). Solo se corrige si conserva el texto viejo (no pisa
      // personalizaciones del admin).
      `UPDATE plans SET features_json = '["Precio por profesional que baja con el tamaño del equipo","Perfil maestro con permisos por miembro","Supervisión académica de practicantes","Retención de porcentaje por cobro","Logo y marca de tu institución","Acompañamiento en la implementación"]' WHERE id = 'organizacion' AND features_json LIKE '%desde 5 perfiles%'`,
    ],
  },
  {
    version: 27,
    statements: [
      // Overrides de topes POR CUENTA (admin): cuando un valor está presente,
      // PISA al del plan en el gate correspondiente; NULL = usar el plan. Sirve
      // para subirle el tope a quien paga más o cortárselo a quien abusa sin
      // cambiarle el plan entero. Para "sin tope", cambiar el plan (no este override).
      `CREATE TABLE IF NOT EXISTS user_limit_overrides (
         user_id TEXT PRIMARY KEY,
         ai_monthly_budget_cop INTEGER,
         ai_soft_budget_cop INTEGER,
         wa_monthly_limit INTEGER,
         storage_limit_gb INTEGER
       )`,
    ],
  },
  {
    version: 28,
    statements: [
      // VIGENCIA de los vínculos de supervisión (fix de seguridad). Antes el
      // vínculo se autorizaba por la mera existencia de la fila: sin estado, la
      // única forma de cortar el acceso clínico del supervisor era un DELETE
      // manual del maestro, y el offboarding no lo tocaba → lectura perpetua de
      // notas/historias descifradas del supervisado dado de baja. Con revoked_at
      // (NULL = vigente) el read path filtra revoked_at IS NULL + supervisado
      // activo (fail-closed), el offboarding revoca, y re-crear un vínculo lo
      // re-activa (save() pone revoked_at = NULL en el ON CONFLICT).
      `ALTER TABLE supervision_links ADD COLUMN revoked_at TEXT`,
    ],
  },
  {
    version: 29,
    statements: [
      // Notas PRIVADAS del paciente (bitácora del psicólogo): apuntes sueltos que
      // NO entran al expediente firmable. Lista con fecha; el body se cifra at-rest.
      `CREATE TABLE IF NOT EXISTS patient_notes (
         id TEXT PRIMARY KEY,
         owner_user_id TEXT NOT NULL,
         patient_id TEXT NOT NULL,
         body TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_notes ON patient_notes(owner_user_id, patient_id, created_at)`,
      // Backfill SIN pérdida: el antiguo campo único patients.notes pasa a ser la
      // primera nota de la bitácora. Queda en claro; el repo tolera ambos (cifrado
      // al escribir, descifra-si-cifrado al leer).
      // Id determinista y PORTABLE (una nota legada por paciente → 'note-legacy-'||id
      // es único). Antes usaba lower(hex(randomblob(16))), exclusivo de SQLite.
      `INSERT INTO patient_notes (id, owner_user_id, patient_id, body, created_at)
         SELECT 'note-legacy-' || id, owner_user_id, id, notes, created_at
           FROM patients WHERE notes IS NOT NULL AND notes <> ''`,
    ],
  },
  {
    version: 30,
    statements: [
      // Fin de tratamiento (Tier B): cierra el ciclo junto a process_status
      // (alta/abandono). Aditivo y en claro, como el resto de la ficha.
      `ALTER TABLE patients ADD COLUMN treatment_end_date TEXT`,
      `ALTER TABLE patients ADD COLUMN treatment_end_reason TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 31,
    statements: [
      // Tier B (admin/intake): seguro + nº de póliza (para quien factura a
      // aseguradoras) y derivación/"cómo nos conoció" (canal de adquisición).
      // Aditivo y en claro, como el resto de la ficha demográfica.
      `ALTER TABLE patients ADD COLUMN insurance_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN insurance_policy_number TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN referral_source TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 32,
    statements: [
      // Campos personalizados arbitrarios por paciente (Tier B): lista de
      // pares {label, value} en JSON. Flexibilidad que el psicólogo define
      // a su gusto. Aditivo y en claro como el resto de la ficha.
      `ALTER TABLE patients ADD COLUMN custom_fields_json TEXT NOT NULL DEFAULT '[]'`,
    ],
  },
  {
    version: 33,
    statements: [
      // Cuestionarios/escalas APLICADOS (PHQ-9, GAD-7…): cada aplicación queda con
      // sus respuestas, puntaje total y banda de severidad para seguir la evolución.
      // El puntaje/severidad van en claro (necesarios para ordenar/graficar la
      // tendencia, como los diagnósticos); el comentario libre se cifra at-rest.
      `CREATE TABLE IF NOT EXISTS patient_assessments (
         id TEXT PRIMARY KEY,
         owner_user_id TEXT NOT NULL,
         patient_id TEXT NOT NULL,
         instrument_id TEXT NOT NULL,
         answers_json TEXT NOT NULL DEFAULT '[]',
         total_score INTEGER NOT NULL DEFAULT 0,
         severity TEXT NOT NULL DEFAULT '',
         risk_flag INTEGER NOT NULL DEFAULT 0,
         notes TEXT NOT NULL DEFAULT '',
         applied_at TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_patient_assessments ON patient_assessments(owner_user_id, patient_id, instrument_id, applied_at)`,
    ],
  },
  {
    version: 34,
    statements: [
      // Expedientes sellados: una historia primaria (kind='historia') puede cerrarse
      // para abrir uno nuevo (nuevo episodio del mismo profesional, o relevo cuando
      // un colega recibe al paciente). closed_at NULL = vigente/abierta (editable);
      // con valor = sellada (solo lectura), preservada por continuidad clínica.
      // Las historias existentes quedan abiertas (NULL).
      `ALTER TABLE clinical_records ADD COLUMN closed_at TEXT`,
    ],
  },
  {
    version: 35,
    statements: [
      // Índices de las tablas clínicas que se consultan SIEMPRE por (owner_user_id,
      // patient_id) y no tenían respaldo (auditoría de calidad): evita full-scans que
      // escalan con el historial. Aditivo, no cambia ninguna consulta.
      `CREATE INDEX IF NOT EXISTS idx_diagnoses_owner_patient ON diagnoses(owner_user_id, patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_session_notes_owner_patient ON session_notes(owner_user_id, patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_clinical_records_owner_patient ON clinical_records(owner_user_id, patient_id)`,
      `CREATE INDEX IF NOT EXISTS idx_patient_files_owner_patient ON patient_files(owner_user_id, patient_id)`,
      // Subconsultas por reserva (recibos, último estado de WhatsApp del calendario):
      // invoices/outbox_messages solo estaban indexadas por patient_id/owner.
      `CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id)`,
      `CREATE INDEX IF NOT EXISTS idx_outbox_booking ON outbox_messages(booking_id, created_at)`,
    ],
  },
  {
    version: 36,
    statements: [
      // Folio del recibo: debe ser único por profesional (la secuencia es MAX(seq)+1
      // por dueño/año, calculada en JS, no atómica). Sin esta restricción, dos emisiones
      // casi simultáneas podrían generar el mismo folio sin que la BD lo rechace
      // (riesgo fiscal/legal). Índice único aditivo; los folios existentes ya son únicos.
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_owner_folio ON invoices(owner_user_id, folio)`,
    ],
  },
  {
    version: 37,
    statements: [
      // No repudio de la firma: quién (usuario autenticado) firmó realmente un reporte.
      // La firma deja de ser texto libre del cliente y se ata a la identidad+licencia del
      // perfil (ver SignPatientReport). Aditivo; id de usuario en claro (no PII sensible).
      `ALTER TABLE patient_reports ADD COLUMN signed_by_user_id TEXT`,
    ],
  },
  {
    version: 38,
    statements: [
      // Naturaleza del diagnóstico: hipótesis diagnóstica (por defecto, sin compromiso
      // clínico-legal) vs diagnóstico formal (afirmación que exige tarjeta profesional,
      // como la firma). Los diagnósticos existentes quedan como 'hipotesis' (lo seguro:
      // nadie con licencia los confirmó formalmente). `diagnosed_by_user_id` = quién es
      // responsable de la afirmación actual (no repudio). Aditivo.
      `ALTER TABLE diagnoses ADD COLUMN kind TEXT NOT NULL DEFAULT 'hipotesis'`,
      `ALTER TABLE diagnoses ADD COLUMN diagnosed_by_user_id TEXT`,
    ],
  },
  {
    version: 39,
    statements: [
      // Co-firma: un practicante sin tarjeta solicita la firma de su supervisor sobre un
      // reporte que él redactó y revisó. El reporte sigue siendo del practicante
      // (requester = owner); el supervisor lo firma con SU tarjeta (no repudio). La firma
      // cross-owner del supervisor va gateada por vínculo de supervisión ACTIVO.
      // Artefacto entre dos partes: se consulta por supervisor (bandeja) y por
      // requester+reporte (estado en el editor); no lleva un único owner_user_id.
      `CREATE TABLE report_signature_requests (
         id TEXT PRIMARY KEY,
         report_id TEXT NOT NULL,
         patient_id TEXT NOT NULL,
         requester_user_id TEXT NOT NULL,
         supervisor_user_id TEXT NOT NULL,
         organization_id TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'pendiente',
         note TEXT NOT NULL DEFAULT '',
         resolution_note TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL,
         resolved_at TEXT
       )`,
      `CREATE INDEX idx_sig_req_supervisor ON report_signature_requests(supervisor_user_id, status)`,
      `CREATE INDEX idx_sig_req_requester ON report_signature_requests(requester_user_id, report_id)`,
    ],
  },
  {
    version: 40,
    statements: [
      // Vínculos · familia: cada miembro de un caso relacional lleva su ROL/parentesco
      // (madre, padre, hijo/a, pareja…) y si es el PACIENTE IDENTIFICADO (quién porta el
      // síntoma, concepto sistémico). Aditivo; rol en claro (no PII sensible, es etiqueta
      // estructural). Habilita los casos de FAMILIA (N miembros) en la UI.
      `ALTER TABLE case_members ADD COLUMN role TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE case_members ADD COLUMN is_identified_patient INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 41,
    statements: [
      // Vínculos · asistentes por sesión: en familia no siempre vienen todos. Una sesión
      // conjunta registra QUIÉNES asistieron (ids de miembro), lo que permite sesiones de
      // subsistema (solo padres, solo hermanos). JSON de ids; '[]' = no especificado.
      // Estructura (no contenido clínico), va en claro.
      `ALTER TABLE case_session_notes ADD COLUMN attendees_json TEXT NOT NULL DEFAULT '[]'`,
    ],
  },
  {
    version: 42,
    statements: [
      // Vínculos · perfil del caso: evaluación del sistema (ciclo vital, estructura,
      // comunicación, motivo del sistema), objetivos, línea de tiempo de eventos y mapa
      // de relaciones entre miembros. Un único JSON; es contenido clínico de texto libre,
      // así que va CIFRADO at-rest (ver clinicalEncryption.ts). '' = perfil vacío.
      `ALTER TABLE relational_cases ADD COLUMN profile_json TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 43,
    statements: [
      // ===== Consultorios (docs/consultorios-spec.md §2) · Fase 1: solo ESTRUCTURA =====
      // Un consultorio es una sub-unidad OPCIONAL dentro de una organización ("Sede
      // Centro", "Sede Norte", un grupo clínico). En esta fase solo se guarda la
      // PERTENENCIA; el aislamiento de datos clínicos llega en la Fase 2. archived =
      // soft-delete para no romper el histórico.
      `CREATE TABLE consultorios (
         id TEXT PRIMARY KEY,
         organization_id TEXT NOT NULL,
         name TEXT NOT NULL,
         created_at TEXT NOT NULL,
         archived INTEGER NOT NULL DEFAULT 0
       )`,
      `CREATE INDEX idx_consultorios_org ON consultorios(organization_id)`,
      // A qué consultorio pertenece cada miembro (NULL = master / sin consultorio =
      // comportamiento actual, retrocompatible). Una org sin consultorios funciona
      // EXACTAMENTE como hoy.
      `ALTER TABLE organization_memberships ADD COLUMN consultorio_id TEXT`,
    ],
  },
  {
    version: 44,
    statements: [
      // ===== Recepción multi-consultorio (consultorios-spec §5) · Fase 5 =====
      // Permiso de la organización para habilitar la recepción multi-consultorio
      // (0 = deshabilitada; por defecto, retrocompatible). Sin esto, una cuenta de
      // recepción no puede agendar aunque tenga consultorios asignados.
      `ALTER TABLE organizations ADD COLUMN reception_multi_consultorio INTEGER NOT NULL DEFAULT 0`,
      // Recepción (cuenta role='assistant') ↔ consultorios que atiende, dentro de UNA
      // organización. A diferencia del asistente 1:1 (tabla assistants → un titular), la
      // recepción NO resuelve un dueño único: elige el profesional destino por acción y
      // se valida que pertenezca a uno de estos consultorios.
      `CREATE TABLE reception_consultorios (
         id TEXT PRIMARY KEY,
         assistant_user_id TEXT NOT NULL,
         organization_id TEXT NOT NULL,
         consultorio_id TEXT NOT NULL,
         created_at TEXT NOT NULL
       )`,
      `CREATE UNIQUE INDEX idx_reception_consultorio ON reception_consultorios(assistant_user_id, consultorio_id)`,
      `CREATE INDEX idx_reception_by_org ON reception_consultorios(organization_id)`,
    ],
  },
  {
    version: 45,
    statements: [
      // ===== Modo de consultorios (consultorios-spec, Modo Sedes) · MS1 =====
      // 'aislado' (por defecto, retrocompatible): cada consultorio es una frontera
      // clínica (F2/F4). 'compartido': los consultorios son SEDES/ubicaciones; todos
      // comparten la lista de pacientes (según la política de acceso de la org) y el
      // aislamiento por consultorio queda APAGADO. El maestro lo elige por organización.
      `ALTER TABLE organizations ADD COLUMN consultorio_mode TEXT NOT NULL DEFAULT 'aislado'`,
    ],
  },
  {
    version: 46,
    statements: [
      // ===== "Tratado en" del paciente (Modo Sedes) · MS2 =====
      // Sede de atención del paciente (NULL = sin sede / org sin consultorios / individual).
      // Solo se MUESTRA y edita en modo 'compartido' (en 'aislado' el consultorio del
      // paciente se deriva del dueño). Se setea al alta = sede del miembro que lo crea.
      `ALTER TABLE patients ADD COLUMN consultorio_id TEXT`,
    ],
  },
  {
    version: 47,
    statements: [
      // ===== Sede por sesión (Modo Sedes) · MS3 =====
      // Sede donde ocurre cada cita (NULL = sin sede). En modo 'compartido' se puede
      // elegir al agendar (incl. la recepción) y puede diferir de la sede principal del
      // paciente. Solo metadato; no afecta el aislamiento (que en compartido está apagado).
      `ALTER TABLE bookings ADD COLUMN consultorio_id TEXT`,
    ],
  },
  {
    version: 48,
    statements: [
      // ===== Epoch de sesión por usuario (SEG-4) =====
      // Se embebe en el token de sesión y se incrementa al restablecer/cambiar la
      // contraseña: las cookies emitidas con un epoch anterior dejan de ser válidas
      // (una cookie robada no sobrevive a un reset). 0 = nunca rotada.
      `ALTER TABLE users ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 49,
    statements: [
      // ===== Revocación de consentimiento (LEG-2, Ley 1581 / Habeas Data) =====
      // Un consentimiento YA otorgado puede revocarse (el titular retira su autorización);
      // se conserva cuándo. NULL = vigente / no revocado.
      `ALTER TABLE patient_consents ADD COLUMN revoked_at TEXT`,
    ],
  },
  {
    version: 50,
    statements: [
      // ===== Menores de edad · representante legal (acudiente) =====
      // En Colombia atender a un menor exige el consentimiento de su REPRESENTANTE LEGAL
      // (acudiente). Se capturan sus datos en la ficha del paciente para mostrarlos,
      // editarlos y, cuando el paciente sea menor (edad < 18 derivada de birth_date),
      // hacer que el consentimiento lo otorgue el representante en nombre del menor.
      // Campos en claro como el resto de la ficha demográfica (no son contenido clínico
      // pesado que se cifra). Opcionales/retrocompatibles: DEFAULT '' → los pacientes
      // existentes (adultos) no cambian de comportamiento.
      `ALTER TABLE patients ADD COLUMN guardian_name TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN guardian_relationship TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE patients ADD COLUMN guardian_document TEXT NOT NULL DEFAULT ''`,
    ],
  },
  {
    version: 51,
    statements: [
      // ===== Verificación de correo en el registro (doble opt-in, NO bloqueante) =====
      // Hoy el registro crea la cuenta ACTIVA y entra sin confirmar el correo (cualquiera
      // puede registrarse con un correo que no posee). Se añade verificación NO bloqueante:
      // la cuenta sirve igual, pero hasta confirmar el correo se muestra un banner.
      //
      // email_verified_at: NULL = no verificado; con fecha = verificado.
      `ALTER TABLE users ADD COLUMN email_verified_at TEXT`,
      // Backfill: las cuentas EXISTENTES quedan verificadas (no se auto-registraron con
      // este flujo y no deben ver el banner). SOLO los registros NUEVOS nacerán sin verificar.
      `UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL`,
      // Tokens de verificación (espeja password_reset_tokens, pero expiran en 7 días:
      // la verificación no es urgente). Un solo uso (used).
      `CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 52,
    statements: [
      // ===== Prueba de aceptación de T&C + aviso de privacidad en el registro (Ley 1581) =====
      // Antes el alta gateaba la casilla pero DESCARTABA el booleano: no había forma de
      // probar QUÉ versión de los documentos legales aceptó cada profesional ni CUÁNDO
      // (defensa básica ante la SIC para un SaaS de datos de salud). Se SELLA en el alta.
      // Los documentos se versionan por fecha — fuente única en src/shared/legal/legalVersions.ts.
      `ALTER TABLE users ADD COLUMN terms_accepted_at TEXT`,
      `ALTER TABLE users ADD COLUMN terms_version TEXT`,
      `ALTER TABLE users ADD COLUMN privacy_version TEXT`,
      // Las cuentas EXISTENTES quedan sin sello (NULL) a propósito: no se auto-registraron
      // con este flujo y no hay marca retroactiva fiable. Solo los registros NUEVOS la llevan.
    ],
  },
  {
    version: 53,
    statements: [
      // ===== Defensa en profundidad contra DOBLE-RESERVA =====
      // La protección real es la serialización por BEGIN IMMEDIATE + el chequeo de solape;
      // este índice ÚNICO es el cinturón de seguridad ante cualquier ruta de escritura futura
      // que olvide la transacción: dos citas ACTIVAS no pueden ocupar el MISMO inicio en la
      // MISMA agenda del MISMO profesional. El predicado `status != 'cancelada'` espeja
      // findOverlapping() (una cita cancelada libera el cupo y no debe bloquear el índice).
      //
      // Antes de crear el índice, resolvemos cualquier duplicado EXISTENTE (no cancelado)
      // conservando UNA cita por grupo (MIN(id)), para que CREATE UNIQUE INDEX nunca falle al
      // aplicar la migración (la app no está en producción: sin datos reales que perder).
      `DELETE FROM bookings
        WHERE status != 'cancelada'
          AND id NOT IN (
            SELECT MIN(id) FROM bookings
             WHERE status != 'cancelada'
             GROUP BY owner_user_id, agenda_id, start_at
          )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double
        ON bookings(owner_user_id, agenda_id, start_at)
        WHERE status != 'cancelada'`,
    ],
  },
  {
    version: 54,
    statements: [
      // ===== Suscripción: cancelación self-service + idempotencia del cobro =====
      // (A) canceled_at: cancelar "al fin de periodo" sin cortar el acceso. status sigue 'activa'
      // y el acceso dura hasta current_period_end; pagar de nuevo lo limpia. NULL = vigente.
      `ALTER TABLE subscriptions ADD COLUMN canceled_at TEXT`,
      // (B) idempotency_key: evita el DOBLE COBRO si el usuario reintenta el pago (reintento de
      // red / doble clic). El cliente manda una clave estable por intento; un reintento con la
      // MISMA clave no inserta otro pago ni vuelve a extender el periodo. Único parcial: los
      // pagos antiguos (y los del admin, sin clave) quedan NULL y no chocan entre sí.
      `ALTER TABLE subscription_payments ADD COLUMN idempotency_key TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_payments_idem
        ON subscription_payments(idempotency_key)
        WHERE idempotency_key IS NOT NULL`,
    ],
  },
  {
    version: 55,
    statements: [
      // ===== Cifrado at-rest de la PII del paciente: índice ciego del documento =====
      // document_number se cifra como las demás columnas PII (clinicalEncryption v5), pero la
      // deduplicación de pacientes necesita buscar por documento. Se guarda aparte un índice ciego
      // (HMAC del documento) en document_hash y se busca por él. El pase de arranque rellena el hash
      // de las filas existentes desde el documento en claro ANTES de cifrarlo (ver patientPiiEncryption).
      `ALTER TABLE patients ADD COLUMN document_hash TEXT`,
      `CREATE INDEX IF NOT EXISTS idx_patients_document_hash
        ON patients(owner_user_id, document_hash)`,
    ],
  },
  {
    version: 56,
    statements: [
      // ===== Outbox durable: reintentos con backoff (re-plataforma 0f) =====
      // Un envío de correo que falla de forma transitoria se re-encola ('pendiente' +
      // next_attempt_at) en vez de marcarse 'fallido', y un worker (processOutbox, llamado por
      // /api/jobs/run) lo reintenta. attempts limita los reintentos antes de 'fallido' definitivo.
      `ALTER TABLE outbox_messages ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE outbox_messages ADD COLUMN next_attempt_at TEXT`,
      // Índice para que el worker encuentre lo pendiente y vencido sin escanear toda la tabla.
      `CREATE INDEX IF NOT EXISTS idx_outbox_due
        ON outbox_messages(status, next_attempt_at)`,
    ],
  },
  {
    version: 57,
    statements: [
      // ===== Consentimiento de procesamiento por IA (Tanda 0 IA · Ley 1581) =====
      // El consentimiento informado base NO cubría el procesamiento por un proveedor de IA
      // (Anthropic) ni la transferencia internacional de datos sensibles de salud. Se añade un flag
      // de finalidad-IA al consentimiento: el asistente solo recibe el contexto de un paciente si
      // tiene un consentimiento OTORGADO, no revocado y con ai_authorized=1. DEFAULT 0 = fail-closed:
      // los consentimientos existentes NO autorizan IA hasta re-otorgar bajo la cláusula de IA.
      `ALTER TABLE patient_consents ADD COLUMN ai_authorized INTEGER NOT NULL DEFAULT 0`,
    ],
  },
  {
    version: 58,
    statements: [
      // ===== Boletín de pre-lanzamiento =====
      // Correos que los visitantes dejan en el banner "sitio en desarrollo" de la landing para
      // enterarse del avance. Dato de marketing GLOBAL (sin owner_user_id: el visitante es anónimo,
      // no pertenece a ningún tenant) y NO clínico (no va en ENCRYPTED_CLINICAL_COLUMNS). UNIQUE en
      // email → la suscripción repetida es idempotente (ON CONFLICT DO NOTHING, portable a ambos
      // motores). source registra desde dónde se suscribió, por si luego hay más puntos de captura.
      `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
         id TEXT PRIMARY KEY,
         email TEXT NOT NULL UNIQUE,
         source TEXT NOT NULL,
         created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 59,
    statements: [
      // ===== Automatizaciones de marketing POR PROPIETARIO =====
      // La tabla v1 tenía UNIQUE(kind): aunque v3 añadió owner_user_id, seguía existiendo
      // una sola configuración global por tipo. Se reconstruye de forma portable para SQLite y
      // Postgres con UNIQUE(owner_user_id, kind) y owner obligatorio.
      `CREATE TABLE marketing_automations_v59 (
         id TEXT PRIMARY KEY,
         owner_user_id TEXT NOT NULL REFERENCES users(id),
         kind TEXT NOT NULL CHECK (kind IN ('cumpleanios', 'reactivacion')),
         enabled INTEGER NOT NULL DEFAULT 0,
         interval_months INTEGER,
         subject TEXT NOT NULL DEFAULT '',
         body TEXT NOT NULL DEFAULT '',
         UNIQUE(owner_user_id, kind)
       )`,
      // Retrocompatibilidad: la configuración legacy era efectiva para TODOS los dueños que
      // ejecutaba el job. Se copia a cada dueño existente para no activar/desactivar ni cambiar
      // mensajes durante el despliegue. No se conserva como plantilla global: los usuarios nuevos
      // reciben después el default integrado y desactivado del dominio, sin heredar cambios ajenos.
      `INSERT INTO marketing_automations_v59
         (id, owner_user_id, kind, enabled, interval_months, subject, body)
       SELECT u.id || ':marketing-automation:' || legacy.kind,
              u.id,
              legacy.kind,
              legacy.enabled,
              legacy.interval_months,
              legacy.subject,
              legacy.body
         FROM users u
         CROSS JOIN marketing_automations legacy
        WHERE u.role IN ('psychologist', 'professor', 'org_master')
          AND legacy.kind IN ('cumpleanios', 'reactivacion')`,
      `DROP TABLE marketing_automations`,
      `ALTER TABLE marketing_automations_v59 RENAME TO marketing_automations`,
      `CREATE INDEX idx_marketing_automations_owner ON marketing_automations(owner_user_id)`,
    ],
  },
  {
    version: 60,
    statements: [
      // ===== Favoritos de la biblioteca POR USUARIO =====
      // `library_publications` es un catálogo editorial compartido. Su columna legacy
      // `favorite` no tiene propietario y, por tanto, no puede representar una preferencia
      // personal sin que un usuario cambie la vista de todos los demás. La relación queda
      // separada y se elimina automáticamente al borrar cualquiera de sus extremos.
      `CREATE TABLE library_publication_favorites (
         user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         publication_id TEXT NOT NULL REFERENCES library_publications(id) ON DELETE CASCADE,
         created_at TEXT NOT NULL,
         PRIMARY KEY (user_id, publication_id)
       )`,
      `CREATE INDEX idx_library_publication_favorites_publication
         ON library_publication_favorites(publication_id)`,
      // Decisión de migración conservadora: NO se copian las filas con
      // library_publications.favorite=1. El dato global legacy no conserva quién lo marcó;
      // atribuirlo a todos (o a un usuario arbitrario) fabricaría preferencias personales.
      // La columna se mantiene por compatibilidad de esquema, pero desde v60 queda ignorada.
    ],
  },
];

export function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  const current = row?.user_version ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec('BEGIN');
    try {
      for (const statement of migration.statements) db.exec(statement);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** La versión más alta del esquema (último número de migración). */
export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/**
 * Runner de migraciones ASÍNCRONO sobre el puerto {@link DatabaseAdapter} — la
 * vía de Postgres (y, en general, de cualquier motor de red). Reemplaza el
 * `PRAGMA user_version` de SQLite por una tabla `schema_migrations` portable.
 * Cada migración corre en su propia transacción (atómica: o todas sus sentencias
 * o ninguna). El SQL de las migraciones ya es dialecto-neutro.
 *
 * Convive con `runMigrations(db)` (SQLite, vía `getDb()`): el boot de SQLite no
 * cambia; este runner es el que usa el `bin/migrate` de despliegue contra PG.
 */
export async function runMigrationsOnAdapter(db: DatabaseAdapter): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version INTEGER PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );
  const row = await db.queryRow<{ max: number | null }>(
    'SELECT MAX(version) AS max FROM schema_migrations',
  );
  const current = row?.max ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.transaction(async () => {
      for (const statement of migration.statements) {
        await db.execute(statement);
      }
      await db.execute('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
        migration.version,
        new Date().toISOString(),
      ]);
    });
  }
}
