# Facturación Bee · Aplicativo web

Aplicativo que apoya el **ciclo de vida, la gestión y la persistencia del proceso
de facturación a cliente** de **Bee Consultoría y Negocios** (`SRS-FACT-AUTO-2026-001`).
Sustituye el trabajo manual sobre plantillas de Excel por un flujo guiado,
validado y trazable.

Construido con **Angular 21** (standalone, zoneless, signals) y **Tailwind CSS v4**,
sobre **Supabase** (PostgreSQL + Storage) y desplegado en **Vercel**.

- 🤖 **Contexto técnico completo:** [`CLAUDE.md`](./CLAUDE.md) — qué está conectado,
  cómo funciona cada módulo, convenciones y trampas conocidas.

---

## Puesta en marcha

```bash
pnpm install
pnpm start        # http://localhost:4200
```

| Comando | Qué hace |
| --- | --- |
| `pnpm start` | Servidor de desarrollo |
| `pnpm build` | Build de producción en `dist/` |
| `pnpm test` | Pruebas unitarias (Vitest) |

> El gestor de paquetes es **pnpm**. No uses `npm install`: generaría un
> `package-lock.json` en conflicto con `pnpm-lock.yaml`.

La configuración pública —URL de Supabase, clave publicable, y URL y clave del
backend de correo— vive en `src/environments/environment.ts` y
`environment.production.ts`, y **se versiona**: son valores de cliente, no
secretos de servidor. `angular.json` sustituye uno por otro en el build de
producción.

---

## El ciclo, de principio a fin

| Módulo | Ruta | Estado |
| --- | --- | --- |
| Dashboard | `/app/dashboard` | **Operativo** |
| Carga de documentos | `/app/carga` | **Operativo** |
| Validar información | `/app/validar` | **Operativo** |
| Agrupar información | `/app/agrupar` | **Operativo** |
| Revisar facturas | `/app/revisar` | **Operativo** |
| Entregar al cliente | `/app/entregar` | **Operativo** |
| Conciliar cuentas | `/app/conciliar` | **Operativo** |
| Guardar registros | `/app/registros` | **Operativo** |
| Gestión de usuarios *(ADMIN)* | `/app/usuarios` | **Operativo** |
| Auditoría y logs *(ADMIN)* | `/app/auditoria` | **Operativo** |

Cada mes: se **cargan** los soportes del periodo (prefactura aprobada por el
cliente, registro interno de Bee, novedades y pedidos de compra), se **validan**
cotejando colaborador a colaborador, se **agrupan** por secuencial de factura,
se **revisan** las facturas emitidas y se **entregan** al cliente por correo con
sus PDF adjuntos.

Los diez módulos leen y escriben datos reales. `CLAUDE.md` detalla el estado de
cada uno, las convenciones del proyecto y las trampas a tener en cuenta.

### Periodos y avance del ciclo

El periodo de facturación se elige en el encabezado, ordenado del más reciente al
más antiguo, y **un administrador puede crear el siguiente** desde el botón junto
al selector: se valida que no exista y se pide confirmación.

La **línea del ciclo** del encabezado muestra en qué punto está el periodo y qué
etapas quedaron atrás. Avanza sola al confirmar cada módulo y queda guardada en
la base de datos, así que todo el equipo ve el mismo estado. Solo un
administrador puede reabrir una etapa anterior, indicando el motivo, que queda en
la bitácora.

### Notificaciones

La campana del encabezado reúne lo que requiere atención: el recordatorio de
crear el periodo del mes siguiente a partir del día 25, las discrepancias sin
resolver, las facturas sin datos de emisión o sin pedido de compra, las que están
por entregar y las vencidas sin pago. Cada aviso lleva al módulo que lo resuelve.

Los avisos se **derivan del estado real** en cada momento: no hay que marcarlos
como leídos porque desaparecen solos en cuanto se resuelve lo que los originó.

---

### Entrega al cliente

Con las facturas revisadas, la aplicación arma **un correo por factura** con su
asunto, sus copias controladas y **tres adjuntos**: la Factura BEE, el Pedido de
Compra cuando la factura declara uno, y el Excel de Aprobación de Prefactura del
periodo, que acompaña a todas.

Las copias reúnen a los **aprobadores de esa factura concreta** más las copias
fijas de la empresa, sin repetir a nadie. Tanto el destinatario como las copias
fijas y el asunto son parámetros de negocio: se cambian sin tocar código.

Antes de que nadie envíe nada, la pantalla **pregunta al servicio de correo si su
buzón puede enviar**. Si no puede, lo dice arriba con el buzón concreto que falla
y abre un aviso con la causa —por ejemplo, que el tenant de Microsoft 365 tiene
apagada la autenticación SMTP—, qué hay que hacer para resolverlo y el mensaje
exacto del servidor para soporte. Mientras tanto el botón de enviar queda
bloqueado, así que nadie pierde el tiempo preparando envíos que iban a fallar.
Si el servicio no responde a la comprobación, se avisa pero **no se bloquea**: no
haber podido preguntar no es lo mismo que un buzón caído.

