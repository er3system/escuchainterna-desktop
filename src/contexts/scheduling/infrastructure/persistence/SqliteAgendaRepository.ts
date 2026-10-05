import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Agenda } from '../../domain/Agenda';
import type { AgendaModality, AgendaPaymentMode, AgendaPrimitives } from '../../domain/Agenda';
import type { AgendaRepository } from '../../domain/repositories/AgendaRepository';
import type { DayAvailabilityPrimitives } from '../../domain/value-objects/WeeklyAvailability';

interface AgendaRow {
  id: string;
  name: string;
  color: string;
  slug: string;
  duration_minutes: number;
  slot_interval_minutes: number;
  min_booking_hours: number;
  /** Colchón en minutos tras cada sesión (migración v11). */
  buffer_minutes: number;
  overrides_availability: number;
  availability_json: string | null;
  overrides_payment: number;
  price: number | null;
  payment_mode: string | null;
  show_price: number | null;
  show_stripe_link: number;
  /** Moneda propia de la agenda; '' = usar la del perfil (migración v7). */
  currency: string | null;
  overrides_location: number;
  modality: string | null;
  address: string | null;
  maps_url: string | null;
  active: number;
  created_at: string;
}

/** Repositorio de agendas acotado al dueño (owner_user_id) de la sesión. */
export class SqliteAgendaRepository implements AgendaRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async save(agenda: Agenda): Promise<void> {
    const primitives = agenda.toPrimitives();
    await this.db.execute(
      `INSERT INTO agendas
          (id, name, color, slug, duration_minutes, slot_interval_minutes, min_booking_hours,
           buffer_minutes,
           overrides_availability, availability_json,
           overrides_payment, price, payment_mode, show_price, show_stripe_link, currency,
           overrides_location, modality, address, maps_url,
           active, created_at, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           color = excluded.color,
           slug = excluded.slug,
           duration_minutes = excluded.duration_minutes,
           slot_interval_minutes = excluded.slot_interval_minutes,
           min_booking_hours = excluded.min_booking_hours,
           buffer_minutes = excluded.buffer_minutes,
           overrides_availability = excluded.overrides_availability,
           availability_json = excluded.availability_json,
           overrides_payment = excluded.overrides_payment,
           price = excluded.price,
           payment_mode = excluded.payment_mode,
           show_price = excluded.show_price,
           show_stripe_link = excluded.show_stripe_link,
           currency = excluded.currency,
           overrides_location = excluded.overrides_location,
           modality = excluded.modality,
           address = excluded.address,
           maps_url = excluded.maps_url,
           active = excluded.active,
           created_at = excluded.created_at,
           owner_user_id = excluded.owner_user_id`,
      [
        primitives.id,
        primitives.name,
        primitives.color,
        primitives.slug,
        primitives.durationMinutes,
        primitives.slotIntervalMinutes,
        primitives.minBookingHours,
        primitives.bufferMinutes,
        primitives.availabilityOverride ? 1 : 0,
        primitives.availabilityOverride ? JSON.stringify(primitives.availabilityOverride) : null,
        primitives.paymentOverride ? 1 : 0,
        primitives.paymentOverride ? primitives.paymentOverride.price : null,
        primitives.paymentOverride ? primitives.paymentOverride.paymentMode : null,
        primitives.paymentOverride ? (primitives.paymentOverride.showPrice ? 1 : 0) : null,
        primitives.paymentOverride && primitives.paymentOverride.showStripeLink ? 1 : 0,
        primitives.paymentOverride ? primitives.paymentOverride.currency : '',
        primitives.locationOverride ? 1 : 0,
        primitives.locationOverride ? primitives.locationOverride.modality : null,
        primitives.locationOverride ? primitives.locationOverride.address : null,
        primitives.locationOverride ? primitives.locationOverride.mapsUrl : null,
        primitives.active ? 1 : 0,
        primitives.createdAt,
        this.ownerUserId,
      ],
    );
  }

  public async findById(id: string): Promise<Agenda | null> {
    const row = await this.db.queryRow<AgendaRow>(
      'SELECT * FROM agendas WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? Agenda.fromPrimitives(this.hydrate(row)) : null;
  }

  public async findBySlug(slug: string): Promise<Agenda | null> {
    const row = await this.db.queryRow<AgendaRow>(
      'SELECT * FROM agendas WHERE slug = ? AND owner_user_id = ?',
      [slug, this.ownerUserId],
    );
    return row ? Agenda.fromPrimitives(this.hydrate(row)) : null;
  }

  public async findAll(): Promise<Agenda[]> {
    const rows = await this.db.query<AgendaRow>(
      'SELECT * FROM agendas WHERE owner_user_id = ? ORDER BY created_at ASC',
      [this.ownerUserId],
    );
    return rows.map((row) => Agenda.fromPrimitives(this.hydrate(row)));
  }

  private hydrate(row: AgendaRow): AgendaPrimitives {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      slug: row.slug,
      durationMinutes: row.duration_minutes,
      slotIntervalMinutes: row.slot_interval_minutes,
      minBookingHours: row.min_booking_hours,
      bufferMinutes: row.buffer_minutes ?? 0,
      availabilityOverride:
        row.overrides_availability === 1 && row.availability_json
          ? (JSON.parse(row.availability_json) as DayAvailabilityPrimitives[])
          : null,
      paymentOverride:
        row.overrides_payment === 1
          ? {
              price: row.price ?? 0,
              paymentMode: (row.payment_mode ?? 'manual') as AgendaPaymentMode,
              showPrice: row.show_price === null ? true : row.show_price === 1,
              showStripeLink: row.show_stripe_link === 1,
              currency: row.currency ?? '',
            }
          : null,
      locationOverride:
        row.overrides_location === 1
          ? {
              modality: (row.modality ?? 'ambas') as AgendaModality,
              address: row.address ?? '',
              mapsUrl: row.maps_url ?? '',
            }
          : null,
      active: row.active === 1,
      createdAt: row.created_at,
    };
  }
}
