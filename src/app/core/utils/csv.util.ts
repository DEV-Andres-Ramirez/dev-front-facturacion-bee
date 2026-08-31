/**
 * Generación y descarga de archivos CSV.
 *
 * Se escribe a mano en lugar de usar `xlsx` por dos motivos: no añade peso al
 * bundle y no amplía el uso de esa dependencia, que arrastra vulnerabilidades
 * conocidas. El resultado se abre directamente en Excel.
 */

/** Excel usa el separador de la configuración regional; en es-CO es el punto y coma. */
const SEPARADOR = ';';

/**
 * Marca de orden de bytes UTF-8. Sin ella Excel interpreta el archivo como
 * ANSI y las tildes y las eñes salen corruptas.
 */
const BOM = '﻿';

/**
 * Escapa un valor para CSV: entrecomilla si contiene el separador, comillas o
 * saltos de línea, y duplica las comillas internas.
 */
function escapar(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  if (!/["\n\r;,]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Convierte cabeceras y filas en el contenido de un CSV. */
export function generarCsv(
  cabeceras: readonly string[],
  filas: readonly (readonly unknown[])[],
): string {
  const lineas = [
    cabeceras.map(escapar).join(SEPARADOR),
    ...filas.map((fila) => fila.map(escapar).join(SEPARADOR)),
  ];
  return BOM + lineas.join('\r\n');
}

/** Genera el CSV y lo descarga con el nombre indicado. */
export function descargarCsv(
  nombreArchivo: string,
  cabeceras: readonly string[],
  filas: readonly (readonly unknown[])[],
): void {
  const blob = new Blob([generarCsv(cabeceras, filas)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  // Sin esto el blob se queda en memoria mientras viva la pestaña.
  URL.revokeObjectURL(url);
}
