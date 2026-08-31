# dev-front-facturacion-bee · Contexto para agentes

Aplicativo web del ciclo de facturación de **Bee Consultoría y Negocios**. Léelo
entero antes de tocar código: recoge qué está construido de verdad, qué es
fachada, las convenciones del proyecto y las trampas que ya han costado un bug.

> Las reglas de estilo de Angular están en `.claude/CLAUDE.md` y siguen vigentes:
> standalone sin `standalone: true`, signals, `inject()`, `OnPush`, control de
> flujo nativo (`@if`/`@for`), `class`/`style` bindings, formularios reactivos.

---

## 1. Qué hace y para quién

Bee factura a su cliente el trabajo de los colaboradores («talentos») asignados
a proyectos. Cada mes el ciclo es:

1. **Cargar** los soportes: Excel de *Aprobación de Prefactura* (lo devuelve el
   cliente aprobado), *Registro de Facturación Interna* de Bee, *Novedades* del
   periodo y los PDF de los *Pedidos de Compra*.
2. **Validar**: cotejar colaborador a colaborador que el monto que el cliente
   aprobó coincide con el que Bee tiene registrado.
3. **Agrupar** por *secuencial* de factura (cada secuencial = una factura).
4. **Emitir** (fuera del sistema: lo hace el outsourcing contable).
5. **Revisar**: subir el PDF de cada Factura BEE, su monto emitido y su fecha.
6. **Entregar**: enviar cada factura por correo con los PDF adjuntos.
7. **Conciliar y archivar**: contrastar pagos contra lo facturado.

Vocabulario que aparece en el código y en los datos:

| Término | Significado |
| --- | --- |
| **Periodo** | Mes de facturación. Hoy solo existe `2026-08` / «Agosto 2026» |
| **Prefactura** | Lo que el cliente reconoce pagar por cada colaborador |
| **Registro interno** | Lo que Bee cree que debe facturar |
| **Secuencial** | Número de factura de Bee (`BEE671`…). Agrupador de «una factura» |
| **Pedido de compra (PCC)** | Orden de compra del cliente, en PDF |

---

## 2. Estado real, módulo por módulo

**No te fíes de la interfaz**: varias pantallas están maquetadas pero no leen
datos. Esto es lo que hay:

| Módulo | Ruta | Estado | Fuente de datos |
| --- | --- | --- | --- |
| `auth/login` | `/login` | **REAL** | RPC `fn_login` |
| `carga` | `/app/carga` | **REAL** (el más completo) | Storage + 3 tablas |
| `validar` | `/app/validar` | **REAL** (cálculo) | Supabase (lectura) |
| `agrupar` | `/app/agrupar` | **REAL** (cálculo) | Supabase (lectura) |
| `revisar` | `/app/revisar` | **REAL** (escribe) | Supabase + Storage |
| `entregar` | `/app/entregar` | **REAL** | Supabase + backend NestJS |
| `usuarios` | `/app/usuarios` | **REAL** (CRUD) | RPC |
| **`auditoria`** | `/app/auditoria` | **REAL** (§5) | Tabla `auditoria` vía RPC |
| `dashboard` | `/app/dashboard` | **REAL** | `facturas` + prefactura |
| `conciliar` | `/app/conciliar` | **REAL** (RF-CON) | `facturas` vía RPC |
| `registros` | `/app/registros` | **REAL** (RF-DOC) | `documentos_facturacion` + Storage |
| `manuales` | `/app/manual-*` | Estático | — |

**Ya no queda ninguna fachada.** `BillingDataService` y `EMPTY_DATASET` fueron
el andamiaje de esas tres pantallas mientras no tenían datos; hoy solo sobrevive
la matriz de permisos que pinta la pantalla de usuarios.

---

## 3. Arquitectura

```
src/app/
  core/        dominio: models · data · services (stores) · guards · utils
  shared/      sistema de diseño: ui (icon, badge, kpi-card, empty-state…) · pipes
  layout/      shell (barra lateral + encabezado)
  features/    una carpeta por módulo, lazy con loadComponent
```

Alias: `@core/*`, `@shared/*`, `@features/*`, `@env`. Dentro de `core/` se usan
rutas relativas (`../models`); fuera, los alias.

