import { IconName } from '@shared/ui';
import { SemanticTone } from './common.model';

/**
 * Aviso del centro de notificaciones.
 *
 * No hay tabla detrás: cada notificación se **deriva del estado real** del
 * sistema en el momento de mirarla. Eso significa que no se puede quedar
 * obsoleta —desaparece sola en cuanto se resuelve lo que la originó— y que no
 * hay ciclo de vida que mantener.
 */
export interface Notificacion {
  /** Identificador estable para `track` y para recordar cuáles se descartaron. */
  readonly id: string;
  readonly tono: SemanticTone;
  readonly icono: IconName;
  readonly titulo: string;
  readonly detalle: string;
  /** Ruta del módulo que resuelve el aviso (RF-DSH-03: la alerta enlaza al origen). */
  readonly ruta: readonly string[] | null;
  /** Etiqueta del enlace, p. ej. «Ir a Validar». */
  readonly accion: string | null;
  /** Orden de atención: cuanto más bajo, más arriba aparece. */
  readonly prioridad: number;
}
