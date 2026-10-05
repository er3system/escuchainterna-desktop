import { UUID } from '@haskou/value-objects';
export class ConsentReceptionId {
  private readonly value: UUID;
  public constructor(raw: string) { this.value = new UUID(raw.toLowerCase()); }
  public equals(other: ConsentReceptionId): boolean { return this.value.toString() === other.value.toString(); }
  public toString(): string { return this.value.toString(); }
}
