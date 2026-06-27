-- ============================================================================
--  Facturación Bee · Esquema de base de datos (PostgreSQL / Supabase)
--  Bee Consultoría y Negocios — Automatización del ciclo de facturación
--
--  Cubre el modelo de datos del SRS (sección 6), las reglas críticas
--  (cotejo, agrupación por orden, secuencial sin colisiones, retención + TRM,
--  bitácora inmutable) y los ajustes de Cambios.txt (auditoría con observación
--  y correo, usuarios, parametrización).
--
--  Orden de ejecución (Supabase SQL Editor o `supabase db push`):
--    extensiones → enums → utilidades → tablas → índices → triggers →
--    funciones de negocio → RLS y políticas → semillas.
--
--  Seguridad: RBAC validado en servidor mediante Row Level Security (RLS).
--  Las contraseñas NO viven aquí: las gestiona Supabase Auth (auth.users) con
--  hash bcrypt. `public.profiles` enlaza la cuenta de aplicación con su rol.
-- ============================================================================

-- ── Extensiones ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;       -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- ── Enumeraciones ───────────────────────────────────────────────────────────
do $$ begin create type user_role        as enum ('ADMIN','USUARIO');                       exception when duplicate_object then null; end $$;
do $$ begin create type account_status   as enum ('activa','inactiva');                     exception when duplicate_object then null; end $$;
do $$ begin create type currency_code     as enum ('USD','COP');                             exception when duplicate_object then null; end $$;
do $$ begin create type purchase_type     as enum ('OPEX','CAPEX');                          exception when duplicate_object then null; end $$;
do $$ begin create type contract_type     as enum ('MOP','OTRA_LINEA');                      exception when duplicate_object then null; end $$;
do $$ begin create type oc_status         as enum ('recibido','no_recibido');                exception when duplicate_object then null; end $$;
do $$ begin create type period_status     as enum ('abierto','validado','agrupado','emitido','conciliado','cerrado'); exception when duplicate_object then null; end $$;
do $$ begin create type prefactura_state  as enum ('borrador','aprobada');                   exception when duplicate_object then null; end $$;
do $$ begin create type validation_status as enum ('coincide','discrepancia','sin_mop');     exception when duplicate_object then null; end $$;
do $$ begin create type invoice_status    as enum ('pendiente','pagada','anulada');          exception when duplicate_object then null; end $$;
do $$ begin create type doc_kind          as enum ('xls','pdf','doc','img');                 exception when duplicate_object then null; end $$;
do $$ begin create type upload_slot       as enum ('prefactura','pedido','registro','novedades'); exception when duplicate_object then null; end $$;

-- ── Utilidades ──────────────────────────────────────────────────────────────
-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ¿El usuario autenticado es ADMIN activo?  (usada en las políticas RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.status = 'activa'
  );
$$;

-- ¿Hay sesión válida?
create or replace function public.is_authenticated()
returns boolean language sql stable as $$
  select auth.uid() is not null;
$$;

-- ============================================================================
--  1. Seguridad y configuración
-- ============================================================================

-- Perfil de aplicación (1:1 con auth.users). Cambios.txt §1
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text        not null,
  correo       text        not null unique,          -- correo único
  area         text        not null,
  rol          user_role   not null default 'USUARIO',
  estado       account_status not null default 'activa',
  ultimo_acceso timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Parámetros del negocio (RF-USR-02 / RNF-MA-02): clave-valor tipado.
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  descripcion text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

-- ============================================================================
--  2. Catálogos del dominio
-- ============================================================================

-- Cliente al que se factura (p. ej. Banistmo)
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null unique,
  etiqueta_aliado   text,
  moneda            currency_code not null default 'USD',
  -- Destinatarios de envío (RF-ENV-02): cliente, aprobador, copias
  email_cliente     text,
  email_aprobador   text,
  email_proyectos   text,
  email_financiera  text,
  porcentaje_retencion numeric(5,4) not null default 0.1250,  -- 12,5%
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Contrato bajo el cual se prestan los servicios (BI-VSC-15479-2022-001)
create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null unique,
  client_id     uuid not null references public.clients(id),
  tipo          contract_type not null default 'MOP',
  vigente       boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Talento / colaborador cuyo servicio se factura
