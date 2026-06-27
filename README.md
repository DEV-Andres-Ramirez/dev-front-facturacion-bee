# Facturación Bee · Módulo de Automatización

Aplicativo web que automatiza el ciclo de facturación a cliente de **Bee Consultoría y
Negocios**, según la especificación de requisitos (`SRS-FACT-AUTO-2026-001`). Reemplaza el
trabajo manual sobre plantillas de Excel por un flujo guiado, validado y trazable, con la
identidad de marca de Bee (carbón + miel).

Construido con **Angular 21** (standalone, zoneless, signals) y **Tailwind CSS v4**.

## El ciclo, de principio a fin

Las **7 actividades automatizadas** del alcance, más los módulos transversales:

| Módulo | Ruta | Requisito |
| --- | --- | --- |
| Dashboard | `/app/dashboard` | RF-DSH |
| Carga de documentos | `/app/carga` | RF-VAL-01 |
| Validar información | `/app/validar` | RF-VAL |
| Agregar talentos | `/app/talentos` | RF-TAL |
| Agrupar información | `/app/agrupar` | RF-AGR |
| Revisar facturas | `/app/revisar` | RF-REV |
| Entregar al cliente | `/app/entregar` | RF-ENV |
| Conciliar cuentas | `/app/conciliar` | RF-CON |
| Guardar registros | `/app/registros` | RF-DOC |
| Gestión de usuarios *(solo ADMIN)* | `/app/usuarios` | RF-USR |
| Auditoría y logs *(solo ADMIN)* | `/app/auditoria` | RF-LOG |

## Selector de periodo

El encabezado incluye un combo **«Periodo»** con dos opciones:

- **Mayo 2026** — carga datos de ejemplo de extremo a extremo (3 facturas, validación con
  discrepancias, conciliación con retención y TRM, archivo documental, bitácora).
- **Junio 2026** — deja **todo el proceso en blanco**, como quien lo inicia desde cero: cada
  pantalla muestra su estado vacío invitando a comenzar por la carga de la prefactura.

El periodo es estado global (`PeriodStore`, signal) del que derivan todas las pantallas.

## Variables de entorno

Los **tokens de acceso** y los **parámetros de negocio** viven en `.env` (no versionado), nunca
en el código fuente — cumpliendo RNF-MA-02 y RF-USR-02. Se inyectan en tiempo de compilación:

```bash
cp .env.example .env          # completa los valores
pnpm env:generate             # genera src/environments/environment.generated.ts
```

`pnpm start` y `pnpm build` ejecutan el generador automáticamente. Variables principales:
retención (12,5%), prefijo y secuencial de factura, correos destino, repositorio documental y
tokens de sesión de los perfiles demo.

## Puesta en marcha

```bash
pnpm install
pnpm start            # genera el entorno y levanta http://localhost:4200
```

Accesos de demostración (acceso rápido en el login):

- **Viviana Álvarez** — Administrador · Dirección Operativa
- **Carolina Forero** — Usuario · Área Financiera

## Comandos

```bash
pnpm start     # servidor de desarrollo (regenera .env)
pnpm build     # build de producción en dist/
pnpm test      # pruebas unitarias (Vitest)
```

## Arquitectura (Clean Code · por capas)

```
src/app/
  core/        dominio puro: models · data (semillas) · services (stores) · guards · utils · config
  shared/      sistema de diseño: ui (icon, bee-mark, badge, kpi, empty-state, stepper) · pipes
  layout/      shell de la aplicación (barra lateral + encabezado)
  features/    una característica por carpeta, con carga diferida (lazy) y standalone
```

- **Presentación** sin lógica de negocio; **servicios/señales** orquestan; **dominio** (modelos,
  utilidades de cotejo/estado/moneda) aislado y testeable; **transversal**: RBAC y configuración
  externa.
- Identidad de marca centralizada en `src/styles.css` (tokens carbón/miel) y tipografías de marca
  embebidas localmente.
