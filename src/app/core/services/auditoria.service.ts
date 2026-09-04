import { Injectable, computed, inject, signal } from '@angular/core';
import type { PostgrestError } from '@supabase/supabase-js';
import {
  AuditoriaRow,
  FiltroAuditoria,
  NuevoEventoAuditoria,
  OpcionFiltro,
  ResumenAuditoria,
} from '../models';
import { descargarCsv } from '../utils/csv.util';
import { formatFechaHora } from '../utils/fecha.util';
import { AuthService } from './auth.service';
import { PeriodStore } from './period.store';
import { SupabaseService } from './supabase.service';

/** Eventos por página en la bitácora. */
export const EVENTOS_POR_PAGINA = 50;

/** Tope de la exportación: evita traerse una bitácora entera sin querer. */
const MAX_EXPORTACION = 1000;

/** Filtro inicial: sin restricciones, primera página. */
export const FILTRO_VACIO: FiltroAuditoria = {
  desde: null,
  hasta: null,
  correo: null,
  modulo: null,
  accion: null,
  resultado: null,
  busqueda: '',
  pagina: 0,
};

/**
 * Bitácora de auditoría (RF-LOG). Escribe y lee la tabla `auditoria` de
 * Supabase a través de funciones `SECURITY DEFINER`: la tabla no es accesible
 * directamente, de modo que un evento registrado no se puede alterar ni borrar.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly periodStore = inject(PeriodStore);

  private readonly _rows = signal<AuditoriaRow[]>([]);
  private readonly _resumen = signal<ResumenAuditoria | null>(null);
  private readonly _opciones = signal<OpcionFiltro[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');

  readonly rows = this._rows.asReadonly();
  readonly resumen = this._resumen.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Total de eventos que cumplen el filtro, no solo los de la página. */
  readonly total = computed(() => this._rows()[0]?.total_filas ?? 0);
  readonly paginas = computed(() => Math.ceil(this.total() / EVENTOS_POR_PAGINA));

  readonly usuariosDisponibles = computed(() =>
    this._opciones().filter((o) => o.tipo === 'usuario'),
  );
  readonly modulosDisponibles = computed(() => this._opciones().filter((o) => o.tipo === 'modulo'));
  readonly accionesDisponibles = computed(() =>
    this._opciones().filter((o) => o.tipo === 'accion'),
  );

  // ── Escritura ───────────────────────────────────────────────────────────────

  /**
   * Registra un evento. Quien llama solo indica QUÉ pasó: el usuario, el rol y
   * el periodo los añade este servicio, y la fecha, la IP y el navegador los
   * añade la base de datos.
   *
   * Es deliberadamente *fire-and-forget*: auditar nunca debe bloquear ni romper
   * la acción del usuario, y menos aún dentro de un bucle de envío de correos.
   * Un fallo al registrar se queda en la consola, no interrumpe nada.
   */
  registrar(evento: NuevoEventoAuditoria): void {
    const usuario = this.auth.user();
    const nombre = evento.actor?.nombre ?? usuario?.name ?? 'Desconocido';
    const correo = evento.actor?.correo ?? usuario?.email ?? 'anonimo@beeconsultoria.com';

    void this.supabase
      .rpc('fn_registrar_auditoria', {
        p_nombre_usuario: nombre,
        p_correo_usuario: correo,
        p_modulo: evento.modulo,
        p_accion: evento.accion,
        p_observacion: evento.observacion,
        // Cuando se registra un actor explícito no hay sesión (login fallido) o
        // la sesión ya no corresponde: no se estampa el id de quien mira.
        p_id_usuario: evento.actor ? null : (usuario?.id ?? null),
        p_rol_usuario: evento.actor ? 'ANONIMO' : (usuario?.role ?? 'ANONIMO'),
        p_resultado: evento.resultado ?? 'exito',
        p_periodo: this.periodStore.label(),
        p_entidad: evento.entidad ?? null,
        p_referencia: evento.referencia ?? null,
        p_detalle: evento.detalle ?? null,
      })
      .then(({ error }) => {
        if (error) console.error('No se pudo registrar el evento de auditoría', error);
      });
  }

  // ── Lectura ─────────────────────────────────────────────────────────────────

  /** Carga la página de eventos y las métricas que corresponden al filtro. */
  async load(filtro: FiltroAuditoria): Promise<void> {
    this._loading.set(true);
    this._error.set('');

    const [listado, resumen] = await Promise.all([
      this.supabase.rpc('fn_listar_auditoria', {
        ...this.parametros(filtro),
        p_limite: EVENTOS_POR_PAGINA,
        p_desplazamiento: filtro.pagina * EVENTOS_POR_PAGINA,
      }),
      this.supabase.rpc('fn_resumen_auditoria', this.parametros(filtro)),
    ]);

    if (listado.error || resumen.error) {
      this._error.set('No se pudo cargar la bitácora de auditoría.');
    }
    this._rows.set((listado.data ?? []) as AuditoriaRow[]);
    this._resumen.set(((resumen.data ?? [])[0] as ResumenAuditoria) ?? null);
    this._loading.set(false);
  }

  /**
   * Carga los valores realmente presentes en la bitácora para los desplegables.
   * Se consultan aparte del listado porque no dependen del filtro activo: si lo
   * hicieran, filtrar por un usuario dejaría el desplegable con una sola opción
   * y sería imposible cambiar de usuario sin limpiar el filtro.
   */
  async cargarOpciones(): Promise<void> {
    const { data, error } = await this.supabase.rpc('fn_filtros_auditoria');
    if (!error) this._opciones.set((data ?? []) as OpcionFiltro[]);
  }

  /**
   * Descarga en CSV todo lo que cumple el filtro, no solo la página visible:
   * exportar lo que se ve en pantalla daría una bitácora incompleta sin avisar.
   */
  async exportarCsv(filtro: FiltroAuditoria): Promise<string> {
    const { data, error } = await this.supabase.rpc('fn_listar_auditoria', {
      ...this.parametros(filtro),
      p_limite: MAX_EXPORTACION,
      p_desplazamiento: 0,
    });

    if (error) return 'No se pudo exportar la bitácora.';

    const filas = (data ?? []) as AuditoriaRow[];
    if (filas.length === 0) return 'No hay eventos que exportar con este filtro.';

    descargarCsv(
      `auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Fecha',
        'Usuario',
        'Correo',
        'Rol',
        'Módulo',
        'Acción',
        'Resultado',
        'Observación',
        'Periodo',
        'Entidad',
        'Referencia',
        'IP',
        'Navegador',
      ],
      filas.map((f) => [
        formatFechaHora(f.fecha_auditoria),
        f.nombre_usuario_auditoria,
        f.correo_usuario_auditoria,
        f.rol_usuario_auditoria,
        f.modulo_auditoria,
        f.accion_auditoria,
        f.resultado_auditoria,
        f.observacion_auditoria,
        f.periodo_auditoria,
        f.entidad_auditoria,
        f.referencia_auditoria,
        f.ip_auditoria,
        f.agente_auditoria,
      ]),
    );

    return filas.length === MAX_EXPORTACION
      ? `Se exportaron los ${MAX_EXPORTACION} eventos más recientes del filtro.`
      : '';
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  /** Traduce el filtro de la pantalla a los parámetros de las funciones. */
  private parametros(filtro: FiltroAuditoria): Record<string, string | null> {
    return {
      p_desde: filtro.desde,
      p_hasta: filtro.hasta,
      p_correo: filtro.correo,
      p_modulo: filtro.modulo,
      p_accion: filtro.accion,
      p_resultado: filtro.resultado,
      // La bitácora es transversal: no se acota al periodo activo, porque la
      // mayoría de las consultas de auditoría cruzan periodos.
      p_periodo: null,
      p_busqueda: filtro.busqueda.trim() || null,
    };
  }

  private friendly(error: PostgrestError): string {
    return error.message || 'No se pudo consultar la bitácora. Intenta de nuevo.';
  }
}
