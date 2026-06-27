import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BillingDataService } from '@core/services/billing-data.service';
import { PeriodStore } from '@core/services/period.store';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Revisión y cotejo de las facturas emitidas por el outsourcing (RF-REV). */
@Component({
  selector: 'app-revisar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeComponent, EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './revisar.html',
})
export class Revisar {
  private readonly billing = inject(BillingDataService);
  protected readonly period = inject(PeriodStore).current;

  protected readonly emittedInvoices = this.billing.emittedInvoices;
  protected readonly reviewChecks = this.billing.reviewChecks;
}
