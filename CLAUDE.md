# dev-front-facturacion-bee · Contexto para agentes

Aplicativo web del ciclo de facturación de **Bee Consultoría y Negocios**. Léelo
entero antes de tocar código: recoge qué está construido de verdad, qué es
fachada, las convenciones del proyecto y las trampas que ya han costado un bug.

> Actualizado el 2026-09-04.
>
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
| `entregar` | `/app/entregar` | **REAL** (§7) | Supabase + backend NestJS |
| `usuarios` | `/app/usuarios` | **REAL** (CRUD) | RPC |
| **`auditoria`** | `/app/auditoria` | **REAL** (§5) | Tabla `auditoria` vía RPC |
| `dashboard` | `/app/dashboard` | **REAL** · gráficos SVG propios | `facturas` + prefactura + `fn_resumen_periodos` |
| `conciliar` | `/app/conciliar` | **REAL** (RF-CON) · anula facturas ya enviadas | `facturas` vía RPC |
| `registros` | `/app/registros` | **REAL** (RF-DOC) | `documentos_facturacion` + Storage |
| `manuales` | `/app/manual-*` | Estático, con índice buscable | — |

**Ya no queda ninguna fachada.** `BillingDataService` y `EMPTY_DATASET` fueron
el andamiaje de esas tres pantallas mientras no tenían datos; hoy solo sobrevive
la matriz de permisos que pinta la pantalla de usuarios.

---

## 3. Arquitectura

```
src/app/
  core/        dominio: models · data · services (stores) · guards · utils
  shared/
    ui/        sistema de diseño, sin dominio: icon, badge, kpi-card,
               empty-state, modal, ciclo, direcciones, toc, grafico/
    facturas/  widgets de DOMINIO que usa más de una pantalla
  layout/      shell (barra lateral + encabezado)
  features/    una carpeta por módulo, lazy con loadComponent
```

**`shared/` tiene dos mitades y no se mezclan.** `ui/` no sabe nada del negocio y
podría llevarse a otro proyecto; `facturas/` sí lo sabe, pero tampoco pertenece a
un `feature` concreto porque lo comparten varios. Hoy solo vive ahí
`AnularFacturaDialog`, que usan Revisar y Conciliar: sus tres avisos —motivo
obligatorio, irreversibilidad y número quemado— tienen que decir lo mismo en los
dos sitios, y duplicarlos es pedir que diverjan.

### Componentes del sistema de diseño

| Componente | Para qué |
| --- | --- |
| `bee-modal` | **Todos** los diálogos. Foco atrapado, `Escape`, velo clicable y bloqueo del scroll de fondo. **No escribas un `.modal-veil` a mano** |
| `bee-ciclo` | La línea del ciclo. Variante `cinta` (encabezado) o `panel` (tablero). Fuente única: antes se pintaba de tres formas distintas, una con las etapas desfasadas |
| `bee-direcciones` | Campo de correos como pastillas, con validación por dirección |
| `bee-donut` · `bee-barras` · `bee-serie` | Los gráficos del tablero, en SVG propio |
| `bee-toc` | Índice de los manuales: buscador y apartado activo |
| `bee-icon` · `bee-badge` · `bee-kpi-card` · `bee-empty-state` · `bee-mark` | Piezas básicas |

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
| `EmailService` | Envía correos y **comprueba el buzón** del backend `dev-back-facturacion-bee` (§7) |

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
| `parametros` | Retención, TRM, destinatarios, plazos y prefijo de factura (§6) |

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
   Por eso `entregar.comprobarServicio()` recibe un `auditar`: la comprobación
   automática al abrir no deja rastro, y la que nace de pulsar «Enviar» o
   «Volver a comprobar», sí. Con el buzón caído, la primera habría escrito una
   fila por cada visita.
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
  manda sobre lo que diga una recarga del Excel. Devuelve **`jsonb`**
  (`{ creadas, omitidas, conflictos[] }`), no un entero: con la unicidad global
  del secuencial puede rechazar filas, y callárselo dejaría facturas fuera sin
  que nadie se entere.