Cada correo se puede **editar antes de enviarlo** —destinatarios, copias, asunto
y cuerpo—, y los cambios se recuerdan en el navegador aunque se recargue la
página; «Restablecer» devuelve el correo al generado. Los destinatarios y las
copias son **etiquetas independientes**: cada dirección se ve por separado, se
quita con su aspa y, si está mal escrita, se marca ella misma en rojo. Para pegar
una lista entera hay un modo texto.

**Distinguir lo que ya salió es lo que evita el error caro.** Un filtro separa
«Por enviar» de «Ya enviadas»; las enviadas llevan raíl verde y la fecha real del
envío, y no se marcan solas. Si se marca una a mano, su tarjeta pasa a rojo y
avisa. Y la confirmación final **enumera qué facturas se reenviarían y cuándo
salieron la primera vez**, y exige marcar una casilla antes de dejar continuar.

Los correos salen de uno en uno, con su progreso, y se puede detener el envío a
medias. Al terminar, el resultado se resume en una barra proporcional y se
detalla en tres grupos: **enviados**, **con error** —con el motivo y la opción de
reintentar los que lo merecen— y **sin enviar**, que son los que no se marcaron.

---

## Estructura

```
src/app/
  core/
    models/      modelos de dominio (espejo de las tablas) y de presentación
    data/        constantes y semillas
    services/    acceso a datos y estado global (signals)
    guards/      authGuard y adminGuard
    utils/       cotejo de montos, fechas, CSV, ZIP, lectura de Excel
  shared/
    ui/          sistema de diseño sin dominio: icon, badge, kpi-card,
                 empty-state, modal, ciclo, direcciones, toc y gráficos SVG
    facturas/    widgets de dominio que comparten varias pantallas
    pipes/       formato de moneda
  layout/shell/  barra lateral, encabezado y selector de periodo
  features/      una carpeta por módulo, con carga diferida
  environments/  configuración por entorno
supabase/
  schema.sql     esquema completo e idempotente
```

- **Presentación** sin lógica de negocio; **servicios y señales** orquestan;
  **dominio** (modelos y utilidades de cotejo, moneda y fecha) aislado y testeable.
- Identidad de marca centralizada en `src/styles.css` (tokens carbón y miel) con
  las tipografías embebidas localmente.

---

## Interfaz

La identidad es carbón y miel, con tipografía Jakarta para el texto y JBMono para
todo lo que sea una cifra o un código —el dinero y los números de factura se leen
mejor con anchos fijos—.

- **Un solo panel se desplaza.** El documento nunca hace scroll: el encabezado y
  la barra lateral quedan fijos y solo se mueve el contenido.
- **Los gráficos son SVG propio**, sin librería: el reparto por estado, la
  antigüedad de cobro y la evolución entre periodos.
- **Los diálogos son de verdad modales**: atrapan el foco, cierran con `Escape` y
  bloquean el fondo mientras están abiertos.
- **Móvil de primera clase.** Por debajo de 640 px las tablas se convierten en
  tarjetas con sus rótulos, la barra lateral pasa a cajón y la línea del ciclo se
  resume en «Paso 5 de 7» desplegable.
- Todo respeta `prefers-reduced-motion`.

---

## Manuales

El aplicativo lleva su propia documentación dentro, en
**Documentación → Manual de Usuario** y **Manual Técnico** (este último solo para
administradores). Ambos tienen índice fijo con buscador que marca el apartado que
se está leyendo.

- El **Manual de Usuario** cubre los siete módulos del ciclo, el tablero, la
  administración, la regla de numeración de facturas, un ejemplo completo de mes
  y las preguntas frecuentes.
- El **Manual Técnico** documenta el stack, la estructura, las ocho tablas, las
  funciones RPC, el contrato del servicio de correo, el sistema de diseño y la
  deuda pendiente.

---

## Datos

Ocho tablas en Supabase. Las columnas siguen la convención
`<concepto>_<sufijo_de_tabla>`.

| Tabla | Contenido |
| --- | --- |
| `usuarios` | Cuentas y roles. No se accede directamente: todo pasa por funciones y por la vista `vw_usuarios`, que no expone la contraseña |
| `documentos_facturacion` | Índice de los soportes subidos, con su URL en Storage |
| `aprobacion_prefactura` | Detalle del Excel que devuelve el cliente aprobado |
| `registro_facturacion_interna` | Detalle del Excel interno más los datos de emisión |
| `auditoria` | Bitácora inmutable de acciones |
| `periodos` | Periodos de facturación y etapa del ciclo de cada uno |
| `facturas` | Una fila por factura: estado, entrega y conciliación |
| `parametros` | Retención, TRM, destinatarios, asunto, plazos y prefijo de factura, todos configurables |

