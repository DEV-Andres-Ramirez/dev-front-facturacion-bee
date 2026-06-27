import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BillingDataService } from './billing-data.service';
import { PeriodStore } from './period.store';

describe('BillingDataService · importación de prefactura (Junio en blanco)', () => {
  let billing: BillingDataService;
  let period: PeriodStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    billing = TestBed.inject(BillingDataService);
    period = TestBed.inject(PeriodStore);
    period.setPeriod('2026-06');
  });

  it('Junio 2026 arranca en blanco', () => {
    expect(billing.isBlankPeriod()).toBe(true);
    expect(billing.prefactura().length).toBe(0);
    expect(billing.loading().status).toBeNull();
  });

  it('importar la prefactura llena el periodo con datos reales (Banistmo · 6 líneas)', () => {
    billing.importPrefactura('2026-06');

    expect(billing.isBlankPeriod()).toBe(false);
    expect(billing.isImported()).toBe(true);
    expect(billing.prefactura().length).toBe(6);
    expect(billing.invoices().length).toBe(6);
    expect(billing.loading().status?.linesDetected).toBe(6);
    expect(billing.invoices()[0].client).toBe('Banistmo');
  });

  it('no afecta a Mayo 2026 (mantiene su semilla)', () => {
    billing.importPrefactura('2026-06');
    period.setPeriod('2026-05');
    expect(billing.isImported()).toBe(false);
    expect(billing.invoices()[0].id).toBe('BEE709');
  });

  it('resetPeriod revierte Junio a su estado en blanco', () => {
    billing.importPrefactura('2026-06');
    billing.resetPeriod('2026-06');
    expect(billing.isBlankPeriod()).toBe(true);
    expect(billing.prefactura().length).toBe(0);
  });

  it('markUpload registra los 4 tipos de soporte; el pedido de compra acumula', () => {
    billing.markUpload('2026-06', 'registro');
    billing.markUpload('2026-06', 'pedido');
    billing.markUpload('2026-06', 'pedido');
    billing.markUpload('2026-06', 'novedades');

    const state = billing.uploadsForCurrent();
    expect(state.registro).toBe(true);
    expect(state.novedades).toBe(true);
    expect(state.pedidos).toBe(2);
    // sin prefactura, el periodo sigue sin dataset importado
    expect(billing.isImported()).toBe(false);
  });

  it('markUpload de la prefactura importa el dataset del periodo', () => {
    billing.markUpload('2026-06', 'prefactura');
    expect(billing.uploadsForCurrent().prefactura).toBe(true);
    expect(billing.isImported()).toBe(true);
    expect(billing.prefactura().length).toBe(6);
  });
});
