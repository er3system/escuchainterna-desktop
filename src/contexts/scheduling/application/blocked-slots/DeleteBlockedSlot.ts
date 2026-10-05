import type { BlockedSlotRepository } from '../../domain/repositories/BlockedSlotRepository';

/** Elimina un espacio bloqueado por id (acotado al dueño en el repositorio). */
export class DeleteBlockedSlot {
  public constructor(private readonly blockedSlots: BlockedSlotRepository) {}

  public async delete(id: string): Promise<void> {
    await this.blockedSlots.delete(id);
  }
}
