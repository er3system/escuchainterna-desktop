import { randomUUID } from 'node:crypto';
import { BlockedSlot } from '../../domain/BlockedSlot';
import type { BlockedSlotPrimitives } from '../../domain/BlockedSlot';
import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';

/** Crea un espacio bloqueado (tiempo no reservable que no es un paciente). */
export class CreateBlockedSlot {
  public constructor(private readonly blockedSlots: BlockedSlotRepository) {}

  public async create(input: {
    startAtIso: string;
    endAtIso: string;
    title?: string;
  }): Promise<BlockedSlotPrimitives> {
    const slot = BlockedSlot.create({
      id: randomUUID(),
      startAt: new Date(input.startAtIso),
      endAt: new Date(input.endAtIso),
      title: input.title,
    });
    await this.blockedSlots.save(slot);
    return slot.toPrimitives();
  }
}
