import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BillingDataService } from '@core/services/billing-data.service';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Agregar talentos no contemplados al periodo de facturación (RF-TAL). */
@Component({
  selector: 'app-talentos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './talentos.html',
})
export class Talentos {
  private readonly billing = inject(BillingDataService);

  protected readonly pendingTalents = this.billing.pendingTalents;
}
