/**
 * Utilidades de monto para los cotejos del ciclo. Los montos se guardan como
 * texto con 2 decimales sin aproximar; aquí se convierten a CENTAVOS (enteros)
 * para sumar y comparar de forma exacta, sin errores de punto flotante.
 */

const FMT = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `"4416.45"` → `441645` centavos. Vacío/nulo → `0`. */
export function montoACentavos(text: string | null | undefined): number {
  if (text === null || text === undefined || String(text).trim() === '') return 0;
  const t = String(text).trim().replace(',', '.');
  const negativo = t.startsWith('-');
  const [entero, decimales = ''] = (negativo ? t.slice(1) : t).split('.');
  const cents = (parseInt(entero || '0', 10) || 0) * 100 + (parseInt((decimales + '00').slice(0, 2), 10) || 0);
  return negativo ? -cents : cents;
}

/** `441645` → `"4.416,45"` (es-CO). Con `withCurrency` antepone `USD`. */
export function formatCentavos(cents: number, withCurrency = false): string {
  const formateado = FMT.format(cents / 100);
  return withCurrency ? `USD ${formateado}` : formateado;
}
