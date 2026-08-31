import {
  AprobacionPrefacturaRow,
  FacturaRow,
  PlantillaCorreo,
  RegistroInternaRow,
} from '../models';
import {
  componerCorreos,
  cuerpoComoHtml,
  esCorreoValido,
  partirDirecciones,
  prepararCorreo,
} from './correo.util';

const registro = (
  parcial: Partial<RegistroInternaRow> & { secuencial_facturacion_interna: string },
): RegistroInternaRow =>
  ({
    id_facturacion_interna: 1,
    periodo_facturacion_interna: 'Agosto 2026',
    pedido_compra_facturacion_interna: null,
    mes_facturacion_interna: 'Agosto',
    cliente_facturacion_interna: 'Banistmo',
    id_colaborados_facturacion_interna: 'COL-1',
    descripcion_facturacion_interna: null,
    tipo_moneda_facturacion_interna: 'USD',
    tarifa_facturacion_interna: null,
    hora_novedad_facturacion_interna: null,
    tarifa_hora_facturacion_interna: null,
    monto_facturar_facturacion_interna: null,
    valor_letras_facturacion_interna: null,
    email_aprobador_facturacion_interna: null,
    documento_pedido_compra: null,
    documento_factura_bee: null,
    monto_emitido_factura_bee: null,
    fecha_factura_bee: null,
    ...parcial,
  }) as RegistroInternaRow;

const factura = (parcial: Partial<FacturaRow>): FacturaRow =>
  ({
    id_factura: 1,
    periodo_factura: 'Agosto 2026',
    secuencial_factura: '001',
    pedido_compra_factura: null,
    cliente_factura: 'Banistmo',
    moneda_factura: 'USD',
    monto_facturado_factura: null,
    monto_emitido_factura: null,
    fecha_emision_factura: null,
    estado_factura: 'emitida',
    fecha_envio_factura: null,
    fecha_pago_factura: null,
    valor_recibido_factura: null,
    retencion_pct_factura: null,
    valor_retenido_factura: null,
    trm_factura: null,
    equivalente_cop_factura: null,
    soporte_pago_factura: null,
    motivo_anulacion_factura: null,
    anulada_por_factura: null,
    observacion_factura: null,
    dias_transcurridos: null,
    vencida: false,
    ...parcial,
  }) as FacturaRow;

const prefactura = (
  parcial: Partial<AprobacionPrefacturaRow>,
): AprobacionPrefacturaRow =>
  ({
    id_prefactura: 1,
    periodo_prefactura: 'Agosto 2026',
    numero_contrato_prefactura: null,
    id_colaborador_prefactura: 'COL-1',
    lider_aprobador_prefactura: null,
    nombre_proyecto_prefactura: null,
    ...parcial,
  }) as AprobacionPrefacturaRow;

const base = {
  periodo: 'Agosto 2026',
  prefactura: [] as AprobacionPrefacturaRow[],
  facturas: new Map<string, FacturaRow>(),
  destinatario: 'cliente@banistmo.com',
  copiasFijas: ['copia@beeconsultoria.com'],
  proveedor: 'BEE CONSULTORIA Y NEGOCIOS SAS',
  asunto: 'Emisión Factura {secuencial} · {periodo}',
};

