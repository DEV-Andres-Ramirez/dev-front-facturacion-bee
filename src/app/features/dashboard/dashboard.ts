import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingDataService } from '@core/services/billing-data.service';
import { invoiceStatusPresentation } from '@core/utils/invoice-status.util';
import { BadgeComponent, EmptyStateComponent, IconComponent, KpiCardComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Tablero de control e indicadores del periodo (RF-DSH). */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, KpiCardComponent, BadgeComponent, EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly billing = inject(BillingDataService);

  protected readonly dashboard = this.billing.dashboard;
  protected readonly invoices = this.billing.invoices;
  protected readonly isBlank = this.billing.isBlankPeriod;
  protected readonly statusOf = invoiceStatusPresentation;
}