**Angular 21 zoneless** (`provideZonelessChangeDetection()` en `app.config.ts`):
todo el estado va en signals. Un `setTimeout` que muta una propiedad normal no
repinta nada.

### Servicios de `core/services`

| Servicio | Qué hace |
| --- | --- |
| `SupabaseService` | Cliente único. Se consume como `inject(SupabaseService).client` |
| `AuthService` | Login vía `fn_login`; sesión en `localStorage['bee.session']` |
| `UsuariosService` | CRUD de cuentas vía RPC; lee de la vista `vw_usuarios` |
| `DocumentosService` | **El núcleo real**: Storage + las 3 tablas del ciclo |
| `AuditoriaService` | Bitácora (§5) |
| `PeriodosService` | Catálogo de periodos y avance del ciclo (`etapa_periodo`) |
| `FacturasService` | Facturas: anulación, envío y conciliación |
| `ParametrosService` | Retención, TRM, destinatarios y plazos configurables |
| `NotificacionesService` | Avisos **derivados** del estado real; sin tabla detrás |
| `PeriodStore` | Periodo activo. `period()` = id, `label()` = etiqueta |
| `BillingDataService` | Resto del andamiaje: solo la matriz de permisos |
| `EmailService` | Llama al backend `dev-back-facturacion-bee` |

---

## 4. Modelo de datos

Ocho tablas en Supabase (proyecto `xatapilakdhlmgfjvdco`). Convención de
columnas: `<concepto>_<sufijo_de_tabla>`.

| Tabla | Para qué |
| --- | --- |
| `usuarios` | Cuentas. RLS activo **sin políticas**: todo pasa por RPC y por `vw_usuarios` |
| `documentos_facturacion` | Índice de soportes subidos (URL de Storage) |
| `aprobacion_prefactura` | 25 columnas del Excel del cliente |
| `registro_facturacion_interna` | 13 del Excel interno + 4 que añade Revisar |
| `auditoria` | Bitácora inmutable (§5) |
| `periodos` | Catálogo de periodos y **etapa del ciclo** (§6) |
| `facturas` | La factura como entidad: estado, envío y conciliación (§6) |
| `parametros` | Retención, TRM, destinatarios y plazos (§6) |

> `respuestas_prospectiva` pertenece a otro producto del mismo proyecto Supabase.
> **No la toques**: es ruido para este aplicativo.

**Advertencias estructurales**: no hay **ni una sola clave foránea** — todas las
relaciones son por igualdad de texto. Montos, fechas y periodos son `text`. El
join central del ciclo es `id_colaborador_prefactura` ↔
`id_colaborados_facturacion_interna` (sí, «colaborados»).

Storage: bucket **`facturacion-bee`**, público, 5 MB por archivo.

---

## 5. Módulo de Auditoría (RF-LOG)

Registra cada acción relevante de cada usuario. Es el módulo con el modelo de
seguridad más estricto del proyecto.

### La tabla es inmutable de verdad

`public.auditoria` tiene RLS activo **sin políticas** y `revoke all privileges`
para `anon`, `authenticated` y `public`. Comprobado: `SELECT`, `INSERT`,
`UPDATE`, `DELETE` y `TRUNCATE` directos devuelven 401. Todo el acceso pasa por
cuatro funciones `SECURITY DEFINER`:

| Función | Qué hace |
| --- | --- |
| `fn_registrar_auditoria(…)` | Inserta. Es el **único** camino de escritura |
| `fn_listar_auditoria(filtros…, limite, desplazamiento)` | Página + total (`count(*) over()`) |
| `fn_resumen_auditoria(filtros…)` | Métricas de cabecera del filtro activo |
| `fn_filtros_auditoria()` | Valores presentes, para poblar los desplegables |

> El `revoke` es de **todos** los privilegios y no solo de las cuatro
> operaciones obvias: Supabase concede `ALL` por defecto sobre las tablas nuevas
> de `public`, y dejar `TRUNCATE` en pie permitiría vaciar la bitácora entera.

