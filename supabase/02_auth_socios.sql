-- ==========================================================
-- ACUVA · 02 · AUTENTICACIÓN DE SOCIOS
--
-- Corré primero 01_esquema_multilocal.sql. Este script se puede
-- correr más de una vez.
--
-- Los tres tipos de socio salen de dos datos, no de una columna:
--
--   solo carnet  miembros.profile_id vacío y sin acceso_app
--                (no tiene usuario en Auth; el local le pasa el JPG)
--   habilitado   miembros.profile_id vacío y acceso_app = true
--                (todavía no creó su contraseña: dura hasta el primer ingreso)
--   básico       miembros.profile_id lleno e is_claimed = false
--                (usuario DNI@acuva.app en Auth, entra con DNI + contraseña)
--   verificado   is_claimed = true (el email real ya está confirmado en Auth)
--
-- El usuario de Auth de un básico lo crea la Edge Function member-login
-- en el primer ingreso. El local ya no crea cuentas: solo la ficha.
--
-- ANTES DE CORRERLO, en Authentication → Sign In / Providers → Email:
--   · Confirm email: ACTIVADO (el email real se verifica al vincularlo).
--     Los socios básicos se crean confirmados por la función, así que ya no
--     hace falta desactivarlo.
--   · Secure email change: DESACTIVADO. Si queda activo, el cambio de email
--     pide confirmar también desde DNI@acuva.app, que no existe, y Auth
--     nunca cambia de email.
--   · Minimum password length: 8.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Acceso a la app por membresía
--    El local decide a quién le da acceso con DNI + contraseña.
-- ----------------------------------------------------------
alter table public.local_miembros add column if not exists acceso_app boolean not null default false;

-- Las cuentas que ya creó el flujo anterior (DNI@acuva.app, sin email real)
-- siguen entrando con su DNI
update public.local_miembros lm
set acceso_app = true
from public.miembros m
where m.id = lm.miembro_id
  and m.profile_id is not null
  and coalesce(m.is_claimed, false) = false
  and lm.acceso_app = false;

-- ----------------------------------------------------------
-- 2. Slugs reservados
--    La lista tiene que coincidir con RESERVED_SLUGS en src/lib/routes.ts.
--    Se suma "socio" por las rutas /socio/login y /socio/registro.
-- ----------------------------------------------------------
create or replace function public.acuva_slug_reservado(p_slug text)
returns boolean
language sql
immutable
as $$
  select p_slug = any (array[
    'login', 'admin', 'registro', 'api', 'app', 'assets', 'static',
    'landing', 'precios', 'planes', 'ayuda', 'soporte', 'terminos',
    'privacidad', 'www', 'acuva', 'socios', 'socio', 'local', 'locales',
    'dashboard', 'auth', 'logout', 'salir', 'carnet', 'panel'
  ]);
$$;

-- ----------------------------------------------------------
-- 3. Límite de intentos de login por DNI y por IP
--    Solo la Edge Function (service_role) toca esto.
-- ----------------------------------------------------------
create table if not exists public.login_attempts (
  key             text primary key,
  fallos          integer not null default 0,
  ventana_inicio  timestamptz not null default now(),
  bloqueado_hasta timestamptz
);

alter table public.login_attempts enable row level security;  -- sin políticas: solo service_role
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.acuva_login_bloqueado(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select bloqueado_hasta > now() from public.login_attempts where key = p_key),
    false
  );
$$;

