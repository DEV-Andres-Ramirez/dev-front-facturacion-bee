import { AvatarTone, SemanticTone } from './common.model';

/** Evento de la bitácora de auditoría (RF-LOG-01). */
export interface AuditEvent {
  /** Marca temporal, p. ej. «02/05/2026 · 09:41:08». */
  readonly timestamp: string;
  readonly userName: string;
  readonly userInitials: string;
  readonly userAvatar: AvatarTone;
  readonly action: string;
  readonly actionTone: SemanticTone;
  readonly module: string;
  readonly entity: string;
}
