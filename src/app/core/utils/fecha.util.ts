/**
 * Formato de fecha y hora para la bitácora de auditoría.
 *
 * `formatAccess` (usuario.mapper.ts) no incluye segundos porque para «último
 * acceso» no hacen falta. Una bitácora sí los necesita: sin ellos, dos eventos
 * del mismo minuto se ven idénticos y no se sabe cuál ocurrió antes.
 */

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Fecha ISO (UTC) a hora de Colombia: «27/06/2026 · 14:30:52». */
export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return FECHA_HORA.format(date).replace(', ', ' · ');
}

/**
 * Convierte lo que escribe un `<input type="date">` en el instante inicial o
 * final de ese día en Colombia, para que un filtro «del 1 al 5» incluya el 5
 * completo y no se corte a medianoche UTC.
 */
export function limiteDelDia(fecha: string, extremo: 'inicio' | 'fin'): string | null {
  if (!fecha) return null;
  const hora = extremo === 'inicio' ? '00:00:00.000' : '23:59:59.999';
  // -05:00 es la hora de Colombia, que no aplica horario de verano.
  const instante = new Date(`${fecha}T${hora}-05:00`);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}