create table if not exists public.talents (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique,                 -- Código del colaborador
  nombre        text not null,
  rol_mop       text,
  contract_id   uuid references public.contracts(id),
  email_aprobador text,
  created_at    timestamptz not null default now()
);

-- ============================================================================
--  3. Periodo de facturación
-- ============================================================================

-- Un periodo = mes/año por cliente (selector «Periodo» del encabezado)
create table if not exists public.periods (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id),
  anio          int  not null,
  mes           int  not null check (mes between 1 and 12),
  etiqueta      text not null,                -- «Abril 2026»
  estado        period_status not null default 'abierto',
  -- N.º de última factura del periodo anterior (Cambios.txt §4.2)
  ultima_factura_anterior text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, anio, mes)
);

-- Órdenes / pedidos de compra del cliente (PCC-2026-xxxxx). Pueden ser N por periodo.
create table if not exists public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  numero        text not null,
  client_id     uuid not null references public.clients(id),
  period_id     uuid references public.periods(id),
  estado_recepcion oc_status not null default 'recibido',
  created_at    timestamptz not null default now(),
  unique (numero, period_id)
);

-- ============================================================================
--  4. Prefactura aprobada (entrada del ciclo · plantilla PrefacturaAprobada)
-- ============================================================================
create table if not exists public.prefacturas (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references public.periods(id) on delete cascade,
  contract_id   uuid references public.contracts(id),   -- un solo contrato por Excel
  estado        prefactura_state not null default 'aprobada',
  importada_en  timestamptz not null default now(),
  importada_por uuid references public.profiles(id),
  unique (period_id)                                    -- 1 prefactura por periodo
);

