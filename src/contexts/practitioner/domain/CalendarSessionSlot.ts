import type { UUID } from '@haskou/value-objects';
import type { CalendarTimeWindow } from './value-objects/CalendarTimeWindow';
/** Proyección mínima de una sesión: nunca contiene paciente, correo ni contenido clínico. */
export class CalendarSessionSlot {
  public constructor(public readonly booking: UUID, public readonly time: CalendarTimeWindow) {}
}
