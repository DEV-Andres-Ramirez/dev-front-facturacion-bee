import { UsdPipe } from './usd.pipe';

describe('UsdPipe', () => {
  const pipe = new UsdPipe();

  it('formatea con separador de miles y dos decimales (es-CO)', () => {
    expect(pipe.transform(4382)).toBe('USD 4.382,00');
    expect(pipe.transform(884.25)).toBe('USD 884,25');
  });

  it('omite el prefijo cuando withPrefix es false', () => {
    expect(pipe.transform(2692, false)).toBe('2.692,00');
  });

  it('muestra «—» para valores nulos', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