describe('componerCorreos', () => {
  it('agrupa el registro por secuencial y ordena numéricamente', () => {
    const correos = componerCorreos({
      ...base,
      registro: [
        registro({ secuencial_facturacion_interna: '10' }),
        registro({ secuencial_facturacion_interna: '2' }),
        registro({ secuencial_facturacion_interna: '2' }),
      ],
    });

    expect(correos.map((c) => c.secuencial)).toEqual(['2', '10']);
  });

  // Una factura anulada no se entrega: dejarla en el lote sería mandar al
  // cliente una factura que ya no existe.
  it('excluye las facturas anuladas', () => {
    const correos = componerCorreos({
      ...base,
      registro: [registro({ secuencial_facturacion_interna: '001' })],
      facturas: new Map([['001', factura({ estado_factura: 'anulada' })]]),
    });

    expect(correos).toEqual([]);
  });

  it('marca como ya enviada la que se envió o se pagó', () => {
    const enviada = componerCorreos({
      ...base,
      registro: [registro({ secuencial_facturacion_interna: '001' })],
      facturas: new Map([['001', factura({ estado_factura: 'enviada' })]]),
    });
    const emitida = componerCorreos({
      ...base,
      registro: [registro({ secuencial_facturacion_interna: '001' })],
      facturas: new Map([['001', factura({ estado_factura: 'emitida' })]]),
    });

    expect(enviada[0].yaEnviada).toBe(true);
    expect(emitida[0].yaEnviada).toBe(false);
  });

  it('reúne en copia a los aprobadores del secuencial y las copias fijas, sin repetir', () => {
    const correos = componerCorreos({
      ...base,
      registro: [
        registro({
          secuencial_facturacion_interna: '001',
          email_aprobador_facturacion_interna: 'lider@banistmo.com',
        }),
        registro({
          secuencial_facturacion_interna: '001',
          email_aprobador_facturacion_interna: 'lider@banistmo.com',
        }),
      ],
    });

    expect(correos[0].cc).toBe('lider@banistmo.com, copia@beeconsultoria.com');
  });

  it('sustituye los marcadores del asunto configurado', () => {
    const correos = componerCorreos({
      ...base,
      registro: [registro({ secuencial_facturacion_interna: '001' })],
    });

    expect(correos[0].subject).toBe('Emisión Factura 001 · Agosto 2026');
  });

  it('prefiere los datos de la factura sobre los del registro', () => {
    const correos = componerCorreos({
      ...base,
      registro: [
        registro({
          secuencial_facturacion_interna: '001',
          monto_emitido_factura_bee: 'USD 1,00',
          fecha_factura_bee: '2026-08-01',
        }),
      ],
      facturas: new Map([
        [
          '001',
          factura({
            monto_emitido_factura: 1234.5,
            fecha_emision_factura: '2026-08-14',
            pedido_compra_factura: 'PCC-2026-02797',
          }),
        ],
      ]),
    });

    expect(correos[0].cuerpo).toContain('MONTO: USD 1.234,50');
    expect(correos[0].cuerpo).toContain('FECHA DE FACTURA FISICA: 14/08/2026');
    expect(correos[0].cuerpo).toContain('PEDIDO DE COMPRA: PCC-2026-02797');
  });

  it('completa contrato, proyecto y validador desde la prefactura', () => {
    const correos = componerCorreos({
      ...base,
      registro: [
        registro({
          secuencial_facturacion_interna: '001',
          id_colaborados_facturacion_interna: 'COL-1',
        }),
      ],
      prefactura: [
        prefactura({
          numero_contrato_prefactura: 'CT-9',
          nombre_proyecto_prefactura: 'Canales',
          lider_aprobador_prefactura: 'Ana',
        }),
      ],
    });

    expect(correos[0].cuerpo).toContain('NÚMERO DE CONTRATO: CT-9');
    expect(correos[0].cuerpo).toContain('PROYECTO: Canales');
    expect(correos[0].cuerpo).toContain('NOMBRE DE USUARIO VALIDADOR: Ana');
  });

  it('adjunta lo que hay y avisa de lo que falta', () => {
    const correos = componerCorreos({
      ...base,
      registro: [
        registro({
          secuencial_facturacion_interna: '001',
          documento_factura_bee: 'https://storage/factura.pdf',
          pedido_compra_facturacion_interna: 'PCC-1',
        }),
      ],
    });

    expect(correos[0].adjuntos).toEqual([
      { url: 'https://storage/factura.pdf', filename: 'FACTURA 001.pdf' },
    ]);
    expect(correos[0].faltantes).toEqual(['Pedido de compra']);
  });

  // Hay facturas que legítimamente no llevan pedido de compra: reclamarlo
  // llenaría la pantalla de avisos que nadie puede resolver.
  it('no echa en falta el pedido de compra si la factura no declara ninguno', () => {
    const correos = componerCorreos({
      ...base,
      registro: [
        registro({
          secuencial_facturacion_interna: '001',
          documento_factura_bee: 'https://storage/factura.pdf',
          pedido_compra_facturacion_interna: 'NO RECIBIDO',
        }),
      ],
    });

    expect(correos[0].faltantes).toEqual([]);
  });
});

describe('prepararCorreo', () => {
  const plantilla: PlantillaCorreo = {
    secuencial: '001',
    to: 'cliente@banistmo.com',
    cc: 'copia@beeconsultoria.com',
    subject: 'Emisión Factura 001',
    cuerpo: 'Cuerpo generado',
    adjuntos: [],
    faltantes: [],
    yaEnviada: false,
  };

  it('sin ediciones devuelve la plantilla lista para enviar', () => {
    const correo = prepararCorreo(plantilla, undefined);

    expect(correo.editado).toBe(false);
    expect(correo.listo).toBe(true);
    expect(correo.destinatarios).toEqual(['cliente@banistmo.com']);
    expect(correo.copias).toEqual(['copia@beeconsultoria.com']);
  });

  it('aplica solo los campos editados y deja derivarse el resto', () => {
    const correo = prepararCorreo(plantilla, { subject: 'Otro asunto' });

    expect(correo.subject).toBe('Otro asunto');
    expect(correo.cuerpo).toBe('Cuerpo generado');
    expect(correo.editado).toBe(true);
  });

  it('señala las direcciones mal escritas sin descartar el resto', () => {
    const correo = prepararCorreo(plantilla, {
      to: 'bueno@cliente.com, sin-arroba',
    });

    expect(correo.invalidas).toEqual(['sin-arroba']);
    expect(correo.listo).toBe(false);
  });

  it('no está listo sin destinatario o sin asunto', () => {
    expect(prepararCorreo(plantilla, { to: '  ' }).listo).toBe(false);
    expect(prepararCorreo(plantilla, { subject: '  ' }).listo).toBe(false);
  });
});

describe('partirDirecciones', () => {
  it('admite coma, punto y coma y saltos de línea, y descarta los huecos', () => {
    expect(partirDirecciones('a@b.com, c@d.com;  \n e@f.com , ')).toEqual([
      'a@b.com',
      'c@d.com',
      'e@f.com',
    ]);
  });
});

describe('esCorreoValido', () => {
  it('acepta direcciones normales y rechaza lo que claramente no lo es', () => {
    expect(esCorreoValido('facturacion@beeconsultoria.com')).toBe(true);
    expect(esCorreoValido('nombre.apellido+etiqueta@sub.dominio.co')).toBe(true);
    expect(esCorreoValido('sin-arroba')).toBe(false);
    expect(esCorreoValido('sin@dominio')).toBe(false);
  });
});

describe('cuerpoComoHtml', () => {
  it('escapa el texto: las líneas salen de los Excel que sube el usuario', () => {
    expect(cuerpoComoHtml('Bee & <Cía>')).toContain('Bee &amp; &lt;Cía&gt;');
  });

  it('conserva las líneas en blanco como separación real', () => {
    expect(cuerpoComoHtml('uno\n\ndos')).toBe(
      '<p style="margin:0 0 8px">uno</p>' +
        '<p style="margin:0 0 8px">&nbsp;</p>' +
        '<p style="margin:0 0 8px">dos</p>',
    );
  });
});
