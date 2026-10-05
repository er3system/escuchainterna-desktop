import type { UUID } from '@haskou/value-objects';
import type { CalendarTimeWindow } from './value-objects/CalendarTimeWindow';
import type { CalendarSessionSlot } from './CalendarSessionSlot';
/** Anticorrupción de agenda: solo horarios, siempre del dueño autorizado. */
export interface CalendarSchedule { slots(owner: UUID, window: CalendarTimeWindow): Promise<readonly CalendarSessionSlot[]> }
