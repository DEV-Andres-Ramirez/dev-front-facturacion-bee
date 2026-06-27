import { DocKind } from './common.model';

/** Destinatario de un correo de entrega (RF-ENV-02). */
export interface Recipient {
  readonly initials: string;
  readonly email: string;
}

/** Adjunto del envío al cliente (RF-ENV-01). */
export interface Attachment {
  readonly name: string;
  readonly kind: DocKind;
  readonly sizeLabel: string;
}

/** Borrador del correo de entrega de factura al cliente. */
export interface EmailDraft {
  readonly invoiceId: string;
  readonly to: Recipient;
  readonly cc: readonly Recipient[];
  readonly subject: string;
  /** Cuerpo en líneas de párrafo (se renderiza con saltos). */
  readonly bodyParagraphs: readonly string[];
  readonly attachments: readonly Attachment[];
  readonly client: string;
  readonly amountUsd: number;
}
