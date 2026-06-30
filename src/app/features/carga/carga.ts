import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentosService } from '@core/services/documentos.service';
import { PeriodStore } from '@core/services/period.store';
import { DocumentoFacturacion, TipoDocumento } from '@core/models';
import { IconComponent, IconName, ProcessStepperComponent } from '@shared/ui';
import { CargaDemo } from './carga-demo';

type SlotId = 'prefactura' | 'pedido' | 'registro' | 'novedades';

interface SlotConfig {
  readonly id: SlotId;
  readonly tipo: TipoDocumento;
  readonly title: string;
  readonly desc: string;
  readonly accept: string;
  readonly formats: string;
  readonly icon: IconName;
  readonly iconBg: string;
  readonly multi: boolean;
}

interface StagedFiles {
  readonly prefactura: File | null;
  readonly registro: File | null;
  readonly novedades: File | null;
  readonly pedidos: readonly File[];
}

const EMPTY_STAGED: StagedFiles = { prefactura: null, registro: null, novedades: null, pedidos: [] };
const MAX_MB = 5;
const DEMO_PERIOD = '2026-05';

/**
 * Carga de documentos. Para el periodo de demostración (Mayo 2026) delega en
 * `CargaDemo`. Para los periodos reales persiste los soportes: sube cada archivo
 * al Storage de Supabase, interpreta las plantillas Excel hacia sus tablas de
 * detalle y registra el enlace en `documentos_facturacion`. Al volver a un
 * periodo se recuperan los soportes ya guardados.
 */
@Component({
  selector: 'app-carga',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProcessStepperComponent, IconComponent, CargaDemo],
  templateUrl: './carga.html',
  styleUrl: './carga.css',
})
export class Carga {
  private readonly periodStore = inject(PeriodStore);
  protected readonly documentos = inject(DocumentosService);

  protected readonly period = this.periodStore.current;
  protected readonly isDemo = computed(() => this.periodStore.period() === DEMO_PERIOD);

  protected readonly dataLoading = this.documentos.loading;
  protected readonly loadError = this.documentos.error;
  protected readonly prefacturaRows = this.documentos.prefactura;
  protected readonly registroRows = this.documentos.registro;
  protected readonly pedidoDocs = this.documentos.pedidoDocs;

  protected readonly staged = signal<StagedFiles>(EMPTY_STAGED);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly errorSlot = signal<SlotId | null>(null);
  protected readonly errorMsg = signal('');
  protected readonly dragging = signal<SlotId | null>(null);
  protected readonly preview = signal<SlotId | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly confirmDelete = signal<DocumentoFacturacion | null>(null);
  protected readonly deleting = signal(false);

  protected readonly maxMb = MAX_MB;

  protected readonly slots: readonly SlotConfig[] = [
    { id: 'prefactura', tipo: 'Aprobación Prefactura', title: 'Aprobación de prefactura', desc: 'Excel del cliente · 1 por periodo', accept: '.xlsx', formats: 'XLSX', icon: 'file', iconBg: 'ic-primary', multi: false },
    { id: 'pedido', tipo: 'Pedido Compra', title: 'Pedidos de compra', desc: 'PDF del cliente · varios por periodo', accept: '.pdf', formats: 'PDF', icon: 'file', iconBg: 'ic-info', multi: true },
    { id: 'registro', tipo: 'Registro Facturación Interna', title: 'Registro de facturación interna', desc: 'Plantilla BEE · 1 por periodo', accept: '.xlsx', formats: 'XLSX', icon: 'records', iconBg: 'ic-ink', multi: false },
    { id: 'novedades', tipo: 'Novedades Periodo', title: 'Novedades del periodo', desc: 'Excel · 1 por periodo', accept: '.xlsx', formats: 'XLSX', icon: 'alert', iconBg: 'ic-warn', multi: false },
  ];

