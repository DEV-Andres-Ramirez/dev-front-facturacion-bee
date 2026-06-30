import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BillingDataService } from '@core/services/billing-data.service';
import { docKindPresentation } from '@core/utils/doc-kind.util';
import { EmptyStateComponent, IconComponent } from '@shared/ui';
import { UsdPipe } from '@shared/pipes/usd.pipe';

/** Entregar al cliente: compone y envía el correo · MODO DEMO (Mayo 2026). */
@Component({
  selector: 'app-entregar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent, UsdPipe],
  templateUrl: './entregar-demo.html',
})
export class EntregarDemo {
  private readonly billing = inject(BillingDataService);

  protected readonly draft = this.billing.emailDraft;
  protected readonly docKind = docKindPresentation;
}
