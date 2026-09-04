import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ModuloAuditoria } from '@core/models';
import { AuditoriaService } from '@core/services/auditoria.service';
import { AuthService } from '@core/services/auth.service';
import { FacturasService } from '@core/services/facturas.service';
import { ModalComponent } from '@shared/ui';

/**
 * Diálogo de anulación de una factura.
 *
 * Vive fuera de las pantallas porque lo usan dos —Revisar y Conciliar— y lo que
 * dice tiene consecuencias contables: el motivo es obligatorio, la acción no se
 * deshace y **el número de factura queda consumido para siempre**. Si cada
 * pantalla tuviera su copia, esos tres avisos acabarían diciendo cosas
 * distintas.
 *
 * Se encarga también de la escritura y de la bitácora; quien lo monta solo dice
 * desde qué módulo se está anulando y qué hacer al terminar.
 */
@Component({
  selector: 'bee-anular-factura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent],
  template: `
    <bee-modal
      [titulo]="'Anular la factura ' + secuencial()"
      icono="alert"
      tono="bad"
      [cerrable]="!guardando()"
      (cerrar)="cancelar.emit()"
    >
      <p>
        La factura dejará de contar para la entrega al cliente y para los totales del periodo.
        <b>Esta acción no se puede deshacer desde el aplicativo.</b>
      </p>

      <div class="aviso-quemado">
        <b>El número {{ secuencial() }} no se podrá volver a usar.</b>
        Un secuencial identifica una sola factura en toda la historia de la empresa: anularla no
        libera el número, ni en este periodo ni en los siguientes.
      </div>

      @if (yaEnviada()) {
        <div class="alert alert-warn" style="margin-top: 12px">
          <div>
            <div class="at">Esta factura ya se envió al cliente</div>
            Anularla aquí no retira el correo. Habrá que avisar al cliente por el canal habitual.
          </div>
        </div>
      }

      <label class="f-label" for="motivo-anulacion" style="margin-top: 14px">
        Motivo de la anulación
      </label>
      <textarea
        id="motivo-anulacion"
        class="f-input f-area"
        rows="3"
        placeholder="Explica por qué se anula esta factura…"
        [value]="motivo()"
        (input)="escribir($event)"
      ></textarea>
      <p class="note-line" style="margin-top: 8px">
        El motivo queda registrado en la bitácora de auditoría junto a tu nombre.
      </p>

      @if (error()) {
        <p class="form-msg" role="alert">{{ error() }}</p>
      }

      <ng-container acciones>
        <button
          class="btn-sm btn-ghost"
          type="button"
          [disabled]="guardando()"
          (click)="cancelar.emit()"
        >
          Cancelar
        </button>
        <button
          class="btn-sm btn-solid"
          type="button"
          [disabled]="guardando() || !motivo().trim()"
          (click)="confirmar()"
        >
          {{ guardando() ? 'Anulando…' : 'Sí, anular la factura' }}
        </button>
      </ng-container>
    </bee-modal>
  `,
  styles: [
    `
      .aviso-quemado {
        margin-top: 12px;
        padding: 11px 13px;
        border-radius: var(--radius-sm);
        background: var(--bad-soft);
        border: 1px solid var(--bad-line);
        color: #7d2521;
        line-height: 1.55;
      }
      .f-area {
        height: auto;
        padding: 10px 12px;
        resize: vertical;
        line-height: 1.6;
      }
    `,
  ],
})
export class AnularFacturaDialog {
  readonly secuencial = input.required<string>();
  /** Etiqueta del periodo (`'Agosto 2026'`), que es la clave en la base de datos. */
  readonly periodo = input.required<string>();
  readonly modulo = input.required<ModuloAuditoria>();
  /** Cambia el aviso: anular algo que el cliente ya recibió no es lo mismo. */
  readonly yaEnviada = input(false);

  readonly cancelar = output<void>();
  readonly anulada = output<string>();

  private readonly facturas = inject(FacturasService);
  private readonly auditoria = inject(AuditoriaService);
  private readonly auth = inject(AuthService);

  protected readonly motivo = signal('');
  protected readonly guardando = signal(false);
  protected readonly error = signal('');

  protected escribir(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
  }

  protected async confirmar(): Promise<void> {
    const secuencial = this.secuencial();
    const motivo = this.motivo().trim();
    if (!motivo || this.guardando()) return;

    this.guardando.set(true);
    this.error.set('');
    const resultado = await this.facturas.anular(
      this.periodo(),
      secuencial,
      motivo,
      this.auth.user()?.email,
    );
    this.guardando.set(false);

    this.auditoria.registrar({
      modulo: this.modulo(),
      accion: 'ANULAR_FACTURA',
      resultado: resultado.ok ? 'exito' : 'error',
      observacion: resultado.ok
        ? `Anuló la factura ${secuencial}: ${motivo}`
        : `No se pudo anular la factura ${secuencial}.`,
      entidad: 'factura',
      referencia: secuencial,
      detalle: { motivo, yaEnviada: this.yaEnviada() },
    });

    if (!resultado.ok) {
      this.error.set(resultado.error ?? 'No se pudo anular la factura.');
      return;
    }
    this.anulada.emit(secuencial);
  }
}
