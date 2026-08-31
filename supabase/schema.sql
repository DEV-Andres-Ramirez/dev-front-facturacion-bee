-- ============================================================================
--  Facturación Bee · Esquema de base de datos (PostgreSQL / Supabase)
--  Bee Consultoría y Negocios — Automatización del ciclo de facturación
--
--  Se construye módulo por módulo. Ejecuta este archivo completo en el
--  SQL Editor de Supabase (es idempotente: se puede re-ejecutar sin romper).
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
--  MÓDULO 1 · USUARIOS Y ACCESO
--  Autenticación contra tabla propia. Las contraseñas NO se exponen al cliente:
--  el login se valida con una función SECURITY DEFINER y la lectura va por una
--  vista sin la columna de contraseña.
--  NOTA: sin Supabase Auth, las operaciones corren como rol anónimo y el control
--  de administrador es por interfaz. Endurecer con JWT + RLS al adoptar Auth.
-- ════════════════════════════════════════════════════════════════════════════

-- Secuencia para el id autoincremental de tipo texto ('1', '2', '3', …)
create sequence if not exists public.usuarios_id_seq;

create table if not exists public.usuarios (
  id_usuario            text        primary key default nextval('public.usuarios_id_seq')::text,
  nombre_usuario        text        not null,
  correo_usuario        text        not null unique,
  contrasena_usuario    text        not null,
  area_usuario          text        not null,
  admin_usuario         boolean     not null default false,
  ultimo_acceso_usuario timestamptz not null default now(),
  estado_usuario        boolean     not null default true
);

alter sequence public.usuarios_id_seq owned by public.usuarios.id_usuario;

-- ── Row Level Security ──────────────────────────────────────────────────────
-- La tabla NO se expone directamente al rol anónimo: la lectura va por la vista
-- vw_usuarios (sin contraseña) y TODA escritura por funciones SECURITY DEFINER
-- (definidas abajo). Con RLS activado y sin políticas, el acceso directo queda
-- denegado, lo que protege las contraseñas y centraliza la lógica.
alter table public.usuarios enable row level security;

drop policy if exists usuarios_insert on public.usuarios;
drop policy if exists usuarios_update on public.usuarios;
revoke insert, update, delete on public.usuarios from anon, authenticated;

-- ── Vista pública (sin contraseña) para listar usuarios ─────────────────────
create or replace view public.vw_usuarios
with (security_invoker = false) as
  select id_usuario, nombre_usuario, correo_usuario, area_usuario,
         admin_usuario, ultimo_acceso_usuario, estado_usuario
  from public.usuarios;

grant select on public.vw_usuarios to anon, authenticated;

-- ── Login: valida credenciales y actualiza el último acceso ─────────────────
create or replace function public.fn_login(p_correo text, p_contrasena text)
returns table (
  id_usuario            text,
  nombre_usuario        text,
  correo_usuario        text,
  area_usuario          text,
  admin_usuario         boolean,
  ultimo_acceso_usuario timestamptz,
  estado_usuario        boolean
)
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  select u.id_usuario into v_id
  from public.usuarios u
  where lower(u.correo_usuario) = lower(trim(p_correo))
    and u.contrasena_usuario = p_contrasena
    and u.estado_usuario = true
  limit 1;

  if v_id is null then
    return;                         -- sin coincidencia ⇒ resultado vacío
  end if;

  -- Se califica la columna con alias para evitar ambigüedad con las columnas
  -- de salida de RETURNS TABLE (error 42702).
  update public.usuarios as u set ultimo_acceso_usuario = now() where u.id_usuario = v_id;

  return query
    select u.id_usuario, u.nombre_usuario, u.correo_usuario, u.area_usuario,
           u.admin_usuario, u.ultimo_acceso_usuario, u.estado_usuario
    from public.usuarios u where u.id_usuario = v_id;
end $$;

grant execute on function public.fn_login(text, text) to anon, authenticated;

