import { Pipe, PipeTransform } from '@angular/core';

const FORMATTER = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatea un monto en dólares con el patrón colombiano: `4382` → «USD 4.382,00».
 * Uso: `{{ invoice.amountUsd | usd }}`. Con `false` omite el prefijo de moneda.
 */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(value: number | null | undefined, withPrefix = true): string {
    if (value === null || value === undefined) return '—';
    const amount = FORMATTER.format(value);
    return withPrefix ? `USD ${amount}` : amount;
  }
}
