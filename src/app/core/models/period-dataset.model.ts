import { Invoice } from './invoice.model';
import { DashboardData } from './dashboard.model';
import { PeriodLoadStatus, LoadedDocument } from './loading.model';
import { PrefacturaLine } from './prefactura.model';
import { ValidationLine, ValidationSummary } from './validation.model';
import { PendingTalent } from './talent.model';
import { InvoiceGroup } from './grouping.model';
import { EmittedInvoice, ReviewCheck } from './review.model';
import { EmailDraft } from './delivery.model';
import {
  ReconciliationRow,
  ReconciliationTotals,
  ReconciliationDetail,
} from './reconciliation.model';
import { DocumentArchive } from './document.model';
import { AuditEvent } from './audit.model';

/** Cotejo de validación del periodo. */
export interface ValidationData {
  readonly summary: ValidationSummary;
  readonly lines: readonly ValidationLine[];
}

/** Estado de carga de documentos del periodo. */
export interface LoadingData {
  readonly status: PeriodLoadStatus | null;
  readonly documents: readonly LoadedDocument[];
}

/** Conciliación del periodo. */
export interface ReconciliationData {
  readonly rows: readonly ReconciliationRow[];
  readonly totals: ReconciliationTotals | null;
  readonly detail: ReconciliationDetail | null;
}

/**
 * Conjunto completo de datos de un periodo de facturación.
 * Mayo 2026 trae datos sembrados; Junio 2026 devuelve un dataset en blanco.
 * Las colecciones vacías permiten que cada pantalla muestre su estado vacío.
 */
export interface PeriodDataset {
  readonly invoices: readonly Invoice[];
  readonly dashboard: DashboardData;
  readonly loading: LoadingData;
  /** Líneas de la prefactura aprobada importada (vacío hasta cargar el Excel). */
  readonly prefactura: readonly PrefacturaLine[];
  readonly validation: ValidationData;
  readonly pendingTalents: readonly PendingTalent[];
  readonly groups: readonly InvoiceGroup[];
  readonly emittedInvoices: readonly EmittedInvoice[];
  readonly reviewChecks: readonly ReviewCheck[];
  readonly emailDraft: EmailDraft | null;
  readonly reconciliation: ReconciliationData;
  readonly archive: DocumentArchive | null;
  readonly audit: readonly AuditEvent[];
}