-- Línea por talento/novedad (hoja «Detalle»)
create table if not exists public.prefactura_lines (
  id                 uuid primary key default gen_random_uuid(),
  prefactura_id      uuid not null references public.prefacturas(id) on delete cascade,
  talent_id          uuid references public.talents(id),
  codigo_colaborador text,
  nombre_colaborador text not null,
  rol_mop            text,
  tipo_compra        purchase_type,            -- NULL si viene vacío (Cambios.txt §4.1)
  entrega_valor      text,
  id_proyecto        text,
  nombre_proyecto    text,
  tarifa             numeric(14,2),
  desglose_novedad   text,
  hora_novedad       numeric(10,4),
  tarifa_hora        numeric(14,6),
  monto_novedad      numeric(14,2),
  monto_facturar     numeric(14,2) not null,
  porcentaje_compartido numeric(5,2),
  comentarios_proveedor text,
  comentarios_capacidad text,
  radicar_factura_a  text,
  lider_aprobador    text,
  comentarios_lider  text,
  aprobado           boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ============================================================================
--  5. Registro interno y cotejo de validación (RF-VAL)
-- ============================================================================

-- Línea del registro interno (plantilla RegistroInternoBee · hoja «Registro»)
create table if not exists public.internal_records (
  id                 uuid primary key default gen_random_uuid(),
  period_id          uuid not null references public.periods(id) on delete cascade,
  secuencia_factura  text,                       -- BEE700…
  purchase_order_id  uuid references public.purchase_orders(id),
  codigo_colaborador text,
  nombre_colaborador text not null,
  moneda             currency_code not null default 'USD',
  monto_facturar     numeric(14,2) not null,
  valor_en_letras    text,
  created_at         timestamptz not null default now()
);

-- Resultado del cotejo prefactura vs. registro interno (RF-VAL-02 / RF-VAL-04)
create table if not exists public.validation_items (
  id                 uuid primary key default gen_random_uuid(),
  period_id          uuid not null references public.periods(id) on delete cascade,
  prefactura_line_id uuid references public.prefactura_lines(id) on delete cascade,
  internal_record_id uuid references public.internal_records(id),
  nombre_colaborador text not null,
  rol_mop            text,
  monto_prefactura   numeric(14,2),
  monto_registro     numeric(14,2),
  -- Diferencia exacta (incluye centavos); generada por el motor de validación
  diferencia         numeric(14,2) generated always as
                       (coalesce(monto_prefactura,0) - coalesce(monto_registro,0)) stored,
  estado             validation_status not null,
  resuelto           boolean not null default false,
  resuelto_por       uuid references public.profiles(id),
  resuelto_en        timestamptz,
  created_at         timestamptz not null default now()
);

-- ============================================================================
--  6. Agrupación y facturas (RF-AGR / RF-REV)
-- ============================================================================

-- Secuencias de factura por prefijo, para numeración atómica sin colisiones.
create table if not exists public.invoice_sequences (
  prefix     text primary key,
  last_value int  not null default 0
);

-- Factura agrupada (una por orden de compra · RF-AGR-01)
create table if not exists public.invoices (
  id                 uuid primary key default gen_random_uuid(),
  period_id          uuid not null references public.periods(id) on delete cascade,
  client_id          uuid not null references public.clients(id),
  secuencia          text not null unique,        -- BEE702 (RF-AGR-02)
  purchase_order_id  uuid references public.purchase_orders(id),
  tipo_compra        purchase_type,
  descripcion        text,
  moneda             currency_code not null default 'USD',
  monto_facturar     numeric(14,2) not null,
  valor_en_letras    text,
  estado             invoice_status not null default 'pendiente',
  -- Cotejo de la factura emitida por el outsourcing (RF-REV-02)
  monto_emitido      numeric(14,2),
  emision_conforme   boolean,
  fecha_envio        date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Líneas que componen una factura (talentos consolidados)
create table if not exists public.invoice_lines (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid not null references public.invoices(id) on delete cascade,
  prefactura_line_id uuid references public.prefactura_lines(id),
  nombre_colaborador text not null,
  rol_mop            text,
  entrega_valor      text,
  monto_facturar     numeric(14,2) not null
);

-- ============================================================================
--  7. Pagos y conciliación (RF-CON)
-- ============================================================================

-- Tasa Representativa del Mercado (trazabilidad de TRM por fecha · RF-CON-02)
create table if not exists public.exchange_rates (
  fecha     date primary key,
  trm       numeric(12,4) not null,
  fuente    text not null default 'DIAN'
);

-- Pago recibido contra una factura (RF-CON-01)
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid not null references public.invoices(id) on delete cascade,
  fecha_notificacion date not null,
  valor_recibido     numeric(14,2) not null,
  dias_para_pago     int,
  soporte_path       text,                       -- doc mesa de dinero (Storage)
  created_at         timestamptz not null default now()
);

-- Cierre financiero de la factura (RF-CON-02/03)
create table if not exists public.reconciliations (
  id                 uuid primary key default gen_random_uuid(),
  invoice_id         uuid not null references public.invoices(id) on delete cascade unique,
  porcentaje_retencion numeric(5,4) not null default 0.1250,
  valor_retenido     numeric(14,2),
  trm                numeric(12,4),
  monto_cop_reportado numeric(18,2),
  monto_cop_esperado  numeric(18,2),
  valor_final_recibido numeric(14,2),
  fecha_negociacion  date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================================
--  8. Documentos conservados (RF-DOC) — referencias a Supabase Storage
-- ============================================================================
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references public.periods(id) on delete cascade,
  slot          upload_slot not null,            -- los 4 tipos de carga
  kind          doc_kind not null,
  nombre        text not null,
  storage_path  text not null,                   -- bucket «facturacion/...»
  size_bytes    bigint check (size_bytes <= 5 * 1024 * 1024),  -- máx. 5 MB
  uploaded_by   uuid references public.profiles(id),
  uploaded_at   timestamptz not null default now()
);

-- ============================================================================
--  9. Bitácora de auditoría — INMUTABLE (RF-LOG · Cambios.txt §2)
-- ============================================================================
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  ocurrido_en  timestamptz not null default now(),  -- fecha y hora
  user_id      uuid references public.profiles(id),
  usuario      text not null,                       -- nombre (desnormalizado)
  correo       text not null,                       -- correo del usuario
  accion       text not null,
  modulo       text not null,
  observacion  text                                 -- antes «entidad»
);

