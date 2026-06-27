import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BillingDataService } from '@core/services/billing-data.service';
import { docKindPresentation } from '@core/utils/doc-kind.util';
import { BadgeComponent, EmptyStateComponent, IconComponent } from '@shared/ui';

/** Guardar registros: archivo documental del ciclo conservado por año y mes (RF-DOC). */
@Component({
  selector: 'app-registros',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, EmptyStateComponent, IconComponent],
  templateUrl: './registros.html',
})
export class Registros {
  private readonly billing = inject(BillingDataService);

  protected readonly archive = this.billing.archive;
  protected readonly docKind = docKindPresentation;
}