**La IP y el navegador los captura la base de datos**, leyendo
`current_setting('request.headers', true)` — no llegan como parámetro, así que
el cliente no puede falsearlos. Fuera de PostgREST esas cabeceras no existen y
la función las deja en `null` sin fallar.

### Cómo registrar una acción nueva

Una línea, en el **componente** (que es quien conoce la intención y el
desenlace), nunca en un servicio de datos:

```ts
private readonly auditoria = inject(AuditoriaService);

this.auditoria.registrar({
  modulo: 'Carga',                       // unión ModuloAuditoria
  accion: 'CARGAR_DOCUMENTO',            // unión AccionAuditoria
  observacion: 'Cargó la prefactura de Agosto 2026.',
  resultado: 'exito',                    // exito | advertencia | error
  entidad: 'documento',
  referencia: archivo.name,
  detalle: { lineas: 35 },               // jsonb libre
});
```

Quien llama solo dice **qué** pasó. El usuario, el rol y el periodo los añade el
servicio; la fecha, la IP y el navegador los añade la base de datos. Si necesitas
una acción o un módulo nuevos, **añádelos a las uniones** de
`core/models/auditoria.model.ts`: son tipos cerrados a propósito, para que dos
pantallas no registren lo mismo con nombres distintos y la bitácora siga siendo
filtrable.

### Reglas que no se pueden romper

1. **`registrar()` es *fire-and-forget* y nunca se espera con `await`.** En el
   bucle de envío de `entregar.ts` la cancelación depende de comprobar
   `this.epoch !== miEpoch` justo después de cada `await`; un `await` extra sin
   volver a comprobar dejaría correos huérfanos saliendo de un lote abandonado.
2. **Captura el contexto antes de que desaparezca.** `shell.logout()` registra
   *antes* de `auth.logout()`, porque después el usuario ya es `null`;
   `carga.confirmarEliminar()` lee el número de líneas antes de borrar, porque el
   detalle se elimina en cascada y el servicio no devuelve el conteo.
3. **Nunca dentro de un `effect()`**: se ejecutan al montar y en cada cambio de
   periodo, así que generarían una fila cada vez que alguien abre la pantalla.
4. **Nunca registres** contraseñas (solo `contrasenaCambiada: true|false`), las
   URL públicas de Storage (son enlaces abiertos: meterlos en el log los expone a
   quien lo lea) ni la clave del backend de correo.

### Limitación honesta

El «quién» sale de la sesión de `localStorage`, que es falsificable mientras no
haya autenticación real. La bitácora tiene valor operativo desde el primer día,
pero **no es prueba forense** hasta que exista Supabase Auth. La inmutabilidad,
en cambio, sí es efectiva desde ya.

---

## 6. Periodos, ciclo y facturas

### El periodo ya no está compilado

`PeriodId` era el tipo literal `'2026-08'`. Ahora el catálogo vive en la tabla
`periodos` y lo carga `PeriodosService`. Un administrador crea periodos desde el
encabezado; la unicidad de `(año, mes)` la garantiza la base de datos.

**La doble clave sigue viva y es la trampa número uno del proyecto:**

| Llamada | Devuelve | Se usa para |
| --- | --- | --- |
| `periodStore.period()` | `'2026-08'` | Prefijo de las rutas en Storage y clave de `periodos` |
| `periodStore.label()` | `'Agosto 2026'` | **Todas** las columnas `periodo_*` de la base de datos |

Si consultas una tabla con el id en vez de la etiqueta, no encontrarás nada y no
habrá ningún error: simplemente vendrán cero filas.

### El ciclo vive en `etapa_periodo`

`ProcesoStore` ha desaparecido. Sus tres banderas en `localStorage` eran por
navegador, no se compartían y se podían saltar desde DevTools. Ahora el avance
es una columna:

```
carga → validacion → agrupacion → revision → entrega → conciliacion → archivo → cerrado
```

- **Compuerta de entrada a un módulo**: `periodStore.alcanzo('revision')`.
- **«Ya se confirmó el paso»**: `periodStore.supero('revision')` — es lo que
  impide anular facturas una vez que se pasó a Entrega.
