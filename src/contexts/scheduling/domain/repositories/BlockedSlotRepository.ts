import type { BlockedSlot } from '../BlockedSlot';

export interface BlockedSlotRepository {
  save(slot: BlockedSlot): Promise<void>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<BlockedSlot | null>;
  /** Bloqueos con algún traslape con el rango [from, to). */
  findBetween(from: Date, to: Date): Promise<BlockedSlot[]>;
  /** Próximos bloqueos que terminan después de `now`, ascendentes, hasta `limit`. */
  listUpcoming(now: Date, limit: number): Promise<BlockedSlot[]>;
}
