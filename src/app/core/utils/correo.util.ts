import {
  AdjuntoCorreo,
  AprobacionPrefacturaRow,
  CorreoPreparado,
  EdicionCorreo,
  FacturaRow,
  PlantillaCorreo,
  RegistroInternaRow,
} from '../models';
import { escaparHtml } from './html.util';

/**
 * Composición de los correos de entrega al cliente.
 *
 * Es lógica de dominio pura —entra el periodo con sus datos, sale el correo—,
 * así que vive fuera del componente: se prueba sin Angular y la pantalla se
 * queda con lo suyo, que es pintar y recoger las ediciones del usuario.
 */

const SIN_SECUENCIAL = 'Sin secuencial';

/**
 * Validación deliberadamente permisiva: solo descarta lo que con seguridad no
 * es una dirección. Rechazar direcciones válidas raras sería peor que dejar
 * que el servidor de correo dé el veredicto final.
 */
const CORREO_VALIDO = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** Formatea un monto guardado como número para el cuerpo del correo. */
const MONTO_FMT = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `2026-08-14` → `14/08/2026`. El correo lo lee una persona, no una máquina. */
function formatFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return dia && mes && anio ? `${dia}/${mes}/${anio}` : iso;
}

/** Divide una lista escrita a mano: admite coma, punto y coma o salto de línea. */
export function partirDirecciones(texto: string): string[] {
  return texto
    .split(/[,;\n]/)
    .map((direccion) => direccion.trim())
    .filter(Boolean);
}

export function esCorreoValido(direccion: string): boolean {
  return CORREO_VALIDO.test(direccion);
}

/** Convierte el cuerpo en párrafos HTML, respetando las líneas en blanco. */
export function cuerpoComoHtml(cuerpo: string): string {
  return cuerpo
    .split('\n')
    .map(
      (linea) =>
        `<p style="margin:0 0 8px">${linea.trim() ? escaparHtml(linea) : '&nbsp;'}</p>`,
    )
    .join('');
}

/** Todo lo que hace falta para componer los correos de un periodo. */
export interface DatosDelPeriodo {
  /** Etiqueta del periodo, tal y como se guarda en las columnas `periodo_*`. */
  readonly periodo: string;
  readonly registro: readonly RegistroInternaRow[];
  readonly prefactura: readonly AprobacionPrefacturaRow[];
  readonly facturas: ReadonlyMap<string, FacturaRow>;
  readonly destinatario: string;
  readonly copiasFijas: readonly string[];
  readonly proveedor: string;
  readonly asunto: string;
}

/** Contrato, líder aprobador y proyecto, indexados por colaborador. */
function indexarPrefactura(
  filas: readonly AprobacionPrefacturaRow[],
): Map<string, { contrato: string | null; lider: string | null; proyecto: string | null }> {
  const map = new Map<
    string,
    { contrato: string | null; lider: string | null; proyecto: string | null }
  >();
  for (const p of filas) {
    const id = (p.id_colaborador_prefactura ?? '').trim();
    if (id && !map.has(id)) {
      map.set(id, {
        contrato: p.numero_contrato_prefactura,
        lider: p.lider_aprobador_prefactura,
        proyecto: p.nombre_proyecto_prefactura,
      });
    }
  }
  return map;
}

/**
 * Compone un correo por factura del periodo, ordenados por secuencial.
 *
 * Las facturas anuladas quedan fuera: no se entregan. Los datos se toman de la
 * factura cuando existe y del registro interno como respaldo, porque la factura
 * es la fuente de verdad desde que se revisó, pero puede no estar sincronizada.
 */
