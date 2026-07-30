/**
 * Escapa el texto antes de incrustarlo en el HTML del correo. Las líneas salen
 * de los Excel que sube el usuario, así que un `&` o un `<` romperían el cuerpo.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
