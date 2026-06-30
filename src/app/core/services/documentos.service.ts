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
    return this.guardarExcel(periodId, periodo, file, reemplazar, 'Registro Facturación Interna', async () => {
      const filas = await this.parsearRegistro(periodo, file);
      const { error } = await this.supabase.from('registro_facturacion_interna').insert(filas);
      return error;
    });
  }

  /** Persiste un pedido de compra (PDF · varios por periodo). */
  async guardarPedido(periodId: string, periodo: string, file: File): Promise<SaveResult> {
    const subido = await this.subirArchivo(periodId, 'Pedido Compra', file);
    if (!subido.ok) return subido;
    const error = await this.insertarDocumento(periodo, 'Pedido Compra', subido.url!);
    if (error) return { ok: false, error: this.friendly(error) };
    await this.loadPeriodo(periodo);
    return { ok: true };
  }

  /** Persiste las novedades del periodo (Excel · uno por periodo). */
  async guardarNovedades(periodId: string, periodo: string, file: File, reemplazar: boolean): Promise<SaveResult> {
    if (reemplazar) await this.eliminarTipo(periodo, 'Novedades Periodo');
    const subido = await this.subirArchivo(periodId, 'Novedades Periodo', file);
    if (!subido.ok) return subido;
    const error = await this.insertarDocumento(periodo, 'Novedades Periodo', subido.url!);
    if (error) return { ok: false, error: this.friendly(error) };
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

    const errDoc = await this.insertarDocumento(periodo, tipo, subido.url!);
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

  private async insertarDocumento(periodo: string, tipo: TipoDocumento, url: string): Promise<PostgrestError | null> {
    const { error } = await this.supabase.from('documentos_facturacion').insert({
      periodo_documento_facturacion: periodo,
      tipo_documento_facturacion: tipo,
      direccion_documento_facturacion: url,
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