- **La retención y el equivalente en COP los calcula la base de datos**
  (`fn_registrar_pago`), no el navegador, para que todas las pantallas muestren
  la misma cifra y quede guardada la TRM concreta de esa operación.
- **Los días transcurridos y el vencimiento** los calcula `fn_listar_facturas`
  contra el plazo parametrizado, por el mismo motivo.

### El secuencial es único para siempre, no por mes

`secuencial_factura` tiene una restricción **global**
(`facturas_secuencial_global_unico`), no `(periodo, secuencial)` como antes. Un
número de factura identifica un documento contable: es de la empresa, no del mes,
y **anular no lo libera**.

Cuatro barreras, en este orden:

1. **Carga** consulta `fn_verificar_secuenciales(periodo, secuenciales[])` al
   interpretar el Excel y avisa **antes** de guardar nada.
2. **`fn_sincronizar_facturas`** filtra los conflictivos antes del `insert` y los
   devuelve en su informe.
3. **La restricción de la base de datos** lo impide aunque se intente por SQL.
4. **`fn_siguiente_secuencial()`** propone siempre un número libre, calculado
   sobre `facturas` **y** `registro_facturacion_interna` de todos los periodos,
   anuladas incluidas. Sustituyó al cálculo local de `carga.ts`, que solo miraba
   las filas del periodo abierto y por eso reproponía números ya usados al abrir
   un mes nuevo.

> **Trampa al tocar la sincronización:** el `on conflict` apunta a
> `(periodo, secuencial)` y **no cubre** el índice global. Si se quita el filtro
> de conflictivos, un número repetido entre periodos aborta toda la
> sincronización con una violación de unicidad.

El prefijo (`BEE`) es el parámetro `prefijo_secuencial`, no un literal.

### Anular una factura

El diálogo es **uno solo** (`shared/facturas/anular-factura-dialog.ts`) y se monta
desde dos sitios con compuertas distintas, que es justo el matiz que hay que
respetar:

| Dónde | Quién | Cuándo |
| --- | --- | --- |
| **Revisar** | Admin | Solo **antes** de confirmar el paso a Entrega (`!supero('revision')`) |
| **Conciliar** | Admin | Cualquier estado salvo `pagada` y `anulada` |

La compuerta de Revisar **no sirve** en Conciliar: allí el periodo ya pasó de
`revision`, así que `!supero('revision')` sería siempre falsa y la acción nunca
se pintaría. Conciliar existe justo para el caso contrario: anular algo que el
cliente **ya recibió** y rechaza al momento de pagarlo.

`fn_anular_factura` rechaza anular una pagada, y `fn_registrar_pago` rechaza
pagar una anulada. Las dos direcciones están cerradas en la base de datos, no
solo en la interfaz.

### Parámetros de negocio

Retención, TRM por defecto, plazo de pago, destinatario del cliente, copias
fijas, plantilla del asunto, razón social y prefijo de factura están en la tabla
`parametros`
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

### Los tres adjuntos (RF-ENV-01, ya cumplido)

Cada correo lleva **tres** adjuntos, todos por URL de Storage:

| Adjunto | De dónde sale |
| --- | --- |
| Factura BEE | `registro_facturacion_interna.documento_factura_bee` |
| Pedido de Compra | `registro_facturacion_interna.documento_pedido_compra`, solo si la factura declara uno |
| Aprobación de Prefactura | `documentos_facturacion` con tipo `'Aprobación Prefactura'` — **el mismo para todo el periodo** |

El tercero se añadió cerrando la desviación que este documento declaraba antes.
Como es del periodo y no de la factura, `componerCorreos` lo recibe aparte en
`DatosDelPeriodo.aprobacion` y no lo busca en el registro interno.

El distintivo del adjunto (`fx-pdf`, `fx-xls`…) se deriva de la extensión con
`tipoDeArchivo()`: estaba fijado a PDF y anunciaba el Excel como si lo fuera.

---

## 7. Entrega al cliente: diagnóstico del buzón y correos editables

La pantalla `/app/entregar` compone un correo por factura, deja **editarlo** y
lo envía a través del backend. Tres piezas y una regla.

