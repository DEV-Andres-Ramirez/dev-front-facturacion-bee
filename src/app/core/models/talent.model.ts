import { AvatarTone } from './common.model';

/** Motivo por el que un talento requiere gestión (RF-TAL-01). */
export type TalentReason = 'sin_mop' | 'sin_oc' | 'otra_linea';

/** Talento pendiente de incorporar a la facturación del periodo. */
export interface PendingTalent {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly avatar: AvatarTone;
  readonly project: string;
  readonly reason: TalentReason;
  readonly reasonLabel: string;
  /** Monto de la novedad a facturar (USD). */
  readonly amountUsd: number;
}
