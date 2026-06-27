import { PeriodDataset } from '../models';

/**
 * Dataset que resulta de importar el archivo real
 * «BEE - Aprobación de Prefactura ABRIL2026.xlsx» (hoja «Detalle»).
 *
 * Datos auténticos tomados de las evidencias reales (file #2 prefactura aprobada
 * y file #3 registro interno «BIS Detalle Facturación · ABRIL 2026»):
 *   · Cliente: Banistmo · Contrato BI-VSC-15479-2022-001 · Última factura BEE699.
 *   · 6 colaboradores aprobados (total USD 5.732,62).
 *   · Consecutivo de Abril BEE700–BEE705 (una factura por orden de compra; las
 *     órdenes «no recibidas» se facturan de forma individual).
 *   · Diego Ramírez figura en el registro interno pero no en la prefactura
 *     aprobada → se gestiona como talento a incorporar.
 *
 * Se usa para «maquillar» la carga del periodo Junio 2026 con información real
 * mientras se construye el backend (Supabase). Sustituye al dataset en blanco
 * cuando el usuario importa el Excel.
 */
export const ABRIL_LOADED_DATASET: PeriodDataset = {
  invoices: [
    { id: 'BEE700', client: 'Banistmo', order: 'OC no recibida', amountUsd: 1252.77, status: 'pagada', days: 31, note: 'Abril · CAPEX Yappy', purchaseType: 'CAPEX' },
    { id: 'BEE701', client: 'Banistmo', order: 'OC no recibida', amountUsd: 780.67, status: 'pendiente', days: 22, note: 'Abril · CAPEX Yappy', purchaseType: 'CAPEX' },
    { id: 'BEE702', client: 'Banistmo', order: 'PCC-2026-01521', amountUsd: 2038.08, status: 'pagada', days: 28, note: 'Abril · CAPEX Yappy', purchaseType: 'CAPEX' },
    { id: 'BEE703', client: 'Banistmo', order: 'OC no recibida', amountUsd: 657.12, status: 'pendiente', days: 22, note: 'Abril · CAPEX Yappy', purchaseType: 'CAPEX' },
    { id: 'BEE704', client: 'Banistmo', order: 'OC no recibida', amountUsd: 1003.87, status: 'pendiente', days: 22, note: 'Abril · Ciclo de Crédito', purchaseType: 'OPEX' },
    { id: 'BEE705', client: 'Banistmo', order: 'PCC-2026-01534', amountUsd: 1003.87, status: 'pendiente', days: 19, note: 'Abril · Ciclo de Crédito', purchaseType: 'OPEX' },
  ],

  dashboard: {
    kpis: [
      { label: 'Total facturas', value: '6', caption: 'Periodo · Abril 2026', tone: 'primary', icon: 'file-stack' },
      { label: 'Pagadas', value: '2', caption: '33% del total · conciliadas', tone: 'ok', icon: 'check' },
      { label: 'Pendientes', value: '4', caption: 'En gestión de cobro', tone: 'info', icon: 'clock' },
      { label: 'Sin emitir', value: '0', caption: 'Todo emitido', tone: 'ok', icon: 'alert' },
    ],
    financial: {
      totalCollectedUsd: 3290.85,
      receivableUsd: 3445.53,
      retentionUsd: 411.36,
      equivalentCopLabel: '$ 11,8 M',
      collectionProgress: 49,
      avgCollectionDays: 30,
    },
    pendingActions: [
      { title: '4 discrepancias de monto', description: 'En validación · periodo actual', tone: 'warn', icon: 'alert', target: 'validar' },
      { title: '1 talento por incorporar', description: 'Diego Ramírez · sin prefactura', tone: 'info', icon: 'talents', target: 'talentos' },
      { title: '4 pagos por conciliar', description: 'Banistmo · vencen pronto', tone: 'warn', icon: 'coins', target: 'conciliar' },
    ],
  },

  loading: {
    status: { linesDetected: 6, talentsMop: 6, orders: 2, currency: 'USD', readyToValidate: true },
    documents: [
      { name: 'BEE - Aprobación de Prefactura ABRIL2026.xlsx', kind: 'xls', meta: 'Aprobada por el cliente · 6 líneas', loaded: true },
      { name: 'BIS Detalle Facturación Serv ABRIL 2026.xlsx', kind: 'xls', meta: 'Registro interno · última BEE699', loaded: true },
      { name: 'Pedidos de compra', kind: 'pdf', meta: 'PCC-2026-01521 · PCC-2026-01534', loaded: true },
    ],
  },

  prefactura: [
    { id: 'pf-1', talent: 'Alejandra Muñoz', initials: 'AM', avatar: 'ink', roleMop: 'Ingeniero de Software (COBIS)', purchaseType: 'CAPEX', project: 'EVC-717008 · Interoperabilidad Yappy', amountUsd: 1252.77, approver: 'Carmen L. Jiménez', approved: true },
    { id: 'pf-2', talent: 'Nicolás Gutiérrez Arcila', initials: 'NG', avatar: 'honey', roleMop: 'Desarrollador JavaScript (Front-Back)', purchaseType: 'CAPEX', project: 'EVC003 · Yappy Onboarding e1', amountUsd: 780.57, approver: 'Sergio Fernández', approved: true },
    { id: 'pf-3', talent: 'Pedro Pérez', initials: 'PP', avatar: 'ok', roleMop: 'Tester Automatizador', purchaseType: 'CAPEX', project: 'EVC003 · Yappy Onboarding e1', amountUsd: 838.19, approver: 'Juan Hidalgo', approved: true },
    { id: 'pf-4', talent: 'Sara Castro', initials: 'SC', avatar: 'slate', roleMop: 'Tester Automatizador', purchaseType: 'CAPEX', project: 'EVC003 · Yappy Onboarding e1', amountUsd: 657.29, approver: 'Juan Hidalgo', approved: true },
    { id: 'pf-5', talent: 'Pablo Franco', initials: 'PF', avatar: 'info', roleMop: 'Tester Automatizador', purchaseType: 'CAPEX', project: 'EVC004 · BLE & APP Empresas', amountUsd: 1200, approver: 'Juan Hidalgo', approved: true },
    { id: 'pf-6', talent: 'Fernando Hurtado', initials: 'FH', avatar: 'neutral', roleMop: 'Desarrollador Java (Front-Back)', purchaseType: 'OPEX', project: 'EVC-683892 · Ciclo de Crédito', amountUsd: 1003.8, approver: 'Sergio Fernández', approved: true },
  ],

  validation: {
    summary: { cotejadas: 6, coinciden: 2, discrepancias: 4, sinMop: 1 },
    lines: [
      { id: 'v-1', talent: 'Alejandra Muñoz', initials: 'AM', avatar: 'ink', reference: 'BI-VSC-15479 · Banistmo', roleMop: 'Ingeniero de Software', order: 'OC no recibida', prefactura: 1252.77, registroInterno: 1252.77, status: 'coincide' },
      { id: 'v-2', talent: 'Nicolás Gutiérrez Arcila', initials: 'NG', avatar: 'honey', reference: 'BI-VSC-15479 · Banistmo', roleMop: 'Desarrollador JS', order: 'OC no recibida', prefactura: 780.57, registroInterno: 780.67, status: 'discrepancia' },
      { id: 'v-3', talent: 'Pedro Pérez', initials: 'PP', avatar: 'ok', reference: 'BI-VSC-15479 · Banistmo', roleMop: 'Tester Automatizador', order: 'PCC-2026-01521', prefactura: 838.19, registroInterno: 838.08, status: 'discrepancia' },
      { id: 'v-4', talent: 'Sara Castro', initials: 'SC', avatar: 'slate', reference: 'BI-VSC-15479 · Banistmo', roleMop: 'Tester Automatizador', order: 'OC no recibida', prefactura: 657.29, registroInterno: 657.12, status: 'discrepancia' },
      { id: 'v-5', talent: 'Pablo Franco', initials: 'PF', avatar: 'info', reference: 'BI-VSC-15479 · Banistmo', roleMop: 'Tester Automatizador', order: 'PCC-2026-01521', prefactura: 1200, registroInterno: 1200, status: 'coincide' },
      { id: 'v-6', talent: 'Fernando Hurtado', initials: 'FH', avatar: 'neutral', reference: 'BI-VSC-15479 · Banistmo', roleMop: 'Desarrollador Java', order: 'OC no recibida', prefactura: 1003.8, registroInterno: 1003.87, status: 'discrepancia' },
    ],
  },

  pendingTalents: [
    { id: 't-dr', name: 'Diego Ramírez', initials: 'DR', avatar: 'neutral', project: 'EVC Ciclo de Crédito', reason: 'sin_mop', reasonLabel: 'No contemplado en prefactura', amountUsd: 1003.87 },
  ],

  groups: [
    {
      id: 'BEE700', client: 'Banistmo', order: 'OC no recibida', purchaseType: 'CAPEX', amountUsd: 1252.77,
      amountInWords: 'Mil doscientos cincuenta y dos dólares con 77/100',
      lines: [{ talent: 'Alejandra Muñoz', roleMop: 'Ingeniero de Software', valueDelivery: 'Interoperabilidad Yappy · 13–30 abr', amountUsd: 1252.77 }],
    },
    {
      id: 'BEE701', client: 'Banistmo', order: 'OC no recibida', purchaseType: 'CAPEX', amountUsd: 780.67,
      amountInWords: 'Setecientos ochenta dólares con 67/100',
      lines: [{ talent: 'Nicolás Gutiérrez Arcila', roleMop: 'Desarrollador JS', valueDelivery: 'Yappy Onboarding · 9–30 abr', amountUsd: 780.67 }],
    },
    {
      id: 'BEE702', client: 'Banistmo', order: 'PCC-2026-01521', purchaseType: 'CAPEX', amountUsd: 2038.08,
      amountInWords: 'Dos mil treinta y ocho dólares con 08/100',
      lines: [
        { talent: 'Pedro Pérez', roleMop: 'Tester Automatizador', valueDelivery: 'Yappy Onboarding · 9–30 abr', amountUsd: 838.08 },
        { talent: 'Pablo Franco', roleMop: 'Tester Automatizador', valueDelivery: 'BLE & APP Empresas · 1–30 abr', amountUsd: 1200 },
      ],
    },
    {
      id: 'BEE703', client: 'Banistmo', order: 'OC no recibida', purchaseType: 'CAPEX', amountUsd: 657.12,
      amountInWords: 'Seiscientos cincuenta y siete dólares con 12/100',
      lines: [{ talent: 'Sara Castro', roleMop: 'Tester Automatizador', valueDelivery: 'Yappy Onboarding · 9–30 abr', amountUsd: 657.12 }],
    },
    {
      id: 'BEE704', client: 'Banistmo', order: 'OC no recibida', purchaseType: 'OPEX', amountUsd: 1003.87,
      amountInWords: 'Mil tres dólares con 87/100',
      lines: [{ talent: 'Fernando Hurtado', roleMop: 'Desarrollador Java', valueDelivery: 'Ciclo de Crédito · 6–30 abr', amountUsd: 1003.87 }],
    },
    {
      id: 'BEE705', client: 'Banistmo', order: 'PCC-2026-01534', purchaseType: 'OPEX', amountUsd: 1003.87,
      amountInWords: 'Mil tres dólares con 87/100',
      lines: [{ talent: 'Diego Ramírez', roleMop: 'Desarrollador Java', valueDelivery: 'Ciclo de Crédito · 1–30 abr', amountUsd: 1003.87 }],
    },
  ],

  emittedInvoices: [
    { id: 'BEE700', client: 'Banistmo', order: 'OC no recibida', amountEmitted: 1252.77, amountExpected: 1252.77, matches: true },
    { id: 'BEE701', client: 'Banistmo', order: 'OC no recibida', amountEmitted: 780.67, amountExpected: 780.67, matches: true },
    { id: 'BEE702', client: 'Banistmo', order: 'PCC-2026-01521', amountEmitted: 2038.08, amountExpected: 2038.08, matches: true },
    { id: 'BEE703', client: 'Banistmo', order: 'OC no recibida', amountEmitted: 657.12, amountExpected: 657.12, matches: true },
    { id: 'BEE704', client: 'Banistmo', order: 'OC no recibida', amountEmitted: 1003.87, amountExpected: 1003.87, matches: true },
    { id: 'BEE705', client: 'Banistmo', order: 'PCC-2026-01534', amountEmitted: 1003.87, amountExpected: 1003.87, matches: true },
  ],

  reviewChecks: [
    { label: 'Número de orden coincide', passed: 6, total: 6 },
    { label: 'Número de factura secuencial', passed: 6, total: 6 },
    { label: 'Monto idéntico al agrupado', passed: 6, total: 6 },
    { label: 'Registro contable adjunto', passed: 6, total: 6 },
  ],

  emailDraft: {
    invoiceId: 'BEE702',
    client: 'Banistmo',
    amountUsd: 2038.08,
    to: { initials: 'BP', email: 'cuentas.porpagar@banistmo.com' },
    cc: [
      { initials: 'JH', email: 'juan.hidalgo@banistmo.com' },
      { initials: 'PR', email: 'proyectos@beeconsultoria.com' },
      { initials: 'FI', email: 'financiera@beeconsultoria.com' },
    ],
    subject: 'Factura BEE702 · Banistmo · Abril 2026 · PCC-2026-01521',
    bodyParagraphs: [
      'Estimado equipo de Banistmo,',
      'Adjuntamos la factura BEE702 correspondiente al periodo de Abril 2026, contrato BI-VSC-15479-2022-001, asociada a la orden de compra PCC-2026-01521, por un valor de USD 2.038,08.',
      'Se incluye la orden de compra y el archivo de aprobación de prefactura que respalda los montos facturados. Quedamos atentos a cualquier observación.',
      'Cordialmente, Coordinación de Operaciones · Bee Consultoría y Negocios',
    ],
    attachments: [
      { name: 'BEE702.pdf', kind: 'pdf', sizeLabel: '252 KB' },
      { name: 'PCC-2026-01521.pdf', kind: 'pdf', sizeLabel: '98 KB' },
      { name: 'Aprobacion_Prefactura_Abril2026.xlsx', kind: 'xls', sizeLabel: '44 KB' },
    ],
  },

  reconciliation: {
    rows: [
      { invoiceId: 'BEE700', client: 'Banistmo · CAPEX Yappy', order: 'OC no recibida', amountUsd: 1252.77, trm: 4108.2, receivedCop: 4503000, retentionUsd: 156.6, status: 'pagada' },
      { invoiceId: 'BEE702', client: 'Banistmo · PCC-2026-01521', order: 'PCC-2026-01521', amountUsd: 2038.08, trm: 4105.1, receivedCop: 7320000, retentionUsd: 254.76, status: 'pagada' },
      { invoiceId: 'BEE701', client: 'Banistmo · CAPEX Yappy', order: 'OC no recibida', amountUsd: 780.67, trm: null, receivedCop: null, retentionUsd: null, status: 'pendiente' },
      { invoiceId: 'BEE703', client: 'Banistmo · CAPEX Yappy', order: 'OC no recibida', amountUsd: 657.12, trm: null, receivedCop: null, retentionUsd: null, status: 'pendiente' },
      { invoiceId: 'BEE704', client: 'Banistmo · Ciclo de Crédito', order: 'OC no recibida', amountUsd: 1003.87, trm: null, receivedCop: null, retentionUsd: null, status: 'pendiente' },
      { invoiceId: 'BEE705', client: 'Banistmo · PCC-2026-01534', order: 'PCC-2026-01534', amountUsd: 1003.87, trm: null, receivedCop: null, retentionUsd: null, status: 'pendiente' },
    ],
    totals: { billedUsd: 6736.38, receivedUsd: 3290.85, retentionUsd: 411.36, equivalentCopLabel: '$ 11,8 M' },
    detail: { invoiceId: 'BEE702', billedUsd: 2038.08, retentionUsd: 254.76, netExpectedUsd: 1783.32, trm: 4105.1, receivedCopLabel: '$ 7,32 M', paymentDays: 28 },
  },

  archive: {
    synced: true,
    activeSummary: '8 archivos · 9,4 MB',
    years: [
      {
        label: '2026',
        monthsLabel: '4 meses',
        folders: [
          { id: 'f-abr', label: 'Abril', fileCountLabel: '8 archivos', active: true },
          { id: 'f-mar', label: 'Marzo', fileCountLabel: '16 archivos', active: false },
          { id: 'f-feb', label: 'Febrero', fileCountLabel: '15 archivos', active: false },
        ],
      },
    ],
    categories: [
      { label: 'Pedidos de compra', count: 2 },
      { label: 'Prefactura aprobada', count: 1 },
      { label: 'Novedades', count: 1 },
      { label: 'Facturas', count: 6 },
      { label: 'Comprobantes de pago', count: 2 },
      { label: 'Consolidado', count: 1 },
    ],
    files: [
      { name: 'BEE - Aprobacion de Prefactura ABRIL2026.xlsx', kind: 'xls', meta: 'Aprobada por el cliente · 6 líneas' },
      { name: 'BEE702_Banistmo.pdf', kind: 'pdf', meta: 'Factura emitida · PCC-2026-01521' },
      { name: 'BIS_Detalle_Facturacion_Abril2026.xlsx', kind: 'xls', meta: 'Registro interno · BEE700–BEE705' },
      { name: 'Consolidado_Facturacion_Abril2026.xlsx', kind: 'xls', meta: 'Estado y conciliación del periodo' },
    ],
  },

  audit: [
    { timestamp: '16/06/2026 · 09:12:44', userName: 'Viviana Álvarez', userInitials: 'VA', userAvatar: 'ink', action: 'Importó prefactura', actionTone: 'info', module: 'Carga', entity: 'Aprobacion_Prefactura_ABRIL2026.xlsx' },
    { timestamp: '16/06/2026 · 09:14:03', userName: 'Viviana Álvarez', userInitials: 'VA', userAvatar: 'ink', action: 'Cotejó 6 líneas', actionTone: 'info', module: 'Validación', entity: 'Banistmo · contrato BI-VSC-15479' },
    { timestamp: '16/06/2026 · 09:16:20', userName: 'Carolina Forero', userInitials: 'CF', userAvatar: 'honey', action: 'Agrupó facturas', actionTone: 'primary', module: 'Agrupación', entity: '6 facturas · BEE700–BEE705' },
  ],
};
