import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BillingDataService } from '@core/services/billing-data.service';
import { docKindPresentation } from '@core/utils/doc-kind.util';
import { EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Entregar al cliente: compone y envía el correo de factura (RF-ENV). */
@Component({
  selector: 'app-entregar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './entregar.html',
})
export class Entregar {
  private readonly billing = inject(BillingDataService);

  protected readonly draft = this.billing.emailDraft;
  protected readonly docKind = docKindPresentation;
}