### El código vive repartido a propósito

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| Composición | `core/utils/correo.util.ts` | Función pura: entra el periodo con sus datos, sale el correo. Se prueba sin Angular (`correo.util.spec.ts`) |
| Formas | `core/models/correo.model.ts` | `PlantillaCorreo`, `EdicionCorreo`, `CorreoPreparado`, `DiagnosticoCorreo`, `EstadoEnvio` |
| Transporte | `core/services/email.service.ts` | `enviar()` y `verificarServicio()` |
| Pantalla | `features/entregar/` | Señales, selección, estado del lote y pintado |

El componente no compone correos: los pide. Es lo que permitió bajarlo de 890 a
620 líneas y probar la parte que de verdad tiene reglas.

### El estado del buzón: `verificarServicio()`

El backend expone `GET /api/email/verify`, que autentica por SMTP **sin enviar
nada** y devuelve por qué no puede enviar y **desde qué buzón** lo intenta. El
contrato completo está en el `CONSUMO.md` del backend.

`EmailService.verificarServicio()` nunca lanza y devuelve tres estados:

| Estado | Cuándo | Qué hace la pantalla |
| --- | --- | --- |
| `operativo` | `operativo: true` | Franja verde con el remitente. Se puede enviar |
| `caido` | `operativo: false` | Alerta con el titular y el buzón + modal con el detalle, la solución y el mensaje técnico. **Botón de enviar deshabilitado** |
| `indeterminado` | 404, 401, red caída | Aviso neutro. **No bloquea**: no se pudo preguntar, que no es lo mismo que un buzón caído |

**La regla que no se debe invertir:** se bloquea el envío por un diagnóstico
negativo, nunca por la ausencia de diagnóstico. Un backend desplegado sin el
endpoint devuelve 404, y bloquear ahí dejaría la aplicación inservible por una
causa que ni siquiera se ha confirmado.

Se comprueba al abrir la pantalla y **otra vez al pulsar Enviar**: entre una cosa
y otra el buzón puede haberse caído, y es peor descubrirlo factura a factura.

### Los correos editables

Destinatarios, copias, asunto y cuerpo se editan en la propia tarjeta. El patrón
es el mismo de `revisar.ts`: una señal de **sobrescrituras encima del computed
base**, no una copia del correo. Lo que no se toca sigue derivándose de los
datos, así que un cambio en la factura se refleja en los campos intactos y
respeta los editados.

- Se guardan en `localStorage` bajo **`bee.correos.<periodId>`** — el id
  (`2026-08`), no la etiqueta. Sobreviven a un F5, se limpian con «Restablecer».
- Toda lectura y escritura del almacenamiento va en `try/catch`: en modo privado
  lanza, y una pantalla de envío no puede caerse por eso.
- **Las direcciones son pastillas, no texto separado por comas** (`bee-direcciones`).
  Cada una se quita con su aspa, se añade con coma o Enter, y **la que está mal
  escrita se marca ella misma en rojo** — antes el aviso salía al pie de toda la
  tarjeta y no decía cuál era. Queda un modo texto para pegar listas enteras, que
  es como llegan del cliente.

### Distinguir lo enviado antes de volver a enviarlo

Es la parte que evita el error caro, así que tiene tres capas:

1. **Filtro segmentado** arriba: Todas · Por enviar · Ya enviadas.
2. **La tarjeta ya enviada** lleva raíl verde, fondo apagado y la fecha real del
   envío; si se marca a mano, el raíl pasa a rojo y aparece «Se reenviará».
3. **La confirmación enumera los secuenciales concretos** que se reenviarían con
   la fecha en que salieron la primera vez, y **exige marcar una casilla** para
   habilitar el botón. La casilla solo aparece cuando de verdad hay reenvíos:
   estorbar siempre la volvería invisible.

### La selección y los tres desenlaces

`seleccionManual` es `ReadonlySet<string> | null`. El `null` significa «el usuario
aún no ha elegido» y entonces se proponen las que quedan por entregar. Así la
propuesta se recalcula sola mientras cargan los datos, **sin un `effect()` que
escriba señales**.

