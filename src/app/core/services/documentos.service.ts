import { Injectable, computed, inject, signal } from '@angular/core';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  AprobacionPrefacturaInsert,
  AprobacionPrefacturaRow,
  DocumentoFacturacion,
  RegistroInternaInsert,
  RegistroInternaRow,
  TipoDocumento,
} from '../models';
import { celdaATexto, filaVacia, leerPrimeraHoja, montoDosDecimales } from '../utils/xlsx.util';
import { SupabaseService } from './supabase.service';

/** Resultado de una operación de persistencia. */
export interface SaveResult {
  readonly ok: boolean;
  readonly error?: string;
}

const BUCKET = 'facturacion-bee';

/** Slug de carpeta en Storage por tipo de documento. */
const TIPO_SLUG: Record<TipoDocumento, string> = {
  'Aprobación Prefactura': 'aprobacion-prefactura',
  'Registro Facturación Interna': 'registro-interna',
  'Pedido Compra': 'pedido-compra',
  'Novedades Periodo': 'novedades',
  'Factura BEE': 'factura-bee',
  'Consolidado Facturacion BEE': 'consolidado',
};

/**
 * Persistencia de los soportes del periodo (Módulo 2): sube los archivos al
 * Storage de Supabase (bucket `facturacion-bee`), guarda el enlace en
 * `documentos_facturacion` e interpreta las plantillas Excel hacia sus tablas
 * de detalle (`aprobacion_prefactura`, `registro_facturacion_interna`).
 */
