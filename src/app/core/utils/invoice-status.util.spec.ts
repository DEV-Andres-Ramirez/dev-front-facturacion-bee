import { invoiceStatusPresentation } from './invoice-status.util';

describe('invoiceStatusPresentation', () => {
  it('mapea el estado al código de color del proceso (RF-CON-03)', () => {
    expect(invoiceStatusPresentation('pagada')).toEqual({ tone: 'ok', label: 'Pagada' });
    expect(invoiceStatusPresentation('pendiente')).toEqual({ tone: 'info', label: 'Pendiente' });
    expect(invoiceStatusPresentation('anulada')).toEqual({ tone: 'bad', label: 'Anulada' });
  });
});