Los archivos se guardan en el bucket **`facturacion-bee`** de Supabase Storage,
en la ruta `{periodo}/{tipo}/{archivo}`.

> El esquema **no define claves foráneas**: las relaciones entre tablas son por
> igualdad de texto (el periodo y el código de colaborador). Está documentado en
> `CLAUDE.md` junto con el resto de trampas a tener en cuenta.

### Conciliación de cuentas

Cuando el banco notifica un ingreso se registra el pago contra su factura: fecha,
valor recibido, TRM aplicada y soporte. El sistema aplica la retención vigente
—12,5 % configurable—, guarda el valor retenido y el equivalente en pesos con la
TRM de esa operación concreta, y calcula los días transcurridos desde el envío.

Las facturas se distinguen por el código de color del proceso: verde pagada, azul
pendiente y rojo anulada o vencida. El consolidado del periodo separa lo
facturado, lo recibido, lo retenido y lo pendiente, y señala las facturas que
superaron el plazo acordado para activar la gestión de cobro.

Desde aquí un administrador también puede **anular una factura ya enviada**, que
es el caso real de una que el cliente rechaza al momento de pagarla. Se pide un
motivo, queda en la bitácora, y una factura ya pagada no se puede anular.

### Numeración de facturas

Un número de factura identifica **una sola factura en toda la historia de la
empresa**, no dentro de su mes. Anularla **no libera** el número: ni en ese
periodo ni en ninguno posterior.

Al cargar el registro interno, el aplicativo comprueba los números del Excel y
avisa —antes de guardar nada— si alguno ya está usado, diciendo a qué periodo
pertenece y en qué estado está. Esas líneas no se convierten en facturas. Y
siempre muestra cuál es el **siguiente número libre**, contando toda la historia.

### Conservación de registros

Los soportes del periodo se conservan organizados por tipo y se pueden buscar,
abrir individualmente o descargar todos juntos en un `.zip`. Cada descarga queda
registrada en la bitácora de auditoría.

---

## Auditoría y logs

Cada acción relevante queda registrada: inicios y cierres de sesión, intentos
fallidos, carga y borrado de documentos, validación, agrupación, revisión de
facturas, envío al cliente y gestión de cuentas. La pantalla `/app/auditoria`
—solo para administradores— permite filtrar por fecha, usuario, módulo, acción y
resultado, buscar en el texto, paginar y exportar a CSV.

Lo que distingue a este módulo:

- **La bitácora es inmutable.** La tabla tiene RLS activo sin políticas y todos
  los privilegios revocados: la escritura y la lectura solo ocurren a través de
  funciones `SECURITY DEFINER`. Ni la aplicación ni un administrador pueden
  modificar o eliminar un evento ya registrado.
- **La IP y el navegador los captura el servidor** leyendo las cabeceras de la
  petición, no un campo que envíe el cliente, así que no se pueden falsear.
- **Los desplegables se pueblan con los valores realmente presentes** en la
  bitácora, no con listas escritas a mano.

Son datos personales: conviene declararlo en la política de tratamiento de datos
de la empresa.

---

## Autenticación y roles

Dos roles: **ADMIN** y **USUARIO**. El acceso a Gestión de usuarios, Auditoría y
el manual técnico está restringido a administradores mediante `adminGuard`, y el
menú lateral se filtra en consecuencia.

> **Aviso importante.** Hoy la sesión se guarda sin firmar en el navegador y las
> contraseñas están en texto plano en la base de datos. El control de acceso es
> de interfaz, no de servidor. Migrar a Supabase Auth con JWT y cerrar las
> políticas por rol es la deuda más urgente del proyecto; `CLAUDE.md` la detalla
> en su sección 9.

## Despliegue

Vercel, con la configuración ya incluida en `vercel.json`: build con
`pnpm build`, salida en `dist/dev-front-facturacion-bee/browser` y reescritura de
todas las rutas a `index.html` para que funcione el enrutado del lado del cliente.

El servicio de correo es un backend aparte (`dev-back-facturacion-bee`); su
contrato —incluida la comprobación del buzón— está documentado en el
`CONSUMO.md` de ese repositorio.

> **El front no lee variables de entorno.** En el navegador no existe
> `process.env`: la configuración pública (URL de Supabase, clave publicable, URL
> y clave del backend) se compila dentro del JavaScript desde
> `src/environments/environment.production.ts`. No hace falta crear variables en
> Vercel para el front, y crearlas no tendría efecto. El `.env` de la raíz es
> residuo de un prototipo: ninguna de sus variables se usa.