- **Avanzar**: `periodos.avanzar(id, 'entrega')`. La función SQL **ignora los
  retrocesos**, así que confirmar dos veces un módulo no deshace nada.
- **Retroceder**: solo `periodos.reabrir(id, etapa, motivo)`, con motivo
  obligatorio. Cargar de nuevo la prefactura o el registro interno lo hace
  automáticamente, porque invalida todo lo calculado después.

La línea del ciclo se pinta en el encabezado (`shell.html`) y es transversal a
todas las pantallas.

### La factura como entidad

Antes una factura era el resultado de agrupar `registro_facturacion_interna` por
`secuencial_facturacion_interna`, con el monto y la fecha repetidos en cada
línea del grupo. La tabla `facturas` elimina esa duplicación y da sitio a lo que
no lo tenía: `estado_factura` (`emitida · enviada · pagada · anulada`),
`fecha_envio_factura`, y todos los campos de conciliación.

- **`fn_sincronizar_facturas(periodo)`** regenera las facturas desde el registro
  interno tras cada carga. **Respeta las anuladas y las pagadas**: su estado
  manda sobre lo que diga una recarga del Excel.
- **La retención y el equivalente en COP los calcula la base de datos**
  (`fn_registrar_pago`), no el navegador, para que todas las pantallas muestren
  la misma cifra y quede guardada la TRM concreta de esa operación.
- **Los días transcurridos y el vencimiento** los calcula `fn_listar_facturas`
  contra el plazo parametrizado, por el mismo motivo.

### Parámetros de negocio

Retención, TRM por defecto, plazo de pago, destinatario del cliente, copias
fijas, plantilla del asunto y razón social están en la tabla `parametros`
(RF-CON-02, RF-ENV-02, RF-USR-02). **No vuelvas a escribir un correo ni un
porcentaje en el código**: el destinatario del cliente estuvo como constante en
`entregar.ts` y era justo lo que el requisito prohíbe.

### Notificaciones

`NotificacionesService` **no tiene tabla**: cada aviso se deriva del estado real
en el momento de mirarlo. Así no se queda obsoleto —desaparece solo cuando se
resuelve lo que lo originó— y no hay ciclo de vida que mantener. El aviso de
crear el periodo del mes siguiente aparece a partir del día 25 y desaparece en
cuanto el periodo existe.

Para añadir un aviso, amplía uno de los tres métodos privados de ese servicio.
Cada notificación enlaza al módulo que la resuelve (RF-DSH-03).

### Desviación consciente del SRS

**RF-ENV-01 pide tres adjuntos** —factura, orden de compra y Excel de aprobación
de prefactura— pero el aplicativo envía **solo los dos primeros**, por decisión
expresa. Si alguien audita el proyecto contra el documento de requisitos, esta
es la diferencia.

---

## 7. Convenciones del código

**Idioma — regla mixta y consistente**: español para el dominio nuevo conectado a
Supabase (`DocumentosService`, `guardarPrefactura`, `AuditoriaRow`), todas las
columnas y funciones SQL, los comentarios y **todos los mensajes de interfaz**;
inglés para la API de framework y los modelos de presentación heredados (`User`,
`OpResult`, `load()`). Si dudas: capa nueva → español.

**Patrón de servicio** (copia `usuarios.service.ts`):

```ts
@Injectable({ providedIn: 'root' })
export class XxxService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly _rows = signal<XxxRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');        // cadena vacía, nunca null
  readonly rows = this._rows.asReadonly();
  // …
  private friendly(error: PostgrestError): string { … }   // siempre el último
}
```

Sin `try/catch` alrededor de Supabase: se desestructura `{ data, error }` y se
usan guard clauses. Escrituras que devuelven `{ ok, error? }` y recargan con
`await this.load()`.

**Modelos**: `XxxInsert` = payload sin PK; `XxxRow extends XxxInsert` = fila
completa. Se anexan al final de `core/models/index.ts`.

**`null` vs `undefined`**: `null` para lo que viaja a la BD; `undefined` para «no
encontrado» y campos opcionales; `''` para las señales de error.