Las ya enviadas quedan fuera de «Marcar pendientes», pero se pueden marcar a
mano: la confirmación avisa entonces de que el cliente recibiría la factura dos
veces.

Al terminar, cada factura queda en uno de estos estados, y el resumen los agrupa:

`pendiente` · `enviando` · `enviado` · `error` (con motivo y si merece reintento)
· `omitido` (seleccionada no, luego **sin enviar**)

`omitido` es la tercera respuesta que el usuario necesita. Sin marcarla, las que
no se intentaron serían indistinguibles de las que nadie ha tocado.

El desglose se pinta como **una barra proporcional** más el detalle de lo que
existe. Antes eran tres recuadros de colores al mismo peso, cada uno con una
columna de pastillas negras estiradas a todo el ancho —`.grupo` era
`flex-direction: column`—: con 19 correos bien y 1 mal, la imagen decía lo
contrario de lo que había pasado. Los grupos vacíos ya no se pintan.

### El mecanismo de `epoch`

`private epoch` se incrementa al cambiar de periodo, al pulsar «Detener el envío»
y al destruir el componente. El bucle lo comprueba **justo después de cada
`await`**. Es lo que impide que sigan saliendo correos de un lote abandonado, y
por eso `auditoria.registrar()` nunca se espera con `await` dentro de él (§5,
regla 1).

Los `marcarEnviada` son la excepción: van sueltos dentro del bucle —esperarlos
retrasaría el correo siguiente sin motivo— pero se confirman con
`Promise.allSettled` **antes** de recargar las facturas. Sin eso la recarga
adelantaba al último y la factura salía como no enviada hasta el siguiente
cambio de periodo.

Un correo ya entregado al servidor no se puede retirar: «Detener» corta los
siguientes, no el que está en vuelo. El texto de la interfaz lo dice.

### Un 200 con `rejected` cuenta como enviado

El servidor puede aceptar el mensaje y descartar algún destinatario. El correo
**salió** hacia los aceptados: reintentarlo duplicaría la factura en el buzón del
cliente. Se cuenta como enviado y se registra la advertencia aparte.

---

## 8. El sistema de diseño y el scroll

`src/styles.css` (~1.700 líneas). **Tailwind está instalado pero no se usa como
framework de utilidades**: no hay ni una clase utilitaria en las plantillas, solo
aporta su reset. No lo mezcles ahora: media clase utilitaria y media clase propia
es peor que cualquiera de los dos modelos.

### Tokens

| Familia | Uso |
| --- | --- |
| Color | Carbón (`--ink*`) + miel (`--honey*`) + semánticos `--ok` `--info` `--bad` `--warn`, cada uno con `-soft` y `-line` |
| Espaciado | `--sp-1` … `--sp-10` |
| Movimiento | `--dur-1` … `--dur-4` y `--ease-out`. **No escribas duraciones literales** |
| Elevación | `--shadow-xs` … `--shadow-xl`, siempre en dos capas: sombra de contacto corta + ambiental difusa |
| Viewport | `--app-h` (alto visible) y `--topbar-h` (alto del encabezado fijo) |

### El scroll: tres reglas que no se pueden romper

**El documento no se desplaza nunca.** El único panel con scroll es `.main`, y el
shell mide exactamente `--app-h` con `overflow: hidden`. Cada una de estas reglas
arregla un fallo que se dio de verdad:

1. **`overscroll-behavior: contain`** en todo contenedor con scroll. Sin él, al
   agotarse `.main` el scroll se encadena al documento.
2. **`.main` es `position: relative`.** Sin eso, un `.sr-only` —que es
   `position: absolute`— resuelve contra el bloque inicial y se coloca en
   coordenadas del **documento**: una etiqueta invisible a 1.100 px dentro del
   contenido desplazado estiraba el documento esos 1.100 px. Era la causa real de
   que la aplicación «se subiera y quedara en blanco» al llegar abajo del todo.