-- ── Índices ─────────────────────────────────────────────────────────────────
create index if not exists idx_periods_client          on public.periods(client_id, anio, mes);
create index if not exists idx_prefactura_lines_pref    on public.prefactura_lines(prefactura_id);
create index if not exists idx_internal_records_period  on public.internal_records(period_id);
create index if not exists idx_validation_period        on public.validation_items(period_id, estado);
create index if not exists idx_invoices_period          on public.invoices(period_id, estado);
create index if not exists idx_invoice_lines_invoice    on public.invoice_lines(invoice_id);
create index if not exists idx_payments_invoice         on public.payments(invoice_id);
create index if not exists idx_documents_period_slot    on public.documents(period_id, slot);
create index if not exists idx_audit_when               on public.audit_log(ocurrido_en desc);
create index if not exists idx_audit_user               on public.audit_log(user_id);

-- ── Triggers updated_at ─────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','clients','periods','invoices','reconciliations'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on public.%1$s;
       create trigger trg_%1$s_updated before update on public.%1$s
       for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ============================================================================
--  10. Reglas de negocio
-- ============================================================================

-- Secuencial de factura atómico, sin colisiones (RF-AGR-02).
-- El UPDATE toma un lock de fila → dos procesos concurrentes nunca colisionan.
create or replace function public.next_invoice_number(p_prefix text default 'BEE')
returns text language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into public.invoice_sequences(prefix, last_value)
    values (p_prefix, 0) on conflict (prefix) do nothing;
  update public.invoice_sequences
     set last_value = last_value + 1
   where prefix = p_prefix
  returning last_value into v;
  return p_prefix || v::text;
end $$;

-- Inmutabilidad de la bitácora: ni el ADMIN puede editar o borrar (RF-LOG-03).
create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'La bitácora de auditoría es inmutable (RF-LOG-03).';
end $$;

drop trigger if exists trg_audit_immutable on public.audit_log;
create trigger trg_audit_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_mutation();

-- Registrar un evento de auditoría desde la aplicación.
create or replace function public.log_event(p_accion text, p_modulo text, p_observacion text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  insert into public.audit_log(user_id, usuario, correo, accion, modulo, observacion)
  values (auth.uid(), coalesce(p.nombre,'sistema'), coalesce(p.correo,'-'), p_accion, p_modulo, p_observacion);
end $$;

-- Al crear una cuenta en auth.users, crear su perfil (trigger de Supabase Auth).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, correo, area, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'area', 'Sin asignar'),
    coalesce((new.raw_user_meta_data->>'rol')::user_role, 'USUARIO')
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  11. Row Level Security (RBAC validado en servidor · RF-AUT-02)
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.app_settings      enable row level security;
alter table public.clients           enable row level security;
alter table public.contracts         enable row level security;
alter table public.talents           enable row level security;
alter table public.periods           enable row level security;
alter table public.purchase_orders   enable row level security;
alter table public.prefacturas       enable row level security;
alter table public.prefactura_lines  enable row level security;
alter table public.internal_records  enable row level security;
alter table public.validation_items  enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.invoices          enable row level security;
alter table public.invoice_lines     enable row level security;
alter table public.exchange_rates    enable row level security;
alter table public.payments          enable row level security;
alter table public.reconciliations   enable row level security;
alter table public.documents         enable row level security;
alter table public.audit_log         enable row level security;

