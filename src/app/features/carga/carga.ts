import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingDataService, UploadSlot } from '@core/services/billing-data.service';
import { PeriodStore } from '@core/services/period.store';
import { docKindPresentation } from '@core/utils/doc-kind.util';
import { IconComponent, IconName, ProcessStepperComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

interface SlotConfig {
  readonly id: UploadSlot;
  readonly title: string;
  readonly desc: string;
  readonly accept: string;
  readonly formats: string;
  readonly icon: IconName;
  readonly iconBg: string;
  readonly multi: boolean;
}

const MAX_MB = 5;

/**
 * Carga de documentos: 4 espacios de carga, uno por tipo de soporte del periodo
 * (RF-VAL-01 · Cambios.txt §4). Cada soporte se importa con previsualización de
 * solo lectura. La prefactura aprobada es el origen del ciclo: al cargarla se
 * interpreta el periodo completo.
 */
@Component({
  selector: 'app-carga',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProcessStepperComponent, IconComponent, UsdPipe],
  templateUrl: './carga.html',
  styleUrl: './carga.css',
})
export class Carga implements OnDestroy {
  private readonly billing = inject(BillingDataService);
  private readonly periodStore = inject(PeriodStore);

  protected readonly period = this.periodStore.current;
  protected readonly loading = this.billing.loading;
  protected readonly prefactura = this.billing.prefactura;
  protected readonly uploads = this.billing.uploadsForCurrent;
  protected readonly docKind = docKindPresentation;

  protected readonly reading = signal<UploadSlot | null>(null);
  protected readonly progressLabel = signal('');
  protected readonly dragging = signal<UploadSlot | null>(null);
  protected readonly errorSlot = signal<UploadSlot | null>(null);
  protected readonly errorMsg = signal('');
  protected readonly preview = signal<UploadSlot | null>(null);

  protected readonly maxMb = MAX_MB;
  protected readonly lastInvoice = 'BEE699';
  protected readonly nextInvoice = 'BEE700';

  protected readonly slots: readonly SlotConfig[] = [
    { id: 'prefactura', title: 'Aprobación de prefactura', desc: 'Excel del cliente · 1 por periodo', accept: '.xlsx', formats: 'XLSX', icon: 'file', iconBg: 'ic-primary', multi: false },
    { id: 'pedido', title: 'Pedidos de compra', desc: 'PDF del cliente · varios por periodo', accept: '.pdf', formats: 'PDF', icon: 'file', iconBg: 'ic-info', multi: true },
    { id: 'registro', title: 'Registro de facturación interna', desc: 'Plantilla BEE · 1 por periodo', accept: '.xlsm,.xlsx', formats: 'XLSM', icon: 'records', iconBg: 'ic-ink', multi: false },
    { id: 'novedades', title: 'Novedades del periodo', desc: 'Excel · 1 por periodo', accept: '.xlsx', formats: 'XLSX', icon: 'alert', iconBg: 'ic-warn', multi: false },
  ];

  /** Vista previa (solo lectura) · registro interno real de Abril (BEE700–BEE705). */
  protected readonly registroPreview = [
    { sec: 'BEE700', pedido: 'NO RECIBIDO', codigo: 'C-0421', nombre: 'Alejandra Muñoz', monto: 1252.77 },
    { sec: 'BEE701', pedido: 'NO RECIBIDO', codigo: 'C-0388', nombre: 'Nicolás Gutiérrez Arcila', monto: 780.67 },
    { sec: 'BEE702', pedido: 'PCC-2026-01521', codigo: 'C-0402', nombre: 'Pedro Pérez', monto: 838.08 },
    { sec: 'BEE702', pedido: 'PCC-2026-01521', codigo: 'C-0455', nombre: 'Pablo Franco', monto: 1200 },
    { sec: 'BEE703', pedido: 'NO RECIBIDO', codigo: 'C-0410', nombre: 'Sara Castro', monto: 657.12 },
    { sec: 'BEE704', pedido: 'NO RECIBIDO', codigo: 'C-0377', nombre: 'Fernando Hurtado', monto: 1003.87 },
    { sec: 'BEE705', pedido: 'PCC-2026-01534', codigo: 'C-0461', nombre: 'Diego Ramírez', monto: 1003.87 },
  ];

