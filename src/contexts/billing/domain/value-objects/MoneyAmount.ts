import { NumberValueObject } from '@haskou/value-objects';
import { formatMoneyWithCode } from '@/shared/domain/currencies';

/**
 * Monto monetario de la consulta con el formato local de su moneda y el código
 * ISO visible para evitar ambigüedad entre divisas que comparten símbolo.
 */
export class MoneyAmount extends NumberValueObject {
  public formatted(currency: string): string {
    return formatMoneyWithCode(this.valueOf(), currency);
  }
}