-- Suma un intento fallido. Al llegar a p_max dentro de la ventana, bloquea.
create or replace function public.acuva_login_fallo(
  p_key     text,
  p_max     integer,
  p_ventana interval,
  p_bloqueo interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_attempts as la (key, fallos, ventana_inicio)
  values (p_key, 1, now())
  on conflict (key) do update set
    fallos = case
      when la.ventana_inicio < now() - p_ventana then 1
      else la.fallos + 1
    end,
    ventana_inicio = case
      when la.ventana_inicio < now() - p_ventana then now()
      else la.ventana_inicio
    end,
    bloqueado_hasta = case
      when (case when la.ventana_inicio < now() - p_ventana then 1 else la.fallos + 1 end) >= p_max
        then now() + p_bloqueo
      else la.bloqueado_hasta
    end;

  -- Limpieza ocasional de filas viejas
  if random() < 0.02 then
    delete from public.login_attempts
    where ventana_inicio < now() - interval '1 day'
      and (bloqueado_hasta is null or bloqueado_hasta < now());
  end if;
end;
$$;

create or replace function public.acuva_login_ok(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where key = p_key;
$$;

revoke all on function public.acuva_login_bloqueado(text) from public, anon, authenticated;
revoke all on function public.acuva_login_fallo(text, integer, interval, interval) from public, anon, authenticated;
revoke all on function public.acuva_login_ok(text) from public, anon, authenticated;
grant execute on function public.acuva_login_bloqueado(text) to service_role;
grant execute on function public.acuva_login_fallo(text, integer, interval, interval) to service_role;
grant execute on function public.acuva_login_ok(text) to service_role;

-- ----------------------------------------------------------
-- 4. Alta de un socio desde el panel del local
--    Crea solo la ficha (miembros + local_miembros) con control de cupo.
--    No crea usuario en Auth: eso pasa en el primer ingreso del socio.
-- ----------------------------------------------------------
create or replace function public.create_member_by_local(
  p_dni      text,
  p_nombre   text,
  p_telefono text default null,
  p_acceso   boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := public.acuva_mi_local_id();
  v_dni      text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_mid      uuid;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;
  if char_length(v_dni) not between 6 and 9 then
    raise exception 'DNI_INVALIDO';
  end if;
  if v_nombre = '' then
    raise exception 'NOMBRE_REQUERIDO';
  end if;

  select id into v_mid from public.miembros where dni = v_dni limit 1;
  if v_mid is not null then
    if public.acuva_es_socio_de_mi_local(v_mid) then
      raise exception 'YA_ES_SOCIO';
    end if;
    raise exception 'DNI_EN_OTRO_LOCAL';
  end if;

  insert into public.miembros (profile_id, email, full_name, phone, dni, is_claimed)
  values (null, null, v_nombre, coalesce(btrim(p_telefono), ''), v_dni, false)
  returning id into v_mid;

  -- Controla el cupo; si el local está lleno, todo el alta se deshace
  perform public.acuva_vincular_interno(v_local_id, v_mid);

  update public.local_miembros
  set acceso_app = coalesce(p_acceso, false)
  where local_id = v_local_id and miembro_id = v_mid;

  return json_build_object('miembro_id', v_mid);
end;
$$;

-- El local habilita o quita el acceso con DNI + contraseña
create or replace function public.set_member_access(p_miembro_id uuid, p_acceso boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := public.acuva_mi_local_id();
  v_filas    integer;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;

  update public.local_miembros
  set acceso_app = coalesce(p_acceso, false)
  where local_id = v_local_id and miembro_id = p_miembro_id;
  get diagnostics v_filas = row_count;

  if v_filas = 0 then
    raise exception 'SOCIO_NO_VINCULADO';
  end if;
end;
$$;

-- El local restablece la contraseña de un socio básico.
-- Borra su usuario de Auth y deja la ficha intacta: en su próximo ingreso
-- con DNI vuelve a elegir contraseña. Un verificado usa el reset por email.
--
-- OJO: miembros.profile_id es "on delete cascade". Hay que separar la ficha
-- del perfil ANTES de borrar el perfil, o se borrarían también sus pagos,
-- accesos y membresías.
create or replace function public.reset_member_password(p_miembro_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id   uuid := public.acuva_mi_local_id();
  v_profile_id uuid;
  v_claimed    boolean;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;

  if not exists (
    select 1 from public.local_miembros
    where local_id = v_local_id and miembro_id = p_miembro_id and status = 'activo'
  ) then
    raise exception 'SOCIO_NO_VINCULADO';
  end if;

  select profile_id, coalesce(is_claimed, false)
  into v_profile_id, v_claimed
  from public.miembros
  where id = p_miembro_id;

  if v_claimed then
    raise exception 'SOCIO_VERIFICADO';
  end if;

  -- Aunque no tenga cuenta todavía, queda habilitado para crearla
  update public.local_miembros
  set acceso_app = true
  where local_id = v_local_id and miembro_id = p_miembro_id;

  if v_profile_id is null then
    return 'SIN_CUENTA';
  end if;

  update public.miembros set profile_id = null where id = p_miembro_id;
  delete from public.profiles where id = v_profile_id;
  delete from auth.users where id = v_profile_id;

  return 'REINICIADO';
end;
$$;

revoke all on function public.create_member_by_local(text, text, text, boolean) from public, anon;
revoke all on function public.set_member_access(uuid, boolean) from public, anon;
revoke all on function public.reset_member_password(uuid) from public, anon;
grant execute on function public.create_member_by_local(text, text, text, boolean) to authenticated;
grant execute on function public.set_member_access(uuid, boolean) to authenticated;
grant execute on function public.reset_member_password(uuid) to authenticated;

-- ----------------------------------------------------------
-- 5. Alta de usuarios (reemplaza handle_new_user del script 01)
--    Nuevo: si el usuario lo creó member-login para una ficha que ya
--    existía, se vincula a esa ficha en vez de crear otra persona.
--    El id de la ficha viaja en raw_app_meta_data, que el cliente no puede
--    escribir (raw_user_meta_data sí, por eso no se usa para esto).
-- ----------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_link       uuid;
  v_role       user_role;
  v_full_name  text;
  v_avatar     text;
  v_dni        text;
  v_local_id   uuid;
  v_miembro_id uuid;
  v_token      uuid;
  v_alta_local uuid;
begin
  -- Primer ingreso de un socio que dio de alta el local
  begin
    v_link := nullif(new.raw_app_meta_data ->> 'link_member_id', '')::uuid;
  exception when others then
    v_link := null;
  end;

  if v_link is not null then
    insert into public.profiles (id, email, role, full_name, avatar_url, dni)
    select new.id, new.email, 'miembro'::user_role, m.full_name, m.avatar_url, m.dni
    from public.miembros m
    where m.id = v_link;

    -- Reclamo atómico: si otra solicitud ganó, esta falla y no queda cuenta
    update public.miembros set profile_id = new.id where id = v_link and profile_id is null;
    if not found then
      raise exception 'CUENTA_YA_CREADA';
    end if;

    return new;
  end if;

  v_role      := coalesce(nullif(v_meta ->> 'role', '')::user_role, 'miembro'::user_role);
  v_full_name := btrim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', ''));
  v_avatar    := nullif(v_meta ->> 'avatar_url', '');
  v_dni       := nullif(regexp_replace(coalesce(v_meta ->> 'dni', ''), '\D', '', 'g'), '');

  insert into public.profiles (id, email, role, full_name, avatar_url, dni)
  values (new.id, new.email, v_role, v_full_name, v_avatar, v_dni);

  if v_role = 'local' then
    insert into public.locales (profile_id, email, owner_name, name, address, phone, max_members, plan, avatar_url)
    values (
      new.id,
      new.email,
      v_full_name,
      coalesce(nullif(btrim(v_meta ->> 'local_name'), ''), nullif(v_full_name, ''), 'Mi gimnasio'),
      coalesce(v_meta ->> 'address', ''),
      coalesce(v_meta ->> 'phone', ''),
      100,
      'basico',
      v_avatar
    )
    returning id into v_local_id;

    perform public.acuva_sembrar_disciplinas(v_local_id);
  else
    insert into public.miembros (profile_id, email, full_name, phone, avatar_url, dni, is_claimed)
    values (
      new.id,
      new.email,
      v_full_name,
      coalesce(v_meta ->> 'phone', ''),
      v_avatar,
      v_dni,
      coalesce((v_meta ->> 'is_claimed')::boolean, false)
    )
    returning id into v_miembro_id;

    -- Camino anterior (alta con token desde el panel). El panel ya no lo
    -- usa, se deja para no romper altas que estén en curso.
    if v_meta ? 'alta_token' then
      begin
        v_token := (v_meta ->> 'alta_token')::uuid;
      exception when others then
        v_token := null;
      end;

      delete from public.altas_pendientes
      where token = v_token
        and dni = v_dni
        and created_at > now() - interval '30 minutes'
      returning local_id into v_alta_local;

      if v_alta_local is null then
        raise exception 'ALTA_INVALIDA';
      end if;

      perform public.acuva_vincular_interno(v_alta_local, v_miembro_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- 6. Verificación del email
--    Cuando el socio confirma su email real, Auth cambia el email del
--    mismo usuario (el id no cambia) y este trigger copia el email y
--    marca la cuenta como verificada. Desde ahí el DNI deja de servir.
-- ----------------------------------------------------------
create or replace function public.acuva_sync_email_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null
     and new.email is distinct from old.email
     and new.email not ilike '%@acuva.app' then
    update public.profiles set email = new.email where id = new.id;
    update public.miembros set email = new.email, is_claimed = true where profile_id = new.id;
    update public.locales set email = new.email where profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists acuva_sync_email on auth.users;
create trigger acuva_sync_email
  after update of email on auth.users
  for each row execute function public.acuva_sync_email_trg();

-- Nadie puede cambiar su email a uno @acuva.app: ese dominio es solo del
-- usuario interno de los socios básicos y lo crea member-login (insert).
create or replace function public.acuva_bloquear_email_reservado_trg()
returns trigger
language plpgsql
as $$
begin
  if new.email is distinct from old.email and new.email ilike '%@acuva.app' then
    raise exception 'EMAIL_RESERVADO';
  end if;
  if new.email_change is distinct from old.email_change and new.email_change ilike '%@acuva.app' then
    raise exception 'EMAIL_RESERVADO';
  end if;
  return new;
end;
$$;

drop trigger if exists acuva_bloquear_email_reservado on auth.users;
create trigger acuva_bloquear_email_reservado
  before update of email, email_change on auth.users
  for each row execute function public.acuva_bloquear_email_reservado_trg();

-- Para revisar:
-- select m.dni, m.profile_id is not null as tiene_auth, m.is_claimed as verificado, lm.acceso_app
-- from public.miembros m join public.local_miembros lm on lm.miembro_id = m.id;
