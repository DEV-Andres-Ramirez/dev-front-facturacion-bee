import { PeriodDataset } from '../models';

/**
 * Datos de ejemplo del periodo Mayo 2026.
 *
 * Narrativa coherente de extremo a extremo:
 *  · 14 líneas en la prefactura aprobada · 3 órdenes de compra.
 *  · Validación: 11 coinciden, 2 discrepancias de monto, 1 talento sin MOP.
 *  · Agrupación (una factura por orden, consecutivo desde BEE708):
 *      BEE709 · Acme Global · PCC-2026-01521 · OPEX  · USD 4.382,00
 *      BEE710 · Acme Global · PCC-2026-01533 · CAPEX · USD 1.420,00
 *      BEE711 · Northwind   · PCC-2026-01540 · OPEX  · USD 2.692,00
 *  · Conciliación: BEE709 y BEE711 pagadas; BEE710 pendiente. Retención 12,5%.
 */
export const MAY_2026_DATASET: PeriodDataset = {
  invoices: [
    {
      id: 'BEE709',
      client: 'Acme Global',
      order: 'PCC-2026-01521',
      amountUsd: 4382,
      status: 'pagada',
      days: 32,
      note: 'Mayo · Talento MOP',
      purchaseType: 'OPEX',
    },
    {
      id: 'BEE710',
      client: 'Acme Global',
      order: 'PCC-2026-01533',
      amountUsd: 1420,
      status: 'pendiente',
      days: 18,
      note: 'Mayo · CAPEX',
      purchaseType: 'CAPEX',
    },
    {
      id: 'BEE711',
      client: 'Northwind S.A.',
      order: 'PCC-2026-01540',
      amountUsd: 2692,
      status: 'pagada',
      days: 28,
      note: 'Mayo · Talento MOP',
      purchaseType: 'OPEX',
    },
  ],

  dashboard: {
    kpis: [
      { label: 'Total facturas', value: '3', caption: 'Periodo · Mayo 2026', tone: 'primary', icon: 'file-stack' },
      { label: 'Pagadas', value: '2', caption: '66% del total · conciliadas', tone: 'ok', icon: 'check' },
      { label: 'Pendientes', value: '1', caption: 'En gestión de cobro', tone: 'info', icon: 'clock' },
      { label: 'Sin emitir', value: '0', caption: 'Todo emitido', tone: 'ok', icon: 'alert' },
    ],
    financial: {
      totalCollectedUsd: 7074,
      receivableUsd: 1420,
      retentionUsd: 884.25,
      equivalentCopLabel: '$ 25,4 M',
      collectionProgress: 83,
      avgCollectionDays: 30,
    },
    pendingActions: [
      {
        title: '2 discrepancias de monto',
        description: 'En validación · periodo actual',
        tone: 'warn',
        icon: 'alert',
        target: 'validar',
      },
      {
        title: '1 factura por entregar',
        description: 'Lista para enviar al cliente',
        tone: 'info',
        icon: 'send',
        target: 'entregar',
      },
      {
        title: '1 pago por conciliar',
        description: 'BEE710 · vence pronto',
        tone: 'warn',
        icon: 'coins',
        target: 'conciliar',
      },
    ],
  },

  loading: {
    status: { linesDetected: 14, talentsMop: 11, orders: 3, currency: 'USD', readyToValidate: true },
    documents: [
      { name: 'Prefactura aprobada', kind: 'xls', meta: 'Aprobada por el cliente · 14 líneas', loaded: true },
      { name: 'Registro de facturación interna', kind: 'xls', meta: 'BIS Detalle Facturación · última BEE708', loaded: true },
      { name: 'Órdenes de compra', kind: 'pdf', meta: 'PCC-2026-01521 · 01533 · 01540', loaded: true },
      { name: 'Novedades del periodo', kind: 'doc', meta: 'Ajustes y soportes de talento', loaded: true },
    ],
  },

  prefactura: [
    { id: 'p-1', talent: 'Mariana Ríos', initials: 'MR', avatar: 'ink', roleMop: 'Desarrollador Sr.', purchaseType: 'OPEX', project: 'Feature pagos · 22 días', amountUsd: 1842, approver: 'Carmen L. Jiménez', approved: true },
    { id: 'p-2', talent: 'Julián Lozano', initials: 'JL', avatar: 'honey', roleMop: 'QA Engineer', purchaseType: 'OPEX', project: 'Pruebas E2E · 20 días', amountUsd: 1560, approver: 'Carmen L. Jiménez', approved: true },
    { id: 'p-3', talent: 'Diego Patiño', initials: 'DP', avatar: 'ink', roleMop: 'Data Analyst', purchaseType: 'OPEX', project: 'Modelo de datos · 21 días', amountUsd: 1346, approver: 'Sergio Fernández', approved: true },
    { id: 'p-4', talent: 'Sara Cárdenas', initials: 'SC', avatar: 'honey', roleMop: 'Diseñadora UX', purchaseType: 'CAPEX', project: 'Entrega de valor · rediseño', amountUsd: 1420, approver: 'Juan Hidalgo', approved: true },
  ],
  validation: {
    summary: { cotejadas: 14, coinciden: 11, discrepancias: 2, sinMop: 1 },
    lines: [
      {
        id: 'v-1',
        talent: 'Mariana Ríos',
        initials: 'MR',
        avatar: 'ink',
        reference: 'C-2291 · Acme Global',
        roleMop: 'Desarrollador Sr.',
        order: 'PCC-2026-01521',
        prefactura: 1842,
        registroInterno: 1842,
        status: 'coincide',
      },
      {
        id: 'v-2',
        talent: 'Julián Lozano',
        initials: 'JL',
        avatar: 'honey',
        reference: 'C-2288 · Acme Global',
        roleMop: 'QA Engineer',
        order: 'PCC-2026-01521',
        prefactura: 1560,
        registroInterno: 1488,
        status: 'discrepancia',
      },
      {
        id: 'v-3',
        talent: 'Diego Patiño',
        initials: 'DP',
        avatar: 'ink',
        reference: 'C-2301 · Northwind S.A.',
        roleMop: 'Data Analyst',
        order: 'PCC-2026-01540',
        prefactura: 1346,
        registroInterno: 1346,
        status: 'coincide',
      },
      {
        id: 'v-4',
        talent: 'Sara Cárdenas',
        initials: 'SC',
        avatar: 'honey',
        reference: 'C-2295 · Acme Global',
        roleMop: 'Diseñadora UX',
        order: 'PCC-2026-01533',
        prefactura: 1420,
        registroInterno: 1510,
        status: 'discrepancia',
      },
      {
        id: 'v-5',
        talent: 'Andrés Torres',
        initials: 'AT',
        avatar: 'neutral',
        reference: 'Sin contrato MOP · novedad',
        roleMop: null,
        order: null,
        prefactura: 980,
        registroInterno: null,
        status: 'sin_mop',
      },
    ],
  },

  pendingTalents: [
    {
      id: 't-at',
      name: 'Andrés Torres',
      initials: 'AT',
      avatar: 'neutral',
      project: 'Acme · Migración Core',
      reason: 'sin_mop',
      reasonLabel: 'Sin contrato MOP',
      amountUsd: 980,
    },
  ],

  groups: [
    {
      id: 'BEE709',
      client: 'Acme Global',
      order: 'PCC-2026-01521',
      purchaseType: 'OPEX',
      amountUsd: 4382,
      amountInWords: 'Cuatro mil trescientos ochenta y dos dólares',
      lines: [
        { talent: 'Mariana Ríos', roleMop: 'Desarrollador Sr.', valueDelivery: 'Feature pagos · 22 días', amountUsd: 1842 },
        { talent: 'Julián Lozano', roleMop: 'QA Engineer', valueDelivery: 'Pruebas E2E · 20 días', amountUsd: 1560 },
        { talent: 'Andrés Torres', roleMop: 'Backend Dev', valueDelivery: 'Migración core · 12 días', amountUsd: 980 },
      ],
    },
    {
      id: 'BEE710',
      client: 'Acme Global',
      order: 'PCC-2026-01533',
      purchaseType: 'CAPEX',
      amountUsd: 1420,
      amountInWords: 'Mil cuatrocientos veinte dólares',
      lines: [
        { talent: 'Sara Cárdenas', roleMop: 'Diseñadora UX', valueDelivery: 'Entrega de valor · rediseño', amountUsd: 1420 },
      ],
    },
    {
      id: 'BEE711',
      client: 'Northwind S.A.',
      order: 'PCC-2026-01540',
      purchaseType: 'OPEX',
      amountUsd: 2692,
      amountInWords: 'Dos mil seiscientos noventa y dos dólares',
      lines: [
        { talent: 'Diego Patiño', roleMop: 'Data Analyst', valueDelivery: 'Modelo de datos · 21 días', amountUsd: 1346 },
        { talent: 'Laura Méndez', roleMop: 'Data Engineer', valueDelivery: 'Pipeline ETL · 21 días', amountUsd: 1346 },
      ],
    },
  ],

  emittedInvoices: [
    { id: 'BEE709', client: 'Acme Global', order: 'PCC-2026-01521', amountEmitted: 4382, amountExpected: 4382, matches: true },
    { id: 'BEE710', client: 'Acme · CAPEX', order: 'PCC-2026-01533', amountEmitted: 1420, amountExpected: 1420, matches: true },
    { id: 'BEE711', client: 'Northwind S.A.', order: 'PCC-2026-01540', amountEmitted: 2692, amountExpected: 2692, matches: true },
  ],

  reviewChecks: [
    { label: 'Número de orden coincide', passed: 3, total: 3 },
    { label: 'Número de factura secuencial', passed: 3, total: 3 },
    { label: 'Monto idéntico al agrupado', passed: 3, total: 3 },
    { label: 'Registro contable adjunto', passed: 3, total: 3 },
  ],

  emailDraft: {
    invoiceId: 'BEE709',
    client: 'Acme Global',
    amountUsd: 4382,
    to: { initials: 'PA', email: 'pagos@acme-global.com' },
    cc: [
      { initials: 'AP', email: 'aprobador@acme-global.com' },
      { initials: 'PR', email: 'proyectos@beeconsultoria.com' },
      { initials: 'FI', email: 'financiera@beeconsultoria.com' },
    ],
    subject: 'Factura BEE709 · Acme Global · Mayo 2026 · PCC-2026-01521',
    bodyParagraphs: [
      'Estimado equipo de Acme Global,',
      'Adjuntamos la factura BEE709 correspondiente al periodo de Mayo 2026, asociada a la orden de compra PCC-2026-01521, por un valor de USD 4.382,00.',
      'Se incluye la orden de compra y el archivo de aprobación que respalda los montos facturados. Quedamos atentos a cualquier observación.',
      'Cordialmente, Coordinación de Operaciones · Bee Consultoría y Negocios',
    ],
    attachments: [
      { name: 'BEE709.pdf', kind: 'pdf', sizeLabel: '248 KB' },
      { name: 'PCC-2026-01521.pdf', kind: 'pdf', sizeLabel: '96 KB' },
      { name: 'Aprobacion_BEE709.xlsx', kind: 'xls', sizeLabel: '41 KB' },
    ],
  },

  reconciliation: {
    rows: [
      { invoiceId: 'BEE709', client: 'Acme · PCC-2026-01521', order: 'PCC-2026-01521', amountUsd: 4382, trm: 4118.4, receivedCop: 15790000, retentionUsd: 547.75, status: 'pagada' },
      { invoiceId: 'BEE711', client: 'Northwind · PCC-2026-01540', order: 'PCC-2026-01540', amountUsd: 2692, trm: 4102.1, receivedCop: 9660000, retentionUsd: 336.5, status: 'pagada' },
      { invoiceId: 'BEE710', client: 'Acme · PCC-2026-01533 · CAPEX', order: 'PCC-2026-01533', amountUsd: 1420, trm: null, receivedCop: null, retentionUsd: null, status: 'pendiente' },
      { invoiceId: 'BEE705', client: 'Periodo anterior', order: 'PCC-2026-01498', amountUsd: 1180, trm: null, receivedCop: null, retentionUsd: null, status: 'anulada' },
    ],
    totals: {
      billedUsd: 8494,
      receivedUsd: 7074,
      retentionUsd: 884.25,
      equivalentCopLabel: '$ 25,4 M',
    },
    detail: {
      invoiceId: 'BEE709',
      billedUsd: 4382,
      retentionUsd: 547.75,
      netExpectedUsd: 3834.25,
      trm: 4118.4,
      receivedCopLabel: '$ 15,79 M',
      paymentDays: 32,
    },
  },

  archive: {
    synced: true,
    activeSummary: '18 archivos · 12,4 MB',
    years: [
      {
        label: '2026',
        monthsLabel: '5 meses',
        folders: [
          { id: 'f-05', label: 'Mayo', fileCountLabel: '18 archivos', active: true },
          { id: 'f-04', label: 'Abril', fileCountLabel: '15 archivos', active: false },
          { id: 'f-03', label: 'Marzo', fileCountLabel: '16 archivos', active: false },
        ],
      },
    ],
    categories: [
      { label: 'Pedidos de compra', count: 3 },
      { label: 'Prefactura aprobada', count: 1 },
      { label: 'Novedades', count: 2 },
      { label: 'Facturas', count: 3 },
      { label: 'Comprobantes de pago', count: 2 },
      { label: 'Consolidado', count: 1 },
    ],
    files: [
      { name: 'Prefactura_Aprobada_Mayo.xlsx', kind: 'xls', meta: 'Aprobada por el cliente · 14 líneas' },
      { name: 'BEE709_Acme_Global.pdf', kind: 'pdf', meta: 'Factura emitida · PCC-2026-01521' },
      { name: 'Comprobante_Pago_BEE709.pdf', kind: 'pdf', meta: 'Transferencia · banco' },
      { name: 'Consolidado_Mayo_2026.xlsx', kind: 'xls', meta: 'Estado y conciliación del periodo' },
    ],
  },

  audit: [
    { timestamp: '02/05/2026 · 09:41:08', userName: 'Carolina Forero', userInitials: 'CF', userAvatar: 'honey', action: 'Validó cotejo', actionTone: 'info', module: 'Validación', entity: 'Periodo Mayo 2026' },
    { timestamp: '02/05/2026 · 09:38:52', userName: 'Viviana Álvarez', userInitials: 'VA', userAvatar: 'ink', action: 'Confirmó emisión', actionTone: 'ok', module: 'Revisión', entity: 'BEE709 · BEE710 · BEE711' },
    { timestamp: '02/05/2026 · 09:30:17', userName: 'Mateo Suárez', userInitials: 'MS', userAvatar: 'ok', action: 'Agregó talento', actionTone: 'primary', module: 'Talentos', entity: 'Andrés Torres · C-2310' },
    { timestamp: '01/05/2026 · 18:22:45', userName: 'Carolina Forero', userInitials: 'CF', userAvatar: 'honey', action: 'Entregó al cliente', actionTone: 'warn', module: 'Entrega', entity: 'BEE709 · Acme Global' },
    { timestamp: '01/05/2026 · 16:05:33', userName: 'Viviana Álvarez', userInitials: 'VA', userAvatar: 'ink', action: 'Concilió pago', actionTone: 'ok', module: 'Conciliación', entity: 'BEE711 · Northwind' },
    { timestamp: '01/05/2026 · 15:48:10', userName: 'Viviana Álvarez', userInitials: 'VA', userAvatar: 'ink', action: 'Inició sesión', actionTone: 'neutral', module: 'Acceso', entity: 'IP 190.85.x.x · Bogotá' },
    { timestamp: '01/05/2026 · 11:12:59', userName: 'Carolina Forero', userInitials: 'CF', userAvatar: 'honey', action: 'Agrupó facturas', actionTone: 'primary', module: 'Agrupación', entity: '3 órdenes · 14 líneas' },
    { timestamp: '01/05/2026 · 10:40:21', userName: 'Viviana Álvarez', userInitials: 'VA', userAvatar: 'ink', action: 'Importó prefactura', actionTone: 'info', module: 'Carga', entity: 'Prefactura_Mayo.xlsx' },
  ],
};