3. **El desenfoque del encabezado va en `.topbar::before`**, no en `.topbar`.
   `backdrop-filter` convierte al elemento en raíz de fondo y rompe el pintado de
   los descendientes que se salen de sus límites: el desplegable del ciclo en
   móvil aparecía transparente con el contenido de la página por encima.

Además: `html` mide `100%` pero `body` y `app-root` miden `--app-h`. Mezclar
`height: 100%` con `100dvh` fue la otra mitad del bug — en móvil, con la barra de
direcciones desplegada, el documento quedaba más alto que la aplicación
exactamente por esa diferencia.

### Adaptación a móvil

Puntos de corte reales en **1080 · 900 · 640 · 480**. Antes solo existía el de
1080 y nada contemplaba un teléfono.

- **Tablas**: `table.dt.dt-stack` convierte cada fila en una tarjeta por debajo de
  640 px, y el rótulo de cada celda sale de su `data-label`. **Si añades una
  columna, añade también su `data-label`**, o la tarjeta saldrá sin rótulo. La
  primera celda lleva `class="dt-head"` y hace de titular.
- Las que sigan con scroll horizontal llevan un degradado en los bordes de
  `.tbl-wrap` que avisa de que hay más a los lados.
- Objetivos táctiles ≥ 44 px.

---

## 9. Convenciones del código

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

## 10. Trampas conocidas

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
8. **Varias clases globales son selectores descendientes.** `.ti` solo existe
   como `.tile .ti` y `.fx` como `.doc-item .fx`: fuera de ese ancestro se
   quedan a medio pintar, sin error ni aviso. `entregar.css` redefine `.fx` en
   local y explica por qué; `.modal-ic` ya es global desde que existe
   `bee-modal`. Antes de reutilizar una clase de `styles.css`, comprueba si su
   regla tiene ancestro.
9. **`xlsx@0.18.5` solo lee** y arrastra vulnerabilidades conocidas. Para
   exportar, usa `core/utils/csv.util.ts`.
10. **`[value]` en un `<select>` con `@for` no basta.** Las opciones llegan
    después que el valor, así que el binding se evalúa contra una lista vacía y
    el desplegable se queda en la primera opción. El selector de periodo mostraba
    un mes mientras la pantalla trabajaba con otro. Hay que añadir `[selected]`
    en la `<option>`.
11. **Nada de `100vh` ni `100dvh` sueltos**: usa `--app-h`. Mezclar unidades de
    viewport entre el documento y el shell fue media causa del bug de scroll (§8).
12. **Un `sticky` dentro de un elemento de rejilla no se pega** si ese elemento
    mide exactamente lo que su contenido. El pegado va en el **host**, no en el
    hijo (`bee-toc` lo hace así), y su `top` tiene que descontar `--topbar-h` o
    quedará detrás del encabezado.

---

## 11. Trabajar en local

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

## 12. Deuda pendiente (por gravedad)

1. **Seguridad**: las 3 tablas del ciclo tienen políticas RLS `using (true)` para
   `anon` y la clave publicable viaja en el bundle → la facturación es legible y
   escribible por cualquiera. Las contraseñas están **en texto plano** en
   `usuarios`. El bucket es público. La sesión de `localStorage` no está firmada:
   editarla concede rol `ADMIN`.
2. **Habilitar SMTP AUTH** en el tenant de Microsoft 365. Mientras siga
   deshabilitado, Entregar no puede enviar aunque el código sea correcto.
3. **Registro de envíos incompleto**: la factura guarda su fecha de envío, y la
   pantalla ya avisa de los reenvíos, pero no se guarda el `messageId` ni los
   destinatarios reales de cada correo.
4. **Cerrar un periodo**: la etapa `cerrado` existe en el modelo pero no hay
   todavía una acción que la active ni que bloquee la edición retroactiva.
5. **Informe consolidado en PDF** del periodo (pedido en `context/Cambios.txt`):
   no hay dependencia de PDF en el proyecto.
6. **Previsualización de archivos** sin salir del aplicativo: hoy Registros abre
   la URL pública de Storage en otra pestaña.
7. **Multi-cliente**: se asume un único cliente y un único contrato. Los
   parámetros ya están fuera del código, pero no hay catálogo.