export function componerCorreos(datos: DatosDelPeriodo): PlantillaCorreo[] {
  const mes = datos.periodo.split(' ')[0];
  const pref = indexarPrefactura(datos.prefactura);

  const grupos = new Map<string, RegistroInternaRow[]>();
  for (const r of datos.registro) {
    const sec = (r.secuencial_facturacion_interna ?? '').trim() || SIN_SECUENCIAL;
    const lista = grupos.get(sec) ?? [];
    lista.push(r);
    grupos.set(sec, lista);
  }

  const plantillas: PlantillaCorreo[] = [];
  for (const [sec, filas] of grupos) {
    const factura = datos.facturas.get(sec);
    if (factura?.estado_factura === 'anulada') continue;

    const cc = [
      ...new Set([
        ...filas
          .map((f) => (f.email_aprobador_facturacion_interna ?? '').trim())
          .filter(Boolean),
        ...datos.copiasFijas,
      ]),
    ];

    const pedido =
      factura?.pedido_compra_factura ??
      filas
        .map((f) => (f.pedido_compra_facturacion_interna ?? '').trim())
        .find((p) => p && p !== '0' && p.toUpperCase() !== 'NO RECIBIDO') ??
      '';
    const moneda =
      factura?.moneda_factura ?? filas[0]?.tipo_moneda_facturacion_interna ?? 'USD';
    const montoNum =
      factura?.monto_emitido_factura ?? factura?.monto_facturado_factura ?? null;
    const monto =
      montoNum !== null
        ? `${moneda} ${MONTO_FMT.format(montoNum)}`
        : (filas.find((f) => f.monto_emitido_factura_bee)?.monto_emitido_factura_bee ??
          '—');
    const fechaIso =
      factura?.fecha_emision_factura ??
      filas.find((f) => f.fecha_factura_bee)?.fecha_factura_bee ??
      '';
    const fecha = fechaIso ? formatFecha(fechaIso) : '—';
    const entidad =
      factura?.cliente_factura ??
      filas.find((f) => f.cliente_facturacion_interna)?.cliente_facturacion_interna ??
      '';

    let contrato: string | null = null;
    let validador: string | null = null;
    let proyecto: string | null = null;
    for (const f of filas) {
      const extra = pref.get((f.id_colaborados_facturacion_interna ?? '').trim());
      if (!contrato && extra?.contrato) contrato = extra.contrato;
      if (!validador && extra?.lider) validador = extra.lider;
      if (!proyecto && extra?.proyecto) proyecto = extra.proyecto;
    }

    const cuerpo: string[] = [
      `¡Buen Día! adjunto facturación para el mes de ${mes}`,
      `NUMERO DE FACTURA: ${sec}`,
      `PEDIDO DE COMPRA: ${pedido || 'NO RECIBIDO'}`,
      `MONTO: ${monto}`,
    ];
    if (contrato) cuerpo.push(`NÚMERO DE CONTRATO: ${contrato}`);
    cuerpo.push(`FECHA DE FACTURA FISICA: ${fecha}`);
    if (proyecto) cuerpo.push(`PROYECTO: ${proyecto}`);
    if (validador) cuerpo.push(`NOMBRE DE USUARIO VALIDADOR: ${validador}`);
    cuerpo.push(`ENTIDAD: ${entidad}`);
    cuerpo.push(`NOMBRE DEL PROVEEDOR: ${datos.proveedor}`);
    cuerpo.push('ITBMS: N/A');

    // Las URL vienen de Supabase Storage; el backend las descarga y las adjunta.
    const adjuntos: AdjuntoCorreo[] = [];
    const faltantes: string[] = [];
    const urlFactura = filas.find((f) => f.documento_factura_bee)?.documento_factura_bee;
    const urlPedido = filas.find((f) => f.documento_pedido_compra)?.documento_pedido_compra;

    if (urlFactura) adjuntos.push({ url: urlFactura, filename: `FACTURA ${sec}.pdf` });
    else faltantes.push('Factura BEE');

    if (urlPedido) {
      adjuntos.push({
        url: urlPedido,
        filename: `PEDIDO DE COMPRA ${pedido || sec}.pdf`,
      });
    } else if (pedido) {
      // Solo se echa en falta si la factura declara un pedido de compra: hay
      // facturas que legítimamente no lo tienen.
      faltantes.push('Pedido de compra');
    }

    plantillas.push({
      secuencial: sec,
      to: datos.destinatario,
      cc: cc.join(', '),
      subject: datos.asunto
        .replace('{secuencial}', sec)
        .replace('{periodo}', datos.periodo)
        .replace('{mes}', mes),
      cuerpo: cuerpo.join('\n'),
      adjuntos,
      faltantes,
      yaEnviada:
        factura?.estado_factura === 'enviada' || factura?.estado_factura === 'pagada',
    });
  }

  return plantillas.sort((a, b) =>
    a.secuencial.localeCompare(b.secuencial, undefined, { numeric: true }),
  );
}

/**
 * Aplica las ediciones del usuario sobre la plantilla generada y calcula lo que
 * la pantalla necesita saber: si está tocado, y si puede enviarse tal cual.
 */
export function prepararCorreo(
  plantilla: PlantillaCorreo,
  edicion: EdicionCorreo | undefined,
): CorreoPreparado {
  const to = edicion?.to ?? plantilla.to;
  const cc = edicion?.cc ?? plantilla.cc;
  const subject = edicion?.subject ?? plantilla.subject;
  const cuerpo = edicion?.cuerpo ?? plantilla.cuerpo;

  const destinatarios = partirDirecciones(to);
  const copias = partirDirecciones(cc);
  const invalidas = [...destinatarios, ...copias].filter(
    (direccion) => !esCorreoValido(direccion),
  );

  return {
    ...plantilla,
    to,
    cc,
    subject,
    cuerpo,
    destinatarios,
    copias,
    invalidas,
    editado:
      to !== plantilla.to ||
      cc !== plantilla.cc ||
      subject !== plantilla.subject ||
      cuerpo !== plantilla.cuerpo,
    listo: destinatarios.length > 0 && invalidas.length === 0 && subject.trim() !== '',
  };
}
