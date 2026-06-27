/**
 * Utilidades de lectura de plantillas Excel para el módulo de carga.
 * `xlsx` se importa de forma diferida para que quede en su propio chunk y no
 * pese en el bundle inicial de la aplicación.
 */

/** Lee la primera hoja de un archivo Excel como matriz de filas (incluye encabezado). */
export async function leerPrimeraHoja(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
}

/** `true` si la fila no tiene ningún valor útil (toda vacía/nula). */
export function filaVacia(row: readonly unknown[]): boolean {
  return row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '');
}

/** Convierte una celda a texto plano; las celdas vacías quedan en `null`. */
export function celdaATexto(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (typeof value === 'number') return numeroATexto(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text === '' ? null : text;
}

/**
 * Trunca un monto a 2 decimales SIN aproximar, tomando los dígitos tal cual:
 * `2636.1152` → `"2636.11"`, `442.07000001` → `"442.07"`, `3800` → `"3800.00"`.
 * Opera sobre la representación en texto para evitar errores de punto flotante
 * (p. ej. `4416.45 * 100 = 441644.999…`). Devuelve `null` si la celda está vacía.
 */
export function montoDosDecimales(value: unknown): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const raw = typeof value === 'number' ? numeroATexto(value) : String(value).trim().replace(',', '.');
  const negativo = raw.startsWith('-');
  const sinSigno = negativo ? raw.slice(1) : raw;
  const [entero, decimales = ''] = sinSigno.split('.');
  const dosDecimales = (decimales + '00').slice(0, 2);
  return `${negativo ? '-' : ''}${entero || '0'}.${dosDecimales}`;
}

/** Número a texto evitando notación científica para los rangos de facturación. */
function numeroATexto(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toFixed(0);
  return String(n);
}
