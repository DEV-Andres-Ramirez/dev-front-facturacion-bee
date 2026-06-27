import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BillingDataService } from '@core/services/billing-data.service';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';

/** Auditoría y logs: bitácora inmutable de acciones del ciclo (RF-LOG). */
@Component({
  selector: 'app-auditoria',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent],
  templateUrl: './auditoria.html',
})
export class Auditoria {
  private readonly billing = inject(BillingDataService);

  protected readonly audit = this.billing.audit;
}