**Sistema de diseño**: todo está en `src/styles.css` (~1.500 líneas). Antes de
escribir una clase nueva, búscala: existen `card`, `card-h`, `ct`, `cd`, `sp`,
`tbl-wrap`, `table.dt`, `mini`/`ml`/`mv`/`ms`, `kpi-grid k4`, `btn-sm btn-solid`,
`btn-ghost`, `badge b-*`, `alert alert-*`, `modal-veil`/`modal-card`, `f-input`,
`cell-main`/`cell-av`/`cell-sub`, `seg`, `kv-row`, `empty-pill`, `note-line`.
Los `.css` de componente son solo para lo que no tiene equivalente global.

**Componentes**: `private readonly` para lo que la plantilla no usa,
`protected readonly` para lo que sí.

---

## 8. Trampas conocidas

1. **Doble clave de periodo.** En la BD el periodo es la etiqueta
   `"Agosto 2026"` (`periodStore.current().label`); en las rutas de Storage es el
   id `"2026-08"` (`periodStore.period()`). Confundirlos hace que no se
   encuentren los datos.
2. **El catálogo de periodos llega de forma asíncrona.** Los `effect()` de
   recarga deben salir temprano si `label()` está vacío; si no, consultarían con
   cadena vacía y traerían cero filas sin dar ningún error.
3. **Los pedidos de compra se enlazan por contención, no por igualdad.** Los
   archivos se guardan como «Pedido compra PCC-2026-02797» y el registro interno
   dice «PCC-2026-02797»: compararlos con `=` no casaba nunca, y por eso ninguna
   factura llegaba a tener su pedido adjunto en el correo. Un pedido con valor
   `'0'` significa «esta factura no tiene orden de compra», no un dato que falte.
4. **El Excel se parsea por índice de columna**, sin validar cabeceras. Si el
   cliente mueve una columna, los datos entran desplazados en silencio. Y siempre
   se lee la **hoja 0**.
5. **Sin transacciones en `documentos.service.ts`**: un fallo parcial deja
   archivos huérfanos en Storage o filas de detalle sin índice.
6. **Modelos huérfanos**: quedan varios modelos de presentación en inglés
   (`Invoice`, `ReconciliationRow`, `DocumentArchive`…) que ya no usa nadie: los
   módulos nuevos trabajan con `FacturaRow` y `DocumentoFacturacion`.
7. **`.slot-error` y `.slot-link` solo existen en `carga.css`**: usarlas en otra
   pantalla las deja sin estilo (ya pasa en `revisar.html`).
8. **`xlsx@0.18.5` solo lee** y arrastra vulnerabilidades conocidas. Para
   exportar, usa `core/utils/csv.util.ts`.

---

## 9. Trabajar en local

```bash
pnpm install
pnpm start        # http://localhost:4200
pnpm build
pnpm test         # Vitest
```

La configuración pública (URL de Supabase, clave publicable, URL y clave del
backend de correo) está en `src/environments/environment.ts` y
`environment.production.ts`, que **sí se versionan**. El `.env` de la raíz es
residuo: ninguna de sus 22 variables se usa, y el script `pnpm env:generate` que
menciona el README antiguo no existe.

**Antes de dar por terminado un cambio**: `pnpm build && pnpm test`.

## 10. Deuda pendiente (por gravedad)

1. **Seguridad**: las 3 tablas del ciclo tienen políticas RLS `using (true)` para
   `anon` y la clave publicable viaja en el bundle → la facturación es legible y
   escribible por cualquiera. Las contraseñas están **en texto plano** en
   `usuarios`. El bucket es público. La sesión de `localStorage` no está firmada:
   editarla concede rol `ADMIN`.
2. **Sin registro de envíos**: no se sabe si una factura ya se mandó ⇒ riesgo de
   doble envío al cliente. La bitácora lo mitiga, pero no lo impide.
3. **Cerrar un periodo**: la etapa `cerrado` existe en el modelo pero no hay
   todavía una acción que la active ni que bloquee la edición retroactiva.
4. **Informe consolidado en PDF** del periodo (pedido en `context/Cambios.txt`):
   no hay dependencia de PDF en el proyecto.
5. **Previsualización de archivos** sin salir del aplicativo: hoy Registros abre
   la URL pública de Storage en otra pestaña.
