import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InvoiceStatus } from '@core/models';
import { BillingDataService } from '@core/services/billing-data.service';
import { PeriodStore } from '@core/services/period.store';
import { invoiceStatusPresentation } from '@core/utils/invoice-status.util';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Conciliación del periodo: pagos recibidos, retención y TRM (RF-CON). */
@Component({
  selector: 'app-conciliar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './conciliar.html',
})
export class Conciliar {
  private readonly billing = inject(BillingDataService);

  protected readonly period = inject(PeriodStore).current;
  protected readonly reconciliation = this.billing.reconciliation;
  protected readonly statusOf = invoiceStatusPresentation;

  /** Color de la barra de estado de cada fila, derivado del tono del estado. */
  protected readonly statusBar = (status: InvoiceStatus): string =>
    `var(--${invoiceStatusPresentation(status).tone})`;

  /** Formato compacto en millones de pesos: 15790000 → «$ 15,79 M». «—» si null. */
  protected readonly copShort = (value: number | null): string =>
    value === null ? '—' : `$ ${(value / 1_000_000).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
}