@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly supabase = inject(SupabaseService).client;

  private readonly _docs = signal<DocumentoFacturacion[]>([]);
  private readonly _prefactura = signal<AprobacionPrefacturaRow[]>([]);
  private readonly _registro = signal<RegistroInternaRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly docs = this._docs.asReadonly();
  readonly prefactura = this._prefactura.asReadonly();
  readonly registro = this._registro.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Documentos del tipo indicado en el periodo cargado. */
  readonly pedidoDocs = computed(() =>
    this._docs().filter((d) => d.tipo_documento_facturacion === 'Pedido Compra'),
  );

  docDe(tipo: TipoDocumento): DocumentoFacturacion | undefined {
    return this._docs().find((d) => d.tipo_documento_facturacion === tipo);
  }

  /** Carga los soportes y el detalle ya persistidos de un periodo. */
  async loadPeriodo(periodo: string): Promise<void> {
    this._loading.set(true);
    this._error.set('');
    const [docs, pref, reg] = await Promise.all([
      this.supabase
        .from('documentos_facturacion')
        .select('*')
        .eq('periodo_documento_facturacion', periodo)
        .order('id_documento_facturacion', { ascending: true }),
      this.supabase
        .from('aprobacion_prefactura')
        .select('*')
        .eq('periodo_prefactura', periodo)
        .order('id_prefactura', { ascending: true }),
      this.supabase
        .from('registro_facturacion_interna')
        .select('*')
        .eq('periodo_facturacion_interna', periodo)
        .order('id_facturacion_interna', { ascending: true }),
    ]);

    if (docs.error || pref.error || reg.error) {
      this._error.set('No se pudieron cargar los documentos del periodo.');
    }
    this._docs.set((docs.data ?? []) as DocumentoFacturacion[]);
    this._prefactura.set((pref.data ?? []) as AprobacionPrefacturaRow[]);
    this._registro.set((reg.data ?? []) as RegistroInternaRow[]);
    this._loading.set(false);
  }

  /** Sube y persiste la prefactura aprobada (un Excel por periodo). */
  async guardarPrefactura(periodId: string, periodo: string, file: File, reemplazar: boolean): Promise<SaveResult> {
    return this.guardarExcel(periodId, periodo, file, reemplazar, 'Aprobación Prefactura', async () => {
      const filas = await this.parsearPrefactura(periodo, file);
      const { error } = await this.supabase.from('aprobacion_prefactura').insert(filas);
      return error;
    });
  }

  /** Sube y persiste el registro de facturación interna (un Excel por periodo). */
  async guardarRegistro(periodId: string, periodo: string, file: File, reemplazar: boolean): Promise<SaveResult> {
    const res = await this.guardarExcel(periodId, periodo, file, reemplazar, 'Registro Facturación Interna', async () => {
      const filas = await this.parsearRegistro(periodo, file);
      const { error } = await this.supabase.from('registro_facturacion_interna').insert(filas);
      return error;
    });
    if (res.ok) {
      await this.relacionarPedidos(periodo);
      await this.loadPeriodo(periodo);
    }
    return res;
  }

  /** Persiste un pedido de compra (PDF · varios por periodo) y lo relaciona. */
  async guardarPedido(periodId: string, periodo: string, file: File): Promise<SaveResult> {
    const subido = await this.subirArchivo(periodId, 'Pedido Compra', file);
    if (!subido.ok) return subido;
    const nombre = this.nombreSinExtension(file.name);
    const error = await this.insertarDocumento(periodo, 'Pedido Compra', subido.url!, nombre);
    if (error) return { ok: false, error: this.friendly(error) };
    // Relaciona el pedido con los registros cuyo pedido_compra coincide con el nombre.
    await this.supabase
      .from('registro_facturacion_interna')
      .update({ documento_pedido_compra: subido.url })
      .eq('periodo_facturacion_interna', periodo)
      .eq('pedido_compra_facturacion_interna', nombre);
    await this.loadPeriodo(periodo);
    return { ok: true };
  }

  /** Persiste las novedades del periodo (Excel · uno por periodo). */
  async guardarNovedades(periodId: string, periodo: string, file: File, reemplazar: boolean): Promise<SaveResult> {
    if (reemplazar) await this.eliminarTipo(periodo, 'Novedades Periodo');
    const subido = await this.subirArchivo(periodId, 'Novedades Periodo', file);
    if (!subido.ok) return subido;
    const error = await this.insertarDocumento(periodo, 'Novedades Periodo', subido.url!, this.nombreSinExtension(file.name));
    if (error) return { ok: false, error: this.friendly(error) };
    await this.loadPeriodo(periodo);
    return { ok: true };
  }

  // ── Factura BEE y datos de emisión (módulo Revisar) ─────────────────────────

  /** Sube la Factura BEE de una factura (secuencial) y la enlaza a sus registros. */
  async guardarFacturaBee(periodId: string, periodo: string, secuencial: string, file: File): Promise<SaveResult> {
    const actual = this._registro().find(
      (r) => (r.secuencial_facturacion_interna ?? '').trim() === secuencial && r.documento_factura_bee,
    )?.documento_factura_bee;
    if (actual) await this.eliminarArchivoPorUrl(actual); // reemplazo: borra el anterior

    const subido = await this.subirArchivo(periodId, 'Factura BEE', file);
    if (!subido.ok) return subido;
    const errDoc = await this.insertarDocumento(periodo, 'Factura BEE', subido.url!, this.nombreSinExtension(file.name));
    if (errDoc) return { ok: false, error: this.friendly(errDoc) };

    const { error } = await this.supabase
      .from('registro_facturacion_interna')
      .update({ documento_factura_bee: subido.url })
      .eq('periodo_facturacion_interna', periodo)
      .eq('secuencial_facturacion_interna', secuencial);
    if (error) return { ok: false, error: this.friendly(error) };
    return { ok: true };
  }

  /** Guarda el monto emitido (global) para todos los registros de una factura. */
  async guardarMontoEmitido(periodo: string, secuencial: string, monto: string): Promise<SaveResult> {
    const { error } = await this.supabase
      .from('registro_facturacion_interna')
      .update({ monto_emitido_factura_bee: monto })
      .eq('periodo_facturacion_interna', periodo)
      .eq('secuencial_facturacion_interna', secuencial);
    return error ? { ok: false, error: this.friendly(error) } : { ok: true };
  }

  /** Guarda la fecha de la factura física para todos los registros de una factura. */
  async guardarFechaFactura(periodo: string, secuencial: string, fecha: string): Promise<SaveResult> {
    const { error } = await this.supabase
      .from('registro_facturacion_interna')
      .update({ fecha_factura_bee: fecha })
      .eq('periodo_facturacion_interna', periodo)
      .eq('secuencial_facturacion_interna', secuencial);
    return error ? { ok: false, error: this.friendly(error) } : { ok: true };
  }

  /** Elimina un documento puntual (Storage + índice) y limpia sus referencias. */
  async eliminarDocumento(doc: DocumentoFacturacion): Promise<SaveResult> {
    const url = doc.direccion_documento_facturacion;
    const periodo = doc.periodo_documento_facturacion;
    const path = this.pathDesdeUrl(url);
    if (path) await this.supabase.storage.from(BUCKET).remove([path]);

    const { error } = await this.supabase
      .from('documentos_facturacion')
      .delete()
      .eq('id_documento_facturacion', doc.id_documento_facturacion);
    if (error) return { ok: false, error: this.friendly(error) };

    if (doc.tipo_documento_facturacion === 'Aprobación Prefactura') {
      await this.supabase.from('aprobacion_prefactura').delete().eq('periodo_prefactura', periodo);
    } else if (doc.tipo_documento_facturacion === 'Registro Facturación Interna') {
      await this.supabase.from('registro_facturacion_interna').delete().eq('periodo_facturacion_interna', periodo);
    }
    // Limpia referencias al archivo borrado en el registro interno.
    await this.supabase.from('registro_facturacion_interna').update({ documento_pedido_compra: null })
      .eq('periodo_facturacion_interna', periodo).eq('documento_pedido_compra', url);
    await this.supabase.from('registro_facturacion_interna').update({ documento_factura_bee: null })
      .eq('periodo_facturacion_interna', periodo).eq('documento_factura_bee', url);

    await this.loadPeriodo(periodo);
    return { ok: true };
  }

  // ── Internos ───────────────────────────────────────────────────────────────

  /** Flujo común de los Excel con tabla de detalle (prefactura / registro). */
  private async guardarExcel(
    periodId: string,
    periodo: string,
    file: File,
    reemplazar: boolean,
    tipo: TipoDocumento,
    insertarDetalle: () => Promise<PostgrestError | null>,
  ): Promise<SaveResult> {
    if (reemplazar) await this.eliminarTipo(periodo, tipo);
    const subido = await this.subirArchivo(periodId, tipo, file);
    if (!subido.ok) return subido;

    const errDetalle = await insertarDetalle();
    if (errDetalle) return { ok: false, error: this.friendly(errDetalle) };

    const errDoc = await this.insertarDocumento(periodo, tipo, subido.url!, this.nombreSinExtension(file.name));
    if (errDoc) return { ok: false, error: this.friendly(errDoc) };

    await this.loadPeriodo(periodo);
    return { ok: true };
  }

  private async subirArchivo(
    periodId: string,
    tipo: TipoDocumento,
    file: File,
  ): Promise<SaveResult & { url?: string }> {
    const path = `${periodId}/${TIPO_SLUG[tipo]}/${Date.now()}-${this.nombreSeguro(file.name)}`;
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) return { ok: false, error: 'No se pudo subir el archivo al almacenamiento.' };
    const { data } = this.supabase.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  }

  private async insertarDocumento(
    periodo: string,
    tipo: TipoDocumento,
    url: string,
    nombre: string,
  ): Promise<PostgrestError | null> {
    const { error } = await this.supabase.from('documentos_facturacion').insert({
      periodo_documento_facturacion: periodo,
      tipo_documento_facturacion: tipo,
      direccion_documento_facturacion: url,
      nombre_documento_facturacion: nombre,
    });
    return error;
  }

  /** Borra archivos del Storage, el índice y el detalle de un tipo en el periodo. */
  private async eliminarTipo(periodo: string, tipo: TipoDocumento): Promise<void> {
    const { data } = await this.supabase
      .from('documentos_facturacion')
      .select('*')
      .eq('periodo_documento_facturacion', periodo)
      .eq('tipo_documento_facturacion', tipo);

    const paths = ((data ?? []) as DocumentoFacturacion[])
      .map((d) => this.pathDesdeUrl(d.direccion_documento_facturacion))
      .filter((p): p is string => p !== null);
    if (paths.length) await this.supabase.storage.from(BUCKET).remove(paths);

    await this.supabase
      .from('documentos_facturacion')
      .delete()
      .eq('periodo_documento_facturacion', periodo)
      .eq('tipo_documento_facturacion', tipo);

    if (tipo === 'Aprobación Prefactura') {
      await this.supabase.from('aprobacion_prefactura').delete().eq('periodo_prefactura', periodo);
    } else if (tipo === 'Registro Facturación Interna') {
      await this.supabase.from('registro_facturacion_interna').delete().eq('periodo_facturacion_interna', periodo);
    }
  }

  private async parsearPrefactura(periodo: string, file: File): Promise<AprobacionPrefacturaInsert[]> {
    const filas = await leerPrimeraHoja(file);
    return filas
      .slice(1)
      .filter((r) => !filaVacia(r))
      .map((r) => ({
        periodo_prefactura: periodo,
        numero_contrato_prefactura: celdaATexto(r[0]),
        etiqueta_aliado_prefactura: celdaATexto(r[1]),
        año_prefactura: celdaATexto(r[2]),
        mes_prefactura: celdaATexto(r[3]),
        nombre_colaborador_prefactura: celdaATexto(r[4]),
        id_colaborador_prefactura: celdaATexto(r[5]),
        rol_mop_prefactura: celdaATexto(r[6]),
        tipo_compra_prefactura: celdaATexto(r[7]),
        entega_valor_prefactura: celdaATexto(r[8]),
        tarifa_prefactura: celdaATexto(r[9]),
        desglose_novedad_prefactura: celdaATexto(r[10]),
        hora_novedad_prefactura: celdaATexto(r[11]),
        tarifa_hora_prefactura: celdaATexto(r[12]),
        monto_novedad_prefactura: celdaATexto(r[13]),
        monto_facturar_prefactura: montoDosDecimales(r[14]),
        comentarios_proveedor_prefactura: celdaATexto(r[15]),
        comentarios_capacidad_prefactura: celdaATexto(r[16]),
        id_proyecto_prefactura: celdaATexto(r[17]),
        nombre_proyecto_prefactura: celdaATexto(r[18]),
        quien_paga_prefactura: celdaATexto(r[19]),
        radicar_factura_prefactura: celdaATexto(r[20]),
        lider_aprobador_prefactura: celdaATexto(r[21]),
        trabajo_compartido_prefactura: celdaATexto(r[22]),
        aprobado_prefactura: celdaATexto(r[23]),
        comentarios_lider_prefactura: celdaATexto(r[24]),
      }));
  }

  private async parsearRegistro(periodo: string, file: File): Promise<RegistroInternaInsert[]> {
    const filas = await leerPrimeraHoja(file);
    return filas
      .slice(1)
      .filter((r) => !filaVacia(r))
      .map((r) => ({
        periodo_facturacion_interna: periodo,
        pedido_compra_facturacion_interna: celdaATexto(r[0]),
        secuencial_facturacion_interna: celdaATexto(r[1]),
        mes_facturacion_interna: celdaATexto(r[2]),
        cliente_facturacion_interna: celdaATexto(r[3]),
        id_colaborados_facturacion_interna: celdaATexto(r[4]),
        descripcion_facturacion_interna: celdaATexto(r[5]),
        tipo_moneda_facturacion_interna: celdaATexto(r[6]),
        tarifa_facturacion_interna: celdaATexto(r[7]),
        hora_novedad_facturacion_interna: celdaATexto(r[8]),
        tarifa_hora_facturacion_interna: celdaATexto(r[9]),
        monto_facturar_facturacion_interna: montoDosDecimales(r[10]),
        valor_letras_facturacion_interna: celdaATexto(r[11]),
        email_aprobador_facturacion_interna: celdaATexto(r[12]),
      }));
  }

  /** Relaciona cada Pedido Compra cargado con los registros que lo referencian. */
  private async relacionarPedidos(periodo: string): Promise<void> {
    const pedidos = this._docs().filter(
      (d) => d.tipo_documento_facturacion === 'Pedido Compra' && d.nombre_documento_facturacion,
    );
    for (const pedido of pedidos) {
      await this.supabase
        .from('registro_facturacion_interna')
        .update({ documento_pedido_compra: pedido.direccion_documento_facturacion })
        .eq('periodo_facturacion_interna', periodo)
        .eq('pedido_compra_facturacion_interna', pedido.nombre_documento_facturacion!);
    }
  }

  /** Borra del Storage y del índice un documento identificado por su URL pública. */
  private async eliminarArchivoPorUrl(url: string): Promise<void> {
    const path = this.pathDesdeUrl(url);
    if (path) await this.supabase.storage.from(BUCKET).remove([path]);
    await this.supabase.from('documentos_facturacion').delete().eq('direccion_documento_facturacion', url);
  }

  /** Nombre original del archivo sin la extensión (p. ej. `PCC-2026-00745.pdf` → `PCC-2026-00745`). */
  private nombreSinExtension(name: string): string {
    const base = name.split('/').pop() ?? name;
    return base.replace(/\.[^.]+$/, '').trim();
  }

  private nombreSeguro(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_');
  }

  /** Extrae la ruta interna del bucket desde una URL pública de Storage. */
  private pathDesdeUrl(url: string): string | null {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  private friendly(error: PostgrestError): string {
    return error.message || 'No se pudo guardar el documento. Intenta de nuevo.';
  }
}
