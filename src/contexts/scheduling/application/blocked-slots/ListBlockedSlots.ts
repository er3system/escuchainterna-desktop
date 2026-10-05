import type { BlockedSlotPrimitives } from '../../domain/BlockedSlot';
import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';

/** Lista bloqueos por rango (para el calendario) o próximos (para gestionarlos). */
export class ListBlockedSlots {
  public constructor(private readonly blockedSlots: BlockedSlotRepository) {}

  public async between(from: Date, to: Date): Promise<BlockedSlotPrimitives[]> {
    const slots = await this.blockedSlots.findBetween(from, to);
    return slots.map((slot) => slot.toPrimitives());
  }

  public async upcoming(now: Date, limit = 20): Promise<BlockedSlotPrimitives[]> {
    const slots = await this.blockedSlots.listUpcoming(now, limit);
    return slots.map((slot) => slot.toPrimitives());
  }
}