-- ── Actualizar último acceso al realizar acciones en la app ─────────────────
create or replace function public.fn_touch_acceso(p_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.usuarios set ultimo_acceso_usuario = now() where id_usuario = p_id;
end $$;

grant execute on function public.fn_touch_acceso(text) to anon, authenticated;

-- ── Crear cuenta (SECURITY DEFINER · ignora RLS, protege la contraseña) ─────
create or replace function public.fn_crear_usuario(
  p_nombre text, p_correo text, p_contrasena text, p_area text,
  p_admin boolean, p_estado boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  insert into public.usuarios
    (nombre_usuario, correo_usuario, contrasena_usuario, area_usuario, admin_usuario, estado_usuario)
  values
    (p_nombre, lower(trim(p_correo)), p_contrasena, p_area, p_admin, p_estado)
  returning id_usuario into v_id;
  return v_id;
end $$;

grant execute on function public.fn_crear_usuario(text, text, text, text, boolean, boolean)
  to anon, authenticated;

-- ── Editar cuenta (la contraseña solo se cambia si se envía) ────────────────
create or replace function public.fn_actualizar_usuario(
  p_id text, p_nombre text, p_correo text, p_area text,
  p_admin boolean, p_estado boolean, p_contrasena text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.usuarios as u set
    nombre_usuario     = p_nombre,
    correo_usuario     = lower(trim(p_correo)),
    area_usuario       = p_area,
    admin_usuario      = p_admin,
    estado_usuario     = p_estado,
    contrasena_usuario = case
                           when p_contrasena is null or p_contrasena = ''
                           then u.contrasena_usuario
                           else p_contrasena
                         end
  where u.id_usuario = p_id;
end $$;

grant execute on function public.fn_actualizar_usuario(text, text, text, text, boolean, boolean, text)
  to anon, authenticated;

-- ── Habilitar / deshabilitar cuenta ─────────────────────────────────────────
create or replace function public.fn_set_estado_usuario(p_id text, p_estado boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.usuarios as u set estado_usuario = p_estado where u.id_usuario = p_id;
end $$;

grant execute on function public.fn_set_estado_usuario(text, boolean) to anon, authenticated;

-- ── Semilla: cuentas iniciales ──────────────────────────────────────────────
insert into public.usuarios
  (id_usuario, nombre_usuario, correo_usuario, contrasena_usuario, area_usuario, admin_usuario, ultimo_acceso_usuario, estado_usuario)
values
  ('1', 'Administrador',   'andres.ramirez@beeconsultoria.com',  'Admin123*',   'Facturación', true,  now(), true),
  ('2', 'Andrés Ramírez',  'andres.ramirez2@beeconsultoria.com', 'Usuario123*', 'Facturación', false, now(), true)
on conflict (id_usuario) do nothing;

-- Alinea la secuencia con el mayor id existente (idempotente y seguro al
-- re-ejecutar): el siguiente registro continúa después del último.
select setval('public.usuarios_id_seq',
              greatest((select coalesce(max(id_usuario::int), 0) from public.usuarios), 1),
              true);


-- ════════════════════════════════════════════════════════════════════════════
--  MÓDULO 2 · CARGA Y PERSISTENCIA DE DOCUMENTOS
--  Persiste los soportes del periodo. Los archivos se guardan en el bucket
--  público `facturacion-bee` (Storage) y aquí queda el enlace; el contenido de
--  las plantillas Excel se interpreta y se almacena en sus tablas de detalle.
--  El campo `periodo_*` se llena con el periodo seleccionado en el encabezado.
--  NOTA: sin Supabase Auth aún, estas tablas quedan abiertas al rol anónimo
--  (mismo pendiente de endurecer con JWT + RLS que el módulo de usuarios).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Documentos cargados del periodo (índice + enlace en Storage) ────────────
create table if not exists public.documentos_facturacion (
  id_documento_facturacion        bigint generated always as identity primary key,
  periodo_documento_facturacion   text not null,
  tipo_documento_facturacion      text not null,
  direccion_documento_facturacion text not null,
  nombre_documento_facturacion    text   -- nombre del archivo sin extensión (relaciona pedidos de compra)
);

-- ── Detalle de la plantilla «Aprobación Prefactura» (25 columnas en orden) ──
create table if not exists public.aprobacion_prefactura (
  id_prefactura                     bigint generated always as identity primary key,
  periodo_prefactura                text not null,
  numero_contrato_prefactura        text,
  etiqueta_aliado_prefactura        text,
  año_prefactura                    text,
  mes_prefactura                    text,
  nombre_colaborador_prefactura     text,
  id_colaborador_prefactura         text,
  rol_mop_prefactura                text,
  tipo_compra_prefactura            text,
  entega_valor_prefactura           text,
  tarifa_prefactura                 text,
  desglose_novedad_prefactura       text,
  hora_novedad_prefactura           text,
  tarifa_hora_prefactura            text,
  monto_novedad_prefactura          text,
  monto_facturar_prefactura         text,   -- 2 decimales sin aproximar (texto)
  comentarios_proveedor_prefactura  text,
  comentarios_capacidad_prefactura  text,
  id_proyecto_prefactura            text,
  nombre_proyecto_prefactura        text,
  quien_paga_prefactura             text,
  radicar_factura_prefactura        text,
  lider_aprobador_prefactura        text,
  trabajo_compartido_prefactura     text,
  aprobado_prefactura               text,
  comentarios_lider_prefactura      text
);

-- ── Detalle de la plantilla «Registro Facturación Interna» (13 columnas) ────
create table if not exists public.registro_facturacion_interna (
  id_facturacion_interna              bigint generated always as identity primary key,
  periodo_facturacion_interna         text not null,
  pedido_compra_facturacion_interna   text,
  secuencial_facturacion_interna      text,
  mes_facturacion_interna             text,
  cliente_facturacion_interna         text,
  id_colaborados_facturacion_interna  text,
  descripcion_facturacion_interna     text,
  tipo_moneda_facturacion_interna     text,
  tarifa_facturacion_interna          text,
  hora_novedad_facturacion_interna    text,
  tarifa_hora_facturacion_interna     text,
  monto_facturar_facturacion_interna  text,  -- 2 decimales sin aproximar (texto)
  valor_letras_facturacion_interna    text,
  email_aprobador_facturacion_interna text,
  documento_pedido_compra             text,  -- enlace al PDF del pedido de compra (relación por nombre)
  documento_factura_bee               text,  -- enlace a la Factura BEE cargada en Revisar
  monto_emitido_factura_bee           text,  -- monto emitido (global por factura, ingresado en Revisar)
  fecha_factura_bee                   text   -- fecha de la factura física (ingresada en Revisar)
);

-- Columnas añadidas en módulos posteriores (idempotente para BD ya creadas).
alter table public.documentos_facturacion
  add column if not exists nombre_documento_facturacion text;
alter table public.registro_facturacion_interna
  add column if not exists documento_pedido_compra   text,
  add column if not exists documento_factura_bee      text,
  add column if not exists monto_emitido_factura_bee  text,
  add column if not exists fecha_factura_bee          text;

-- Índices para filtrar y recargar por periodo (consulta frecuente del módulo).
create index if not exists ix_documentos_periodo  on public.documentos_facturacion (periodo_documento_facturacion);
create index if not exists ix_prefactura_periodo  on public.aprobacion_prefactura (periodo_prefactura);
create index if not exists ix_registro_periodo    on public.registro_facturacion_interna (periodo_facturacion_interna);

-- ── RLS · acceso del rol anónimo (sin Auth todavía) ─────────────────────────
alter table public.documentos_facturacion      enable row level security;
alter table public.aprobacion_prefactura        enable row level security;
alter table public.registro_facturacion_interna enable row level security;

grant select, insert, update, delete on public.documentos_facturacion      to anon, authenticated;
grant select, insert, update, delete on public.aprobacion_prefactura        to anon, authenticated;
grant select, insert, update, delete on public.registro_facturacion_interna to anon, authenticated;

drop policy if exists documentos_facturacion_all on public.documentos_facturacion;
create policy documentos_facturacion_all on public.documentos_facturacion
  for all to anon, authenticated using (true) with check (true);

drop policy if exists aprobacion_prefactura_all on public.aprobacion_prefactura;
create policy aprobacion_prefactura_all on public.aprobacion_prefactura
  for all to anon, authenticated using (true) with check (true);

drop policy if exists registro_facturacion_interna_all on public.registro_facturacion_interna;
create policy registro_facturacion_interna_all on public.registro_facturacion_interna
  for all to anon, authenticated using (true) with check (true);

-- ── Storage · políticas del bucket `facturacion-bee` ────────────────────────
-- El bucket es público (lectura por URL no requiere policy), pero SUBIR y
-- BORRAR objetos sí. Se envuelven en un bloque con manejo de excepción porque
-- el rol del editor SQL no siempre es dueño de `storage.objects`: si falla, NO
-- aborta la creación de las tablas de arriba (solo avisa). En ese caso créalas
-- desde el panel: Storage → facturacion-bee → Policies (mismas condiciones),
-- o aplícalas con privilegios (Supabase CLI / API de migraciones).
do $$
begin
  drop policy if exists "facturacion_bee_select" on storage.objects;
  create policy "facturacion_bee_select" on storage.objects
    for select to anon, authenticated using (bucket_id = 'facturacion-bee');

  drop policy if exists "facturacion_bee_insert" on storage.objects;
  create policy "facturacion_bee_insert" on storage.objects
    for insert to anon, authenticated with check (bucket_id = 'facturacion-bee');

  drop policy if exists "facturacion_bee_update" on storage.objects;
  create policy "facturacion_bee_update" on storage.objects
    for update to anon, authenticated using (bucket_id = 'facturacion-bee') with check (bucket_id = 'facturacion-bee');

  drop policy if exists "facturacion_bee_delete" on storage.objects;
  create policy "facturacion_bee_delete" on storage.objects
    for delete to anon, authenticated using (bucket_id = 'facturacion-bee');
exception when others then
  raise notice 'No se pudieron crear las políticas de storage (créalas en Storage → Policies). Detalle: %', sqlerrm;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
--  MÓDULO TRANSVERSAL · AUDITORÍA Y LOGS (RF-LOG)
--  Bitácora inmutable de las acciones de los usuarios.
--  La tabla NO se expone al rol anónimo: se inserta y se lee únicamente a
--  través de funciones SECURITY DEFINER, y TODOS los permisos directos quedan
--  revocados. Un evento registrado no se puede alterar ni eliminar.
--  NOTA: mientras no exista Supabase Auth, el "quién" procede de la sesión que
--  guarda el navegador, así que la bitácora es trazabilidad operativa, no
--  prueba forense. La inmutabilidad sí es efectiva desde ya.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.auditoria (
  id_auditoria             bigint      generated always as identity primary key,
  fecha_auditoria          timestamptz not null default now(),
  id_usuario_auditoria     text,                    -- null en acciones anónimas (login fallido)
  nombre_usuario_auditoria text        not null,
  correo_usuario_auditoria text        not null,
  rol_usuario_auditoria    text        not null default 'ANONIMO',
  modulo_auditoria         text        not null,
  accion_auditoria         text        not null,
  resultado_auditoria      text        not null default 'exito',
  observacion_auditoria    text        not null,
  periodo_auditoria        text,                    -- periodo de facturación en curso
  entidad_auditoria        text,                    -- documento | factura | usuario | periodo
  referencia_auditoria     text,                    -- secuencial, archivo o correo afectado
  detalle_auditoria        jsonb,                   -- datos estructurados del evento
  ip_auditoria             text,                    -- lo captura el servidor
  agente_auditoria         text,                    -- lo captura el servidor
  constraint auditoria_resultado_valido
    check (resultado_auditoria in ('exito', 'advertencia', 'error'))
);

-- ── Índices ─────────────────────────────────────────────────────────────────
-- La bitácora se consulta casi siempre en orden cronológico inverso y filtrada
-- por usuario o por módulo: esos son los índices que sostienen la vista.
create index if not exists ix_auditoria_fecha
  on public.auditoria (fecha_auditoria desc);
create index if not exists ix_auditoria_correo_fecha
  on public.auditoria (correo_usuario_auditoria, fecha_auditoria desc);
create index if not exists ix_auditoria_modulo_fecha
  on public.auditoria (modulo_auditoria, fecha_auditoria desc);
create index if not exists ix_auditoria_periodo
  on public.auditoria (periodo_auditoria);

-- ── Inmutabilidad ───────────────────────────────────────────────────────────
-- RLS activado y SIN políticas: con eso el acceso directo queda denegado.
-- El revoke es de TODOS los privilegios, no solo de las cuatro operaciones
-- obvias: Supabase concede ALL por defecto sobre las tablas nuevas de `public`,
-- y dejar TRUNCATE en pie permitiría vaciar la bitácora de un golpe.
alter table public.auditoria enable row level security;
revoke all privileges on public.auditoria from anon, authenticated, public;

-- ── Registrar un evento (único camino de escritura) ─────────────────────────
-- La IP y el navegador se leen de las cabeceras de la petición, no de un
-- parámetro: así el cliente no puede falsearlos. `request.headers` solo existe
-- cuando se llama a través de PostgREST, de ahí el manejo defensivo.
create or replace function public.fn_registrar_auditoria(
  p_nombre_usuario text,
  p_correo_usuario text,
  p_modulo         text,
  p_accion         text,
  p_observacion    text,
  p_id_usuario     text  default null,
  p_rol_usuario    text  default 'ANONIMO',
  p_resultado      text  default 'exito',
  p_periodo        text  default null,
  p_entidad        text  default null,
  p_referencia     text  default null,
  p_detalle        jsonb default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_headers jsonb;
  v_ip      text;
  v_agente  text;
  v_id      bigint;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  if v_headers is not null then
    -- x-forwarded-for puede traer una cadena de proxies; el cliente es el primero.
    v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for',
                                v_headers ->> 'x-real-ip', ''), ',', 1);
    v_ip := nullif(btrim(v_ip), '');
    v_agente := nullif(btrim(coalesce(v_headers ->> 'user-agent', '')), '');
  end if;

  insert into public.auditoria (
    id_usuario_auditoria, nombre_usuario_auditoria, correo_usuario_auditoria,
    rol_usuario_auditoria, modulo_auditoria, accion_auditoria,
    resultado_auditoria, observacion_auditoria, periodo_auditoria,
    entidad_auditoria, referencia_auditoria, detalle_auditoria,
    ip_auditoria, agente_auditoria
  ) values (
    p_id_usuario, p_nombre_usuario, lower(btrim(p_correo_usuario)),
    coalesce(p_rol_usuario, 'ANONIMO'), p_modulo, p_accion,
    coalesce(p_resultado, 'exito'), p_observacion, p_periodo,
    p_entidad, p_referencia, p_detalle,
    v_ip, left(v_agente, 400)
  )
  returning id_auditoria into v_id;

  return v_id;
end $$;

grant execute on function public.fn_registrar_auditoria(
  text, text, text, text, text, text, text, text, text, text, text, jsonb
) to anon, authenticated;

-- ── Listar la bitácora con filtros y paginación ─────────────────────────────
-- Devuelve la página pedida y, en cada fila, el total de coincidencias
-- (`count(*) over()`), de modo que la UI pagina con una sola llamada.
create or replace function public.fn_listar_auditoria(
  p_desde          timestamptz default null,
  p_hasta          timestamptz default null,
  p_correo         text        default null,
  p_modulo         text        default null,
  p_accion         text        default null,
  p_resultado      text        default null,
  p_periodo        text        default null,
  p_busqueda       text        default null,
  p_limite         integer     default 50,
  p_desplazamiento integer     default 0
) returns table (
  id_auditoria             bigint,
  fecha_auditoria          timestamptz,
  id_usuario_auditoria     text,
  nombre_usuario_auditoria text,
  correo_usuario_auditoria text,
  rol_usuario_auditoria    text,
  modulo_auditoria         text,
  accion_auditoria         text,
  resultado_auditoria      text,
  observacion_auditoria    text,
  periodo_auditoria        text,
  entidad_auditoria        text,
  referencia_auditoria     text,
  detalle_auditoria        jsonb,
  ip_auditoria             text,
  agente_auditoria         text,
  total_filas              bigint
)
language sql security definer set search_path = public as $$
  select
    a.id_auditoria, a.fecha_auditoria, a.id_usuario_auditoria,
    a.nombre_usuario_auditoria, a.correo_usuario_auditoria, a.rol_usuario_auditoria,
    a.modulo_auditoria, a.accion_auditoria, a.resultado_auditoria,
    a.observacion_auditoria, a.periodo_auditoria, a.entidad_auditoria,
    a.referencia_auditoria, a.detalle_auditoria, a.ip_auditoria, a.agente_auditoria,
    count(*) over() as total_filas
  from public.auditoria a
  where (p_desde     is null or a.fecha_auditoria >= p_desde)
    and (p_hasta     is null or a.fecha_auditoria <= p_hasta)
    and (p_correo    is null or a.correo_usuario_auditoria = lower(btrim(p_correo)))
    and (p_modulo    is null or a.modulo_auditoria = p_modulo)
    and (p_accion    is null or a.accion_auditoria = p_accion)
    and (p_resultado is null or a.resultado_auditoria = p_resultado)
    and (p_periodo   is null or a.periodo_auditoria = p_periodo)
    and (
      p_busqueda is null or btrim(p_busqueda) = '' or
      a.observacion_auditoria    ilike '%' || btrim(p_busqueda) || '%' or
      a.referencia_auditoria     ilike '%' || btrim(p_busqueda) || '%' or
      a.nombre_usuario_auditoria ilike '%' || btrim(p_busqueda) || '%'
    )
  order by a.fecha_auditoria desc, a.id_auditoria desc
  limit greatest(1, least(coalesce(p_limite, 50), 1000))
  offset greatest(0, coalesce(p_desplazamiento, 0));
$$;

grant execute on function public.fn_listar_auditoria(
  timestamptz, timestamptz, text, text, text, text, text, text, integer, integer
) to anon, authenticated;

-- ── Resumen para las métricas de cabecera ───────────────────────────────────
-- Acepta los mismos filtros que el listado para que las cifras correspondan a
-- lo que el usuario está viendo, no al total histórico.
create or replace function public.fn_resumen_auditoria(
  p_desde     timestamptz default null,
  p_hasta     timestamptz default null,
  p_correo    text        default null,
  p_modulo    text        default null,
  p_accion    text        default null,
  p_resultado text        default null,
  p_periodo   text        default null,
  p_busqueda  text        default null
) returns table (
  total_eventos      bigint,
  usuarios_distintos bigint,
  eventos_error      bigint,
  modulo_top         text
)
language sql security definer set search_path = public as $$
  with filtrados as (
    select a.*
    from public.auditoria a
    where (p_desde     is null or a.fecha_auditoria >= p_desde)
      and (p_hasta     is null or a.fecha_auditoria <= p_hasta)
      and (p_correo    is null or a.correo_usuario_auditoria = lower(btrim(p_correo)))
      and (p_modulo    is null or a.modulo_auditoria = p_modulo)
      and (p_accion    is null or a.accion_auditoria = p_accion)
      and (p_resultado is null or a.resultado_auditoria = p_resultado)
      and (p_periodo   is null or a.periodo_auditoria = p_periodo)
      and (
        p_busqueda is null or btrim(p_busqueda) = '' or
        a.observacion_auditoria    ilike '%' || btrim(p_busqueda) || '%' or
        a.referencia_auditoria     ilike '%' || btrim(p_busqueda) || '%' or
        a.nombre_usuario_auditoria ilike '%' || btrim(p_busqueda) || '%'
      )
  )
  select
    (select count(*) from filtrados),
    (select count(distinct correo_usuario_auditoria) from filtrados),
    (select count(*) from filtrados where resultado_auditoria = 'error'),
    (select modulo_auditoria from filtrados
      group by modulo_auditoria order by count(*) desc, modulo_auditoria limit 1);
$$;

grant execute on function public.fn_resumen_auditoria(
  timestamptz, timestamptz, text, text, text, text, text, text
) to anon, authenticated;

-- ── Valores reales presentes en la bitácora, para poblar los desplegables ────
-- Evita listas de opciones escritas a mano que se desincronizan del contenido.
create or replace function public.fn_filtros_auditoria()
returns table (tipo text, valor text, etiqueta text)
language sql security definer set search_path = public as $$
  select 'usuario', correo_usuario_auditoria,
         max(nombre_usuario_auditoria) || ' · ' || correo_usuario_auditoria
    from public.auditoria
   group by correo_usuario_auditoria
  union all
  select 'modulo', modulo_auditoria, modulo_auditoria
    from public.auditoria group by modulo_auditoria
  union all
  select 'accion', accion_auditoria, accion_auditoria
    from public.auditoria group by accion_auditoria
  order by 1, 3;
$$;

grant execute on function public.fn_filtros_auditoria() to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
--  MÓDULO TRANSVERSAL · PERIODOS Y CICLO DE FACTURACIÓN
--  El periodo deja de ser un literal compilado en el front y el avance del
--  ciclo deja de vivir en el localStorage de cada navegador: aquí son datos
--  compartidos, auditables y no evadibles desde el navegador.
--
--  Etapas: carga → validacion → agrupacion → revision → entrega → conciliacion
--          → archivo → cerrado
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.periodos (
  id_periodo             text        primary key,   -- '2026-08'
  anio_periodo           integer     not null,
  mes_periodo            integer     not null,
  etiqueta_periodo       text        not null,      -- 'Agosto 2026' — clave de las columnas periodo_*
  etiqueta_corta_periodo text        not null,      -- 'Ago 2026'
  etapa_periodo          text        not null default 'carga',
  estado_periodo         text        not null default 'abierto',
  creado_por_periodo     text,
  fecha_creacion_periodo timestamptz not null default now(),
  fecha_etapa_periodo    timestamptz not null default now(),
  constraint periodos_mes_valido    check (mes_periodo between 1 and 12),
  constraint periodos_anio_valido   check (anio_periodo between 2020 and 2100),
  constraint periodos_estado_valido check (estado_periodo in ('abierto', 'cerrado')),
  constraint periodos_etapa_valida  check (etapa_periodo in (
    'carga', 'validacion', 'agrupacion', 'revision', 'entrega', 'conciliacion', 'archivo', 'cerrado')),
  -- Impide crear dos veces el mismo mes: lo garantiza la base de datos, no la
  -- validación de la interfaz.
  constraint periodos_mes_unico unique (anio_periodo, mes_periodo)
);

create index if not exists ix_periodos_orden on public.periodos (anio_periodo desc, mes_periodo desc);

alter table public.periodos enable row level security;
revoke all privileges on public.periodos from anon, authenticated, public;

insert into public.periodos
  (id_periodo, anio_periodo, mes_periodo, etiqueta_periodo, etiqueta_corta_periodo, etapa_periodo)
values
  ('2026-08', 2026, 8, 'Agosto 2026', 'Ago 2026', 'revision')
on conflict (id_periodo) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
--  MÓDULO TRANSVERSAL · FACTURAS
--  La factura no existía como entidad: era el resultado de agrupar
--  registro_facturacion_interna por secuencial, con el monto y la fecha
--  repetidos en cada línea. Sin entidad propia no había dónde guardar
--  «anulada», «enviada el día X» ni «pagada con esta TRM» (RF-CON, RF-ENV-03).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.facturas (
  id_factura                  bigint        generated always as identity primary key,
  periodo_factura             text          not null,
  secuencial_factura          text          not null,
  pedido_compra_factura       text,
  cliente_factura             text,
  moneda_factura              text          not null default 'USD',
  monto_facturado_factura     numeric(14, 2),
  monto_emitido_factura       numeric(14, 2),
  fecha_emision_factura       date,
  estado_factura              text          not null default 'emitida',
  fecha_envio_factura         timestamptz,             -- RF-ENV-03: base del cálculo de días
  fecha_pago_factura          date,                    -- RF-CON-01
  valor_recibido_factura      numeric(14, 2),
  retencion_pct_factura       numeric(5, 2),           -- RF-CON-02
  valor_retenido_factura      numeric(14, 2),
  trm_factura                 numeric(12, 4),          -- la TRM de ESTA operación
  equivalente_cop_factura     numeric(18, 2),
  soporte_pago_factura        text,
  motivo_anulacion_factura    text,
  anulada_por_factura         text,
  fecha_anulacion_factura     timestamptz,
  observacion_factura         text,
  fecha_registro_factura      timestamptz   not null default now(),
  fecha_actualizacion_factura timestamptz   not null default now(),
  constraint facturas_estado_valido check (estado_factura in
    ('emitida', 'enviada', 'pagada', 'anulada')),
  constraint facturas_secuencial_unico unique (periodo_factura, secuencial_factura)
);

create index if not exists ix_facturas_periodo on public.facturas (periodo_factura);
create index if not exists ix_facturas_estado  on public.facturas (periodo_factura, estado_factura);

alter table public.facturas enable row level security;
revoke all privileges on public.facturas from anon, authenticated, public;

-- ════════════════════════════════════════════════════════════════════════════
--  MÓDULO TRANSVERSAL · PARÁMETROS DE NEGOCIO
--  RF-CON-02, RF-ENV-02 y RF-USR-02 exigen que la retención, la TRM, los
--  destinatarios y los plazos sean configurables y no valores fijos en código.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.parametros (
  clave_parametro           text        primary key,
  valor_parametro           text        not null,
  descripcion_parametro     text        not null,
  grupo_parametro           text        not null default 'general',
  actualizado_parametro     timestamptz not null default now(),
  actualizado_por_parametro text
);

alter table public.parametros enable row level security;
revoke all privileges on public.parametros from anon, authenticated, public;

insert into public.parametros (clave_parametro, valor_parametro, descripcion_parametro, grupo_parametro) values
  ('retencion_pct',    '12.5', 'Porcentaje de retención aplicado en origen (RF-CON-02).', 'conciliacion'),
  ('trm_defecto',      '4100', 'TRM propuesta al registrar un pago; se ajusta en cada operación.', 'conciliacion'),
  ('moneda_reporte',   'COP',  'Moneda del reporte fiscal.', 'conciliacion'),
  ('plazo_pago_dias',  '30',   'Días acordados para el pago; pasado el plazo la factura se marca vencida.', 'conciliacion'),
  ('correo_cliente',   'facturacion_proveedores@banistmo.com', 'Destinatario de la radicación (RF-ENV-02).', 'entrega'),
  ('correo_copias',    '',     'Copias fijas adicionales, separadas por coma.', 'entrega'),
  ('asunto_entrega',   'Emisión Factura {secuencial} · {periodo}', 'Plantilla del asunto. Admite {secuencial}, {periodo} y {mes}.', 'entrega'),
  ('proveedor_nombre', 'BEE CONSULTORIA Y NEGOCIOS SAS', 'Razón social del cuerpo del correo.', 'entrega')
on conflict (clave_parametro) do nothing;

-- ── Funciones de estos tres módulos ─────────────────────────────────────────
-- El cuerpo completo y actualizado de cada función está en las migraciones
-- `modulo_periodos_funciones`, `modulo_facturas_funciones` y `modulo_parametros`.
-- Todas son SECURITY DEFINER con `set search_path = public` y `grant execute`
-- a anon y authenticated, siguiendo el patrón del módulo de usuarios:
--
--   fn_orden_etapa(etapa)                          orden canónico del ciclo
--   fn_listar_periodos()                           catálogo, del más reciente al más antiguo
--   fn_crear_periodo(anio, mes, usuario)           valida duplicados y devuelve el id
--   fn_avanzar_etapa(id, etapa)                    solo avanza, nunca retrocede
--   fn_reabrir_etapa(id, etapa, motivo)            retroceso con motivo obligatorio
--   fn_listar_facturas(periodo)                    + días transcurridos y vencimiento
--   fn_anular_factura(periodo, sec, motivo, quien) impide anular una factura pagada
--   fn_marcar_enviada(periodo, sec)                RF-ENV-03
--   fn_registrar_pago(...)                         calcula retención y equivalente COP
--   fn_sincronizar_facturas(periodo)               respeta las anuladas y las pagadas
--   fn_listar_parametros() / fn_guardar_parametro(clave, valor, usuario)
