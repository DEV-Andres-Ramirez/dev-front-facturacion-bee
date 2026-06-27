import { PeriodDataset } from '../models';

/**
 * Dataset en blanco para un periodo que se inicia desde cero (Junio 2026).
 * Todas las colecciones están vacías y los agregados son `null`, de modo que
 * cada pantalla renderiza su estado vacío («periodo sin iniciar»).
 */
export const EMPTY_DATASET: PeriodDataset = {
  invoices: [],
  dashboard: {
    kpis: [
      { label: 'Total facturas', value: '0', caption: 'Sin facturas en el periodo', tone: 'neutral', icon: 'file-stack' },
      { label: 'Pagadas', value: '0', caption: 'Aún no hay cobros', tone: 'neutral', icon: 'check' },
      { label: 'Pendientes', value: '0', caption: 'Sin gestión de cobro', tone: 'neutral', icon: 'clock' },
      { label: 'Sin emitir', value: '0', caption: 'Sin facturas generadas', tone: 'neutral', icon: 'alert' },
    ],
    financial: null,
    pendingActions: [],
  },
  loading: { status: null, documents: [] },
  prefactura: [],
  validation: {
    summary: { cotejadas: 0, coinciden: 0, discrepancias: 0, sinMop: 0 },
    lines: [],
  },
  pendingTalents: [],
  groups: [],
  emittedInvoices: [],
  reviewChecks: [],
  emailDraft: null,
  reconciliation: { rows: [], totals: null, detail: null },
  archive: null,
  audit: [],
};
