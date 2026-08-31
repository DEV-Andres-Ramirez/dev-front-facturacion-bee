/**
 * Empaquetado de los soportes de un periodo en un `.zip` (RF-DOC-02).
 *
 * `jszip` se importa de forma diferida para que quede en su propio *chunk* y no
 * pese en el arranque de la aplicación, igual que se hace con `xlsx`.
 */

export interface ArchivoDescargable {
  /** Nombre con el que aparecerá dentro del zip, ya con su extensión. */
  readonly nombre: string;
  /** Carpeta dentro del zip; se usa el tipo de documento. */
  readonly carpeta: string;
  /** URL pública en Supabase Storage. */
  readonly url: string;
}

export interface ResultadoZip {
  readonly ok: boolean;
  readonly incluidos: number;
  readonly fallidos: readonly string[];
}

/** Evita que dos archivos con el mismo nombre se pisen dentro del zip. */
function nombreUnico(usados: Set<string>, ruta: string): string {
  if (!usados.has(ruta)) {
    usados.add(ruta);
    return ruta;
  }
  const punto = ruta.lastIndexOf('.');
  const base = punto === -1 ? ruta : ruta.slice(0, punto);
  const ext = punto === -1 ? '' : ruta.slice(punto);
  let intento = 2;
  while (usados.has(`${base} (${intento})${ext}`)) intento++;
  const definitivo = `${base} (${intento})${ext}`;
  usados.add(definitivo);
  return definitivo;
}

/**
 * Descarga los archivos y los entrega en un único `.zip`.
 *
 * Un archivo que falle no aborta el paquete: se devuelve en `fallidos` para
 * poder avisar de qué faltó, en vez de dejar al usuario sin descarga alguna.
 */
export async function descargarZip(
  nombreArchivo: string,
  archivos: readonly ArchivoDescargable[],
): Promise<ResultadoZip> {
  if (archivos.length === 0) return { ok: false, incluidos: 0, fallidos: [] };

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const usados = new Set<string>();
  const fallidos: string[] = [];

  // Secuencial y no en paralelo: son archivos de varios MB y descargarlos todos
  // a la vez llenaría la memoria del navegador sin ganar tiempo real.
  for (const archivo of archivos) {
    try {
      const respuesta = await fetch(archivo.url);
      if (!respuesta.ok) {
        fallidos.push(archivo.nombre);
        continue;
      }
      const ruta = nombreUnico(usados, `${archivo.carpeta}/${archivo.nombre}`);
      zip.file(ruta, await respuesta.blob());
    } catch {
      fallidos.push(archivo.nombre);
    }
  }

  const incluidos = archivos.length - fallidos.length;
  if (incluidos === 0) return { ok: false, incluidos: 0, fallidos };

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);

  return { ok: true, incluidos, fallidos };
}