-- Perfiles: cada quien ve el suyo; el ADMIN gestiona todos (Cambios.txt §1)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Parámetros y catálogos: lectura para todos; escritura solo ADMIN (RF-USR-02)
do $$
declare t text;
begin
  foreach t in array array['app_settings','clients','contracts'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s;
      create policy %1$s_read on public.%1$s for select using (public.is_authenticated());', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s;
      create policy %1$s_admin on public.%1$s for all
        using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- Datos operativos: cualquier usuario autenticado opera; borrar solo ADMIN.
-- (La matriz de permisos permite a USUARIO cargar/validar/agrupar/entregar/conciliar.)
do $$
declare t text;
begin
  foreach t in array array[
    'talents','periods','purchase_orders','prefacturas','prefactura_lines',
    'internal_records','validation_items','invoices','invoice_lines',
    'exchange_rates','payments','reconciliations','documents'
  ] loop
    execute format('drop policy if exists %1$s_select on public.%1$s;
      create policy %1$s_select on public.%1$s for select using (public.is_authenticated());', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s;
      create policy %1$s_insert on public.%1$s for insert with check (public.is_authenticated());', t);
    execute format('drop policy if exists %1$s_update on public.%1$s;
      create policy %1$s_update on public.%1$s for update
        using (public.is_authenticated()) with check (public.is_authenticated());', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s;
      create policy %1$s_delete on public.%1$s for delete using (public.is_admin());', t);
  end loop;
end $$;

-- Secuencias de factura: solo el motor (security definer) las toca; lectura ADMIN.
drop policy if exists seq_admin_read on public.invoice_sequences;
create policy seq_admin_read on public.invoice_sequences for select using (public.is_admin());

-- Bitácora: cualquiera autenticado inserta; solo ADMIN consulta; nadie edita/borra.
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert with check (public.is_authenticated());
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());
-- (sin políticas de UPDATE/DELETE + trigger de inmutabilidad ⇒ no se pueden modificar)

-- ============================================================================
--  12. Semillas mínimas (parámetros + cliente real)
-- ============================================================================
insert into public.app_settings (key, value, descripcion) values
  ('invoice_prefix',      'BEE',    'Prefijo del consecutivo de factura'),
  ('retention_rate',      '0.1250', 'Porcentaje de retención por defecto (12,5%)'),
  ('payment_term_days',   '30',     'Plazo de pago acordado (días)'),
  ('report_currency',     'COP',    'Moneda de reporte fiscal (TRM)')
on conflict (key) do nothing;

-- Continuar la secuencia desde la última factura real (BEE699 ⇒ siguiente BEE700)
insert into public.invoice_sequences (prefix, last_value) values ('BEE', 699)
on conflict (prefix) do nothing;

insert into public.clients (nombre, etiqueta_aliado, moneda, email_cliente, email_aprobador, email_proyectos, email_financiera)
values ('Banistmo', 'BEE CONSULTORIA Y NEGOCIOS SAS', 'USD',
        'cuentas.porpagar@banistmo.com', 'aprobador@banistmo.com',
        'proyectos@beeconsultoria.com', 'financiera@beeconsultoria.com')
on conflict (nombre) do nothing;

insert into public.contracts (numero, client_id, tipo)
select 'BI-VSC-15479-2022-001', c.id, 'MOP' from public.clients c where c.nombre = 'Banistmo'
on conflict (numero) do nothing;

-- ============================================================================
--  NOTA · Supabase Storage (RF-DOC)
--  Crear un bucket privado «facturacion» y políticas equivalentes:
--    - SELECT/INSERT para usuarios autenticados sobre objects del bucket.
--    - Estructura de rutas:  {anio}/{mes}/{slot}/{archivo}
--  La tabla public.documents guarda la referencia (storage_path) de cada archivo.
-- ============================================================================