  protected readonly pedidoPreview = [
    { oc: 'PCC-2026-01521', talents: 'Pedro Pérez · Pablo Franco', proyecto: 'Interoperabilidad Yappy / BLE' },
    { oc: 'PCC-2026-01534', talents: 'Diego Ramírez', proyecto: 'EVC Ciclo de Crédito' },
  ];

  protected readonly novedadesPreview = [
    { talento: 'Diego Ramírez', tipo: 'Nuevo ingreso', detalle: 'No contemplado en prefactura · EVC Ciclo de Crédito' },
    { talento: 'Nicolás Gutiérrez', tipo: 'Ajuste de monto', detalle: 'Diferencia de tarifa hora detectada en el cotejo' },
  ];

  /** Solo se puede validar con la prefactura y el registro interno cargados. */
  protected readonly canContinue = computed(() => this.uploads().prefactura && this.uploads().registro);

  /** Cuántos de los 4 tipos de soporte se han cargado. */
  protected readonly loadedCount = computed(() => {
    const state = this.uploads();
    return (
      (state.prefactura ? 1 : 0) +
      (state.pedidos > 0 ? 1 : 0) +
      (state.registro ? 1 : 0) +
      (state.novedades ? 1 : 0)
    );
  });

  protected slotLabel(id: UploadSlot): string {
    return this.slots.find((slot) => slot.id === id)?.title ?? '';
  }

  private readonly steps = [
    'Leyendo el archivo…',
    'Validando estructura de la plantilla…',
    'Interpretando los registros…',
  ];
  private timers: ReturnType<typeof setTimeout>[] = [];

  protected isDone(slot: UploadSlot): boolean {
    const state = this.uploads();
    return slot === 'pedido' ? state.pedidos > 0 : state[slot];
  }

  protected summary(slot: UploadSlot): string {
    switch (slot) {
      case 'prefactura':
        return `${this.prefactura().length} líneas · contrato BI-VSC-15479`;
      case 'pedido':
        return `${this.uploads().pedidos} pedido(s) · PCC-2026-01521 · 01534`;
      case 'registro':
        return `Última ${this.lastInvoice} · siguiente ${this.nextInvoice}`;
      case 'novedades':
        return '1 novedad · talento por incorporar';
    }
  }

  protected onFileSelected(slot: UploadSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(slot, file.name, file.size);
    input.value = '';
  }

  protected onDrop(slot: UploadSlot, event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(null);
    const file = event.dataTransfer?.files?.[0];
    this.handleFile(slot, file?.name ?? 'archivo.xlsx', file?.size ?? 0);
  }

  protected onDragOver(slot: UploadSlot, event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(slot);
  }

  protected onDragLeave(): void {
    this.dragging.set(null);
  }

  protected togglePreview(slot: UploadSlot): void {
    this.preview.update((current) => (current === slot ? null : slot));
  }

  private handleFile(slot: UploadSlot, name: string, size: number): void {
    if (size > MAX_MB * 1024 * 1024) {
      this.errorSlot.set(slot);
      this.errorMsg.set(`El archivo supera el límite de ${MAX_MB} MB.`);
      return;
    }
    this.errorSlot.set(null);
    this.errorMsg.set('');
    this.startImport(slot);
  }

  /** Simula la lectura del archivo y registra la carga al finalizar. */
  private startImport(slot: UploadSlot): void {
    this.clearTimers();
    this.reading.set(slot);
    this.progressLabel.set(this.steps[0]);
    this.timers.push(setTimeout(() => this.progressLabel.set(this.steps[1]), 600));
    this.timers.push(setTimeout(() => this.progressLabel.set(this.steps[2]), 1300));
    this.timers.push(
      setTimeout(() => {
        this.billing.markUpload(this.periodStore.period(), slot);
        this.reading.set(null);
        this.preview.set(slot);
      }, 2000),
    );
  }

  private clearTimers(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }
}
