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
    ui/          sistema de diseño: icon, badge, kpi-card, empty-state, stepper
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
| `parametros` | Retención, TRM, destinatarios y plazos configurables |

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
contrato está documentado en el `CONSUMO.md` de ese repositorio.