  // ── Métricas reales del periodo ────────────────────────────────────────────
  protected readonly lineasPrefactura = computed(() => this.prefacturaRows().length);
  protected readonly lineasRegistro = computed(() => this.registroRows().length);
  protected readonly talentos = computed(
    () => new Set(this.prefacturaRows().map((r) => r.id_colaborador_prefactura).filter(Boolean)).size,
  );
  protected readonly ordenes = computed(
    () => new Set(this.registroRows().map((r) => r.pedido_compra_facturacion_interna).filter(Boolean)).size,
  );
  protected readonly moneda = computed(
    () => this.registroRows().find((r) => r.tipo_moneda_facturacion_interna)?.tipo_moneda_facturacion_interna ?? '—',
  );
  protected readonly siguienteSecuencial = computed(() => {
    const nums = this.registroRows()
      .map((r) => Number((r.secuencial_facturacion_interna ?? '').replace(/\D/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0);
    return nums.length ? `BEE${Math.max(...nums) + 1}` : '—';
  });

  protected readonly loadedTipos = computed(
    () =>
      (this.isSaved('prefactura') ? 1 : 0) +
      (this.isSaved('pedido') ? 1 : 0) +
      (this.isSaved('registro') ? 1 : 0) +
      (this.isSaved('novedades') ? 1 : 0),
  );

  /** Solo se valida con la prefactura y el registro interno persistidos. */
  protected readonly canContinue = computed(() => this.isSaved('prefactura') && this.isSaved('registro'));

  protected readonly hasStagedAny = computed(() => {
    const s = this.staged();
    return !!(s.prefactura || s.registro || s.novedades || s.pedidos.length);
  });

  protected readonly stagedCount = computed(() => {
    const s = this.staged();
    return (s.prefactura ? 1 : 0) + (s.registro ? 1 : 0) + (s.novedades ? 1 : 0) + s.pedidos.length;
  });

  /** Tipos «uno por periodo» en staging que sobrescribirían lo ya guardado. */
  protected readonly tiposAReemplazar = computed(() => {
    const s = this.staged();
    const out: string[] = [];
    if (s.prefactura && this.isSaved('prefactura')) out.push('Aprobación de prefactura');
    if (s.registro && this.isSaved('registro')) out.push('Registro de facturación interna');
    if (s.novedades && this.isSaved('novedades')) out.push('Novedades del periodo');
    return out;
  });

  constructor() {
    // Carga (o limpia) el periodo seleccionado al entrar y al cambiar de periodo.
    effect(() => {
      const id = this.periodStore.period();
      const label = this.periodStore.current().label;
      this.staged.set(EMPTY_STAGED);
      this.preview.set(null);
      this.errorSlot.set(null);
      this.saveError.set('');
      if (id === DEMO_PERIOD) return;
      void this.documentos.loadPeriodo(label);
    });
  }

  // ── Estado por slot ─────────────────────────────────────────────────────────
  protected tipoDe(id: SlotId): TipoDocumento {
    return this.slots.find((s) => s.id === id)!.tipo;
  }

  protected isSaved(id: SlotId): boolean {
    if (id === 'pedido') return this.pedidoDocs().length > 0;
    return this.documentos.docDe(this.tipoDe(id)) !== undefined;
  }

  protected urlDe(id: SlotId): string | undefined {
    return this.documentos.docDe(this.tipoDe(id))?.direccion_documento_facturacion;
  }

  protected stagedSingle(id: SlotId): File | null {
    const s = this.staged();
    if (id === 'prefactura') return s.prefactura;
    if (id === 'registro') return s.registro;
    if (id === 'novedades') return s.novedades;
    return null;
  }

  protected hasStaged(id: SlotId): boolean {
    return id === 'pedido' ? this.staged().pedidos.length > 0 : this.stagedSingle(id) !== null;
  }

  protected stagedPedidos(): readonly File[] {
    return this.staged().pedidos;
  }

  /** Hay espacio para añadir: los pedidos siempre; los únicos si no hay staging. */
  protected puedeAgregar(id: SlotId): boolean {
    return id === 'pedido' ? true : this.stagedSingle(id) === null;
  }

  protected slotTitle(id: SlotId): string {
    return this.slots.find((s) => s.id === id)?.title ?? '';
  }

  protected resumenGuardado(id: SlotId): string {
    switch (id) {
      case 'prefactura':
        return `${this.lineasPrefactura()} líneas interpretadas`;
      case 'registro':
        return `${this.lineasRegistro()} líneas · siguiente ${this.siguienteSecuencial()}`;
      case 'pedido':
        return `${this.pedidoDocs().length} pedido(s) guardado(s)`;
      case 'novedades':
        return 'Archivo guardado en el periodo';
    }
  }

  protected nombreArchivo(url: string): string {
    const last = url.split('/').pop() ?? url;
    return decodeURIComponent(last.replace(/^\d+-/, ''));
  }

  protected pesoKb(file: File): string {
    return `${Math.max(1, Math.round(file.size / 1024))} KB`;
  }

  // ── Interacción de carga ─────────────────────────────────────────────────────
  protected onFileSelected(slot: SlotConfig, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) this.stage(slot, file);
  }

  protected onDrop(slot: SlotConfig, event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(null);
    const files = Array.from(event.dataTransfer?.files ?? []);
    for (const file of files) this.stage(slot, file);
  }

  protected onDragOver(id: SlotId, event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(id);
  }

  protected onDragLeave(): void {
    this.dragging.set(null);
  }

  protected removeStaged(id: SlotId, index = -1): void {
    this.staged.update((s) => {
      if (id === 'pedido') return { ...s, pedidos: s.pedidos.filter((_, i) => i !== index) };
      return { ...s, [id]: null };
    });
  }

  protected togglePreview(id: SlotId): void {
    this.preview.update((current) => (current === id ? null : id));
  }

  protected docDe(id: SlotId): DocumentoFacturacion | undefined {
    return this.documentos.docDe(this.tipoDe(id));
  }

  protected pedirEliminar(doc: DocumentoFacturacion | undefined): void {
    if (doc) this.confirmDelete.set(doc);
  }

  protected cancelarEliminar(): void {
    this.confirmDelete.set(null);
  }

  protected async confirmarEliminar(): Promise<void> {
    const doc = this.confirmDelete();
    if (!doc) return;
    this.deleting.set(true);
    this.saveError.set('');
    const result = await this.documentos.eliminarDocumento(doc);
    this.deleting.set(false);
    this.confirmDelete.set(null);
    if (!result.ok) this.saveError.set(result.error ?? 'No se pudo eliminar el archivo.');
  }

  private stage(slot: SlotConfig, file: File): void {
    if (file.size > MAX_MB * 1024 * 1024) {
      this.fail(slot.id, `El archivo supera el límite de ${MAX_MB} MB.`);
      return;
    }
    if (!this.extensionValida(slot, file)) {
      this.fail(slot.id, `Formato no válido. Se espera ${slot.formats}.`);
      return;
    }
    this.errorSlot.set(null);
    this.errorMsg.set('');
    this.staged.update((s) => {
      if (slot.id === 'pedido') return { ...s, pedidos: [...s.pedidos, file] };
      return { ...s, [slot.id]: file };
    });
  }

  private extensionValida(slot: SlotConfig, file: File): boolean {
    const exts = slot.accept.split(',').map((e) => e.trim().toLowerCase());
    const name = file.name.toLowerCase();
    return exts.some((e) => name.endsWith(e));
  }

  private fail(id: SlotId, message: string): void {
    this.errorSlot.set(id);
    this.errorMsg.set(message);
  }

  // ── Guardado ─────────────────────────────────────────────────────────────────
  protected guardar(): void {
    if (this.saving() || !this.hasStagedAny()) return;
    if (this.tiposAReemplazar().length > 0) {
      this.confirmOpen.set(true);
      return;
    }
    void this.persistir();
  }

  protected confirmarReemplazo(): void {
    void this.persistir();
  }

  protected cancelarReemplazo(): void {
    this.confirmOpen.set(false);
  }

  private async persistir(): Promise<void> {
    this.saving.set(true);
    this.saveError.set('');
    const s = this.staged();
    const id = this.periodStore.period();
    const label = this.periodStore.current().label;
    const errors: string[] = [];
    const next = {
      prefactura: s.prefactura,
      registro: s.registro,
      novedades: s.novedades,
      pedidos: [...s.pedidos] as File[],
    };

    if (s.prefactura) {
      const r = await this.documentos.guardarPrefactura(id, label, s.prefactura, this.isSaved('prefactura'));
      if (r.ok) next.prefactura = null;
      else errors.push(`Prefactura: ${r.error}`);
    }
    if (s.registro) {
      const r = await this.documentos.guardarRegistro(id, label, s.registro, this.isSaved('registro'));
      if (r.ok) next.registro = null;
      else errors.push(`Registro interno: ${r.error}`);
    }
    if (s.novedades) {
      const r = await this.documentos.guardarNovedades(id, label, s.novedades, this.isSaved('novedades'));
      if (r.ok) next.novedades = null;
      else errors.push(`Novedades: ${r.error}`);
    }
    if (s.pedidos.length) {
      const remaining: File[] = [];
      for (const file of s.pedidos) {
        const r = await this.documentos.guardarPedido(id, label, file);
        if (!r.ok) {
          remaining.push(file);
          errors.push(`Pedido ${file.name}: ${r.error}`);
        }
      }
      next.pedidos = remaining;
    }

    this.staged.set(next);
    this.confirmOpen.set(false);
    this.saving.set(false);
    if (errors.length) this.saveError.set(errors.join(' · '));
  }
}
