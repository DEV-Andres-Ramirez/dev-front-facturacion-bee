import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { esCorreoValido, partirDirecciones } from '@core/utils/correo.util';
import { IconComponent } from '../icon/icon';

interface Direccion {
  readonly valor: string;
  readonly valida: boolean;
  readonly inicial: string;
}

/**
 * Campo de direcciones de correo.
 *
 * Antes era un `<input type="text">` con las direcciones separadas por comas:
 * con más de una no se distinguía dónde acababa cada una, y una dirección mal
 * escrita solo se señalaba en un mensaje al pie de toda la tarjeta.
 *
 * Ahora cada dirección es una pastilla independiente, se quita con su aspa, y
 * la que está mal escrita se marca **ella misma** en rojo. Queda el modo texto
 * para pegar una lista entera de golpe, que es como llegan del cliente.
 */
@Component({
  selector: 'bee-direcciones',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './direcciones.html',
  styleUrl: './direcciones.css',
})
export class DireccionesComponent {
  readonly valor = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly campoId = input.required<string>();
  readonly placeholder = input('nombre@dominio.com');
  /** Solo lectura: en el histórico de un envío no se edita nada. */
  readonly soloLectura = input(false);

  readonly cambio = output<string>();
  /** Se emite al terminar de editar, para registrar la edición una sola vez. */
  readonly fin = output<void>();

  protected readonly modoTexto = signal(false);
  protected readonly borrador = signal('');

  protected readonly direcciones = computed<Direccion[]>(() =>
    partirDirecciones(this.valor()).map((valor) => ({
      valor,
      valida: esCorreoValido(valor),
      inicial: valor.trim().charAt(0).toUpperCase() || '?',
    })),
  );

  protected readonly invalidas = computed(() => this.direcciones().filter((d) => !d.valida).length);

  protected alternarModo(): void {
    this.volcarBorrador();
    this.modoTexto.update((texto) => !texto);
  }

  protected quitar(valor: string): void {
    this.emitir(
      this.direcciones()
        .filter((d) => d.valor !== valor)
        .map((d) => d.valor),
    );
  }

  protected escribirBorrador(evento: Event): void {
    this.borrador.set((evento.target as HTMLInputElement).value);
  }

  /** Coma, punto y coma o Enter cierran una dirección, como en cualquier cliente. */
  protected alTeclear(evento: Event): void {
    const teclado = evento as KeyboardEvent;
    if (teclado.key === ',' || teclado.key === ';' || teclado.key === 'Enter') {
      teclado.preventDefault();
      this.volcarBorrador();
      return;
    }
    // Retroceso con el campo vacío retira la última, que es lo que se espera.
    if (teclado.key === 'Backspace' && this.borrador() === '') {
      const actuales = this.direcciones();
      if (actuales.length > 0) this.quitar(actuales[actuales.length - 1].valor);
    }
  }

  /** Pegar una lista entera reparte las direcciones en pastillas. */
  protected alPegar(evento: Event): void {
    const portapapeles = (evento as ClipboardEvent).clipboardData?.getData('text') ?? '';
    if (!/[,;\n]/.test(portapapeles)) return;
    evento.preventDefault();
    const nuevas = partirDirecciones(portapapeles);
    if (nuevas.length) this.emitir([...this.direcciones().map((d) => d.valor), ...nuevas]);
  }

  protected alSalir(): void {
    this.volcarBorrador();
    this.fin.emit();
  }

  protected editarTexto(evento: Event): void {
    this.cambio.emit((evento.target as HTMLTextAreaElement).value);
  }

  /** Lo que quedó a medio escribir cuenta: perderlo sin avisar sería peor. */
  private volcarBorrador(): void {
    const pendiente = this.borrador().trim().replace(/[,;]$/, '');
    if (!pendiente) return;
    this.borrador.set('');
    this.emitir([...this.direcciones().map((d) => d.valor), pendiente]);
  }

  private emitir(direcciones: readonly string[]): void {
    this.cambio.emit([...new Set(direcciones.map((d) => d.trim()).filter(Boolean))].join(', '));
  }
}
