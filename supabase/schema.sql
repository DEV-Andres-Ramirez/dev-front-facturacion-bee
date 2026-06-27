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
