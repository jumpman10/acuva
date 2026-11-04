-- ==========================================================
-- ACUVA · 01 · ESQUEMA MULTI-LOCAL
--
-- Sobre el esquema actual (profiles, locales, miembros, local_miembros,
-- accesos, pagos). Pegalo entero en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez.
--
--   miembros        → la persona (DNI, nombre, contacto, cuenta)
--   local_miembros  → la membresía en cada local (cuota, disciplina,
--                     vencimiento, saldo, QR). El cupo cuenta estas filas.
--   accesos, pagos  → siempre de un local y un socio
--   disciplinas     → por local
--   altas_pendientes→ token de un solo uso para que un local dé de alta
--                     a un socio sin que cualquiera pueda hacerlo
--
-- ANTES DE CORRERLO: en Authentication → Sign In / Providers → Email,
-- desactivá "Confirm email". Los socios que crea el local usan un email
-- ficticio (DNI@acuva.app) que no puede confirmarse.
-- ==========================================================

create extension if not exists unaccent with schema extensions;

-- ----------------------------------------------------------
-- 0. Tablas base (solo se crean en un proyecto nuevo; si ya
--    existen no se tocan acá)
-- ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('local', 'miembro');
  end if;
end $$;

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       public.user_role not null default 'miembro',
  full_name  text,
  avatar_url text,
  dni        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locales (
  id                   uuid primary key default gen_random_uuid(),
  profile_id           uuid references public.profiles(id) on delete cascade,
  email                text,
  owner_name           text,
  name                 text not null default 'Mi gimnasio',
  address              text,
  phone                text,
  max_members          integer not null default 100,
  plan                 text,
  linked_members_count integer not null default 0,
  avatar_url           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.miembros (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  avatar_url text,
  dni        text,
  is_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.local_miembros (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null,
  miembro_id uuid not null,
  status     text not null default 'activo',
  joined_at  timestamptz not null default now()
);

create table if not exists public.accesos (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid,
  miembro_id uuid,
  status     text,
  scanned_at timestamptz default now(),
  notes      text
);

create table if not exists public.pagos (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid,
  miembro_id      uuid,
  amount          numeric(12, 2) not null default 0,
  payment_method  text,
  payment_date    timestamptz default now(),
  expiration_date date,
  notes           text,
  created_at      timestamptz default now()
);

-- ----------------------------------------------------------
-- 1. Columnas y limpieza de las tablas existentes
-- ----------------------------------------------------------

-- Los arrays quedan reemplazados por local_miembros
alter table public.locales  drop column if exists members_id;
alter table public.miembros drop column if exists locals_id;

-- locales
alter table public.locales add column if not exists slug text;
update public.locales set max_members = 100 where max_members is null;
update public.locales set linked_members_count = 0 where linked_members_count is null;
alter table public.locales alter column max_members set default 100;
alter table public.locales alter column max_members set not null;
alter table public.locales alter column linked_members_count set default 0;
alter table public.locales alter column linked_members_count set not null;

-- miembros (persona)
alter table public.miembros add column if not exists fecha_nacimiento date;

do $$
begin
  begin
    create unique index if not exists miembros_profile_id_key on public.miembros (profile_id);
  exception when others then
    raise notice 'No se pudo crear miembros_profile_id_key (hay profile_id repetidos): %', sqlerrm;
  end;
  begin
    create unique index if not exists miembros_dni_key on public.miembros (dni)
      where dni is not null and dni <> '';
  exception when others then
    raise notice 'No se pudo crear miembros_dni_key (hay DNI repetidos): %', sqlerrm;
  end;
end $$;

-- Código QR de la membresía
create or replace function public.acuva_nuevo_codigo_qr()
returns text
language sql
volatile
as $$
  select 'ACUVA-' || upper(substr(md5(gen_random_uuid()::text), 1, 12));
$$;

-- local_miembros (membresía)
alter table public.local_miembros alter column id set default gen_random_uuid();
update public.local_miembros set status = 'activo' where status is null or status = 'active';
alter table public.local_miembros alter column status set default 'activo';
alter table public.local_miembros alter column status set not null;
alter table public.local_miembros alter column joined_at set default now();

alter table public.local_miembros add column if not exists disciplina text;
alter table public.local_miembros add column if not exists monto_mensual numeric(12, 2) not null default 0;
alter table public.local_miembros add column if not exists fecha_ingreso date not null default current_date;
alter table public.local_miembros add column if not exists fecha_vencimiento date not null default current_date;
alter table public.local_miembros add column if not exists estado_membresia text not null default 'activo';
alter table public.local_miembros add column if not exists estado_pago text not null default 'pendiente';
alter table public.local_miembros add column if not exists saldo_pendiente numeric(12, 2) not null default 0;
alter table public.local_miembros add column if not exists ultimo_pago_fecha date;
alter table public.local_miembros add column if not exists notas text;
alter table public.local_miembros add column if not exists codigo_qr text;

update public.local_miembros set codigo_qr = public.acuva_nuevo_codigo_qr() where codigo_qr is null;
alter table public.local_miembros alter column codigo_qr set default public.acuva_nuevo_codigo_qr();
alter table public.local_miembros alter column codigo_qr set not null;

delete from public.local_miembros a
using public.local_miembros b
where a.local_id = b.local_id
  and a.miembro_id = b.miembro_id
  and a.ctid > b.ctid;

create unique index if not exists local_miembros_local_miembro_key
  on public.local_miembros (local_id, miembro_id);
create unique index if not exists local_miembros_codigo_qr_key on public.local_miembros (codigo_qr);
create index if not exists local_miembros_miembro_idx on public.local_miembros (miembro_id);

-- accesos
alter table public.accesos alter column id set default gen_random_uuid();
alter table public.accesos add column if not exists disciplina text;
update public.accesos set scanned_at = now() where scanned_at is null;
alter table public.accesos alter column scanned_at set default now();
alter table public.accesos alter column scanned_at set not null;
update public.accesos set status = 'autorizado' where status is null;
alter table public.accesos alter column status set default 'autorizado';
create index if not exists accesos_local_fecha_idx on public.accesos (local_id, scanned_at desc);
create index if not exists accesos_miembro_idx on public.accesos (miembro_id, scanned_at desc);

-- pagos
alter table public.pagos alter column id set default gen_random_uuid();
alter table public.pagos add column if not exists period_start date;
alter table public.pagos add column if not exists details jsonb not null default '[]'::jsonb;
alter table public.pagos alter column payment_date set default now();
alter table public.pagos alter column created_at set default now();
create index if not exists pagos_local_fecha_idx on public.pagos (local_id, payment_date desc);
create index if not exists pagos_miembro_idx on public.pagos (miembro_id);

-- ----------------------------------------------------------
-- 2. Tablas nuevas
-- ----------------------------------------------------------
create table if not exists public.disciplinas (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references public.locales(id) on delete cascade,
  nombre     text not null,
  precio     numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists disciplinas_local_nombre_key on public.disciplinas (local_id, lower(nombre));

create table if not exists public.altas_pendientes (
  token      uuid primary key default gen_random_uuid(),
  local_id   uuid not null references public.locales(id) on delete cascade,
  dni        text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- 3. Claves foráneas (las agrega solo si faltan)
-- ----------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('local_miembros', 'local_id',   'locales'),
      ('local_miembros', 'miembro_id', 'miembros'),
      ('accesos',        'local_id',   'locales'),
      ('accesos',        'miembro_id', 'miembros'),
      ('pagos',          'local_id',   'locales'),
      ('pagos',          'miembro_id', 'miembros')
    ) as t(tabla, columna, ref)
  loop
    if not exists (
      select 1
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f'
        and c.conrelid = format('public.%I', r.tabla)::regclass
        and c.confrelid = format('public.%I', r.ref)::regclass
        and a.attname = r.columna
    ) then
      execute format(
        'delete from public.%I t where t.%I is not null and not exists (select 1 from public.%I x where x.id = t.%I)',
        r.tabla, r.columna, r.ref, r.columna);
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete cascade',
        r.tabla, r.tabla || '_' || r.columna || '_fkey', r.columna, r.ref);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------
-- 4. URL del local (slug)
--    Los reservados tienen que coincidir con RESERVED_SLUGS en src/lib/routes.ts
-- ----------------------------------------------------------
create or replace function public.acuva_slugify(p_text text)
returns text
language sql
stable
as $$
  select trim(both '-' from regexp_replace(
    lower(extensions.unaccent(coalesce(p_text, ''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function public.acuva_slug_reservado(p_slug text)
returns boolean
language sql
immutable
as $$
  select p_slug = any (array[
    'login', 'admin', 'registro', 'api', 'app', 'assets', 'static',
    'landing', 'precios', 'planes', 'ayuda', 'soporte', 'terminos',
    'privacidad', 'www', 'acuva', 'socios', 'local', 'locales',
    'dashboard', 'auth', 'logout', 'salir', 'carnet', 'panel'
  ]);
$$;

create or replace function public.acuva_generar_slug(p_nombre text, p_excluir_id uuid default null)
returns text
language plpgsql
as $$
declare
  v_base text;
  v_cand text;
  v_n    int := 1;
begin
  v_base := trim(both '-' from left(public.acuva_slugify(p_nombre), 34));
  if v_base is null or char_length(v_base) < 3 then
    v_base := 'gym-' || coalesce(nullif(v_base, ''), 'local');
  end if;

  v_cand := v_base;
  while public.acuva_slug_reservado(v_cand)
     or exists (
       select 1 from public.locales
       where slug = v_cand and (p_excluir_id is null or id <> p_excluir_id)
     )
  loop
    v_n := v_n + 1;
    v_cand := v_base || '-' || v_n;
  end loop;

  return v_cand;
end;
$$;

create or replace function public.acuva_locales_slug_trg()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.acuva_generar_slug(new.name, new.id);
  else
    new.slug := public.acuva_slugify(new.slug);
  end if;
  return new;
end;
$$;

drop trigger if exists acuva_locales_slug on public.locales;
create trigger acuva_locales_slug
  before insert or update of slug, name on public.locales
  for each row execute function public.acuva_locales_slug_trg();

do $$
declare
  r record;
begin
  for r in select id, name from public.locales where slug is null or btrim(slug) = '' order by created_at nulls last, id loop
    update public.locales set slug = public.acuva_generar_slug(r.name, r.id) where id = r.id;
  end loop;
end $$;

create unique index if not exists locales_slug_key on public.locales (slug);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locales_slug_formato') then
    alter table public.locales
      add constraint locales_slug_formato check (
        slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        and char_length(slug) between 3 and 40
        and not public.acuva_slug_reservado(slug)
      );
  end if;
end $$;

-- ----------------------------------------------------------
-- 5. Helpers de identidad (los usan RLS y las RPCs)
-- ----------------------------------------------------------
create or replace function public.acuva_mi_local_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.locales where profile_id = auth.uid() limit 1;
$$;

create or replace function public.acuva_mi_miembro_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.miembros where profile_id = auth.uid() limit 1;
$$;

create or replace function public.acuva_es_socio_de_mi_local(p_miembro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.local_miembros lm
    where lm.miembro_id = p_miembro_id
      and lm.status = 'activo'
      and lm.local_id = public.acuva_mi_local_id()
  );
$$;

-- ----------------------------------------------------------
-- 6. Cupo: contador y vínculo
-- ----------------------------------------------------------
create or replace function public.acuva_lm_contador_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.locales
    set linked_members_count = (
      select count(*) from public.local_miembros where local_id = new.local_id and status = 'activo'
    )
    where id = new.local_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update public.locales
    set linked_members_count = (
      select count(*) from public.local_miembros where local_id = old.local_id and status = 'activo'
    )
    where id = old.local_id;
  end if;
  return null;
end;
$$;

drop trigger if exists acuva_lm_contador on public.local_miembros;
create trigger acuva_lm_contador
  after insert or update or delete on public.local_miembros
  for each row execute function public.acuva_lm_contador_trg();

update public.locales l
set linked_members_count = (
  select count(*) from public.local_miembros lm where lm.local_id = l.id and lm.status = 'activo'
);

-- Vincula con control de cupo. Bloquea la fila del local para que dos
-- altas simultáneas no se pasen de max_members. No se expone a la app.
create or replace function public.acuva_vincular_interno(p_local_id uuid, p_miembro_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local  public.locales%rowtype;
  v_status text;
  v_count  int;
begin
  select * into v_local from public.locales where id = p_local_id for update;
  if not found then
    raise exception 'LOCAL_NO_ENCONTRADO';
  end if;

  if not exists (select 1 from public.miembros where id = p_miembro_id) then
    raise exception 'SOCIO_NO_ENCONTRADO';
  end if;

  select status into v_status
  from public.local_miembros
  where local_id = p_local_id and miembro_id = p_miembro_id;

  if v_status = 'activo' then
    return 'YA_VINCULADO';
  end if;

  select count(*) into v_count
  from public.local_miembros
  where local_id = p_local_id and status = 'activo';

  if v_count >= v_local.max_members then
    raise exception 'CUPO_LLENO';
  end if;

  insert into public.local_miembros (local_id, miembro_id, status, joined_at)
  values (p_local_id, p_miembro_id, 'activo', now())
  on conflict (local_id, miembro_id)
  do update set status = 'activo', joined_at = now();

  return 'VINCULADO';
end;
$$;

revoke all on function public.acuva_vincular_interno(uuid, uuid) from public, anon, authenticated;

-- Disciplinas iniciales de un local nuevo
create or replace function public.acuva_sembrar_disciplinas(p_local_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.disciplinas (local_id, nombre, precio)
  select p_local_id, d.nombre, d.precio
  from (values
    ('Musculación', 28000), ('Crossfit', 32000), ('Funcional', 26000),
    ('Boxeo', 30000), ('Spinning', 27000), ('Pilates', 29000),
    ('Calistenia', 25000), ('Pase Libre', 45000)
  ) as d(nombre, precio)
  where not exists (select 1 from public.disciplinas x where x.local_id = p_local_id);
$$;

revoke all on function public.acuva_sembrar_disciplinas(uuid) from public, anon, authenticated;

select public.acuva_sembrar_disciplinas(id) from public.locales;

-- ----------------------------------------------------------
-- 7. Alta de usuarios (reemplaza tu handle_new_user)
--    - local: crea el local (cupo fijo en 100, no se toma del cliente)
--      y sus disciplinas.
--    - miembro: crea la persona. Si viene con alta_token válido (lo genera
--      prepare_member_signup desde el panel), la vincula a ese local con
--      control de cupo. Ya no se confía en created_by_local_id.
-- ----------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role       user_role;
  v_full_name  text;
  v_avatar     text;
  v_dni        text;
  v_local_id   uuid;
  v_miembro_id uuid;
  v_token      uuid;
  v_alta_local uuid;
begin
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
-- 8. RPCs que usa la app
-- ----------------------------------------------------------

-- Datos públicos del local para /{slug}
create or replace function public.get_local_by_slug(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'id', l.id,
    'slug', l.slug,
    'name', l.name,
    'avatar_url', l.avatar_url,
    'is_full', l.linked_members_count >= l.max_members
  )
  from public.locales l
  where l.slug = lower(btrim(p_slug))
  limit 1;
$$;

-- El local pide un token para dar de alta a un socio por DNI.
-- La cuenta se crea después con auth.signUp (metadata alta_token).
create or replace function public.prepare_member_signup(p_dni text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := public.acuva_mi_local_id();
  v_dni      text := regexp_replace(coalesce(p_dni, ''), '\D', '', 'g');
  v_local    public.locales%rowtype;
  v_mid      uuid;
  v_token    uuid;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;
  if char_length(v_dni) not between 6 and 9 then
    raise exception 'DNI_INVALIDO';
  end if;

  select * into v_local from public.locales where id = v_local_id;
  if v_local.linked_members_count >= v_local.max_members then
    raise exception 'CUPO_LLENO';
  end if;

  select id into v_mid from public.miembros where dni = v_dni limit 1;
  if v_mid is not null then
    if public.acuva_es_socio_de_mi_local(v_mid) then
      raise exception 'YA_ES_SOCIO';
    end if;
    raise exception 'DNI_EN_OTRO_LOCAL';
  end if;

  delete from public.altas_pendientes
  where (local_id = v_local_id and dni = v_dni)
     or created_at < now() - interval '1 day';

  insert into public.altas_pendientes (local_id, dni)
  values (v_local_id, v_dni)
  returning token into v_token;

  return v_token;
end;
$$;

-- El socio con sesión se suma al local de un slug (control de cupo)
create or replace function public.join_local(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id   uuid;
  v_role       user_role;
  v_miembro_id uuid;
  v_res        text;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  select id into v_local_id from public.locales where slug = lower(btrim(p_slug));
  if v_local_id is null then
    raise exception 'LOCAL_NO_ENCONTRADO';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then
    raise exception 'PERFIL_NO_ENCONTRADO';
  end if;
  if v_role <> 'miembro' then
    raise exception 'SOLO_SOCIOS';
  end if;

  v_miembro_id := public.acuva_mi_miembro_id();
  if v_miembro_id is null then
    raise exception 'PERFIL_NO_ENCONTRADO';
  end if;

  v_res := public.acuva_vincular_interno(v_local_id, v_miembro_id);
  return json_build_object('estado', v_res, 'miembro_id', v_miembro_id);
end;
$$;

-- El local quita a un socio. Si no queda en otro local y nunca personalizó
-- su cuenta, se borran la persona y su cuenta DNI@acuva.app (así el DNI
-- se puede volver a dar de alta).
create or replace function public.remove_member_from_local(p_miembro_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id   uuid := public.acuva_mi_local_id();
  v_borrados   int;
  v_profile_id uuid;
  v_claimed    boolean;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;

  delete from public.local_miembros
  where local_id = v_local_id and miembro_id = p_miembro_id;
  get diagnostics v_borrados = row_count;

  if v_borrados = 0 then
    raise exception 'SOCIO_NO_VINCULADO';
  end if;

  if exists (select 1 from public.local_miembros where miembro_id = p_miembro_id) then
    return 'DESVINCULADO';
  end if;

  select profile_id, coalesce(is_claimed, false) into v_profile_id, v_claimed
  from public.miembros where id = p_miembro_id;

  if v_claimed then
    return 'DESVINCULADO';
  end if;

  delete from public.miembros where id = p_miembro_id;

  if v_profile_id is not null then
    delete from public.profiles where id = v_profile_id;
    begin
      delete from auth.users where id = v_profile_id;
    exception when others then
      raise notice 'No se pudo borrar la cuenta de Auth %: %', v_profile_id, sqlerrm;
    end;
  end if;

  return 'ELIMINADO';
end;
$$;

-- El local cambia su link
create or replace function public.update_local_slug(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id uuid := public.acuva_mi_local_id();
  v_slug     text := public.acuva_slugify(p_slug);
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 40 then
    raise exception 'SLUG_INVALIDO';
  end if;
  if public.acuva_slug_reservado(v_slug) then
    raise exception 'SLUG_RESERVADO';
  end if;
  if exists (select 1 from public.locales where slug = v_slug and id <> v_local_id) then
    raise exception 'SLUG_EN_USO';
  end if;

  update public.locales set slug = v_slug where id = v_local_id;
  return v_slug;
end;
$$;

revoke all on function public.get_local_by_slug(text) from public;
revoke all on function public.prepare_member_signup(text) from public, anon;
revoke all on function public.join_local(text) from public, anon;
revoke all on function public.remove_member_from_local(uuid) from public, anon;
revoke all on function public.update_local_slug(text) from public, anon;
revoke all on function public.acuva_mi_local_id() from public, anon;
revoke all on function public.acuva_mi_miembro_id() from public, anon;
revoke all on function public.acuva_es_socio_de_mi_local(uuid) from public, anon;

grant execute on function public.get_local_by_slug(text) to anon, authenticated;
grant execute on function public.prepare_member_signup(text) to authenticated;
grant execute on function public.join_local(text) to authenticated;
grant execute on function public.remove_member_from_local(uuid) to authenticated;
grant execute on function public.update_local_slug(text) to authenticated;
grant execute on function public.acuva_mi_local_id() to authenticated;
grant execute on function public.acuva_mi_miembro_id() to authenticated;
grant execute on function public.acuva_es_socio_de_mi_local(uuid) to authenticated;

-- ----------------------------------------------------------
-- 9. Columnas que el cliente no puede cambiar
--    (las RPCs y triggers corren como dueño y sí pueden)
-- ----------------------------------------------------------
create or replace function public.acuva_proteger_profiles_trg()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.id := old.id;
    new.role := old.role;
    new.dni := old.dni;
  end if;
  return new;
end;
$$;

create or replace function public.acuva_proteger_locales_trg()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.profile_id := old.profile_id;
    new.max_members := old.max_members;
    new.linked_members_count := old.linked_members_count;
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

create or replace function public.acuva_proteger_miembros_trg()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.profile_id := old.profile_id;
    new.is_claimed := old.is_claimed;
    new.dni := old.dni;          -- el DNI es el usuario de la cuenta DNI@acuva.app
    new.email := old.email;
  end if;
  return new;
end;
$$;

create or replace function public.acuva_proteger_local_miembros_trg()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.local_id := old.local_id;
    new.miembro_id := old.miembro_id;
    new.status := old.status;
    new.codigo_qr := old.codigo_qr;
    new.joined_at := old.joined_at;
  end if;
  return new;
end;
$$;

drop trigger if exists acuva_proteger_profiles on public.profiles;
create trigger acuva_proteger_profiles before update on public.profiles
  for each row execute function public.acuva_proteger_profiles_trg();

drop trigger if exists acuva_proteger_locales on public.locales;
create trigger acuva_proteger_locales before update on public.locales
  for each row execute function public.acuva_proteger_locales_trg();

drop trigger if exists acuva_proteger_miembros on public.miembros;
create trigger acuva_proteger_miembros before update on public.miembros
  for each row execute function public.acuva_proteger_miembros_trg();

drop trigger if exists acuva_proteger_local_miembros on public.local_miembros;
create trigger acuva_proteger_local_miembros before update on public.local_miembros
  for each row execute function public.acuva_proteger_local_miembros_trg();

-- ----------------------------------------------------------
-- 10. Permisos (RLS). Reemplaza las políticas abiertas actuales.
-- ----------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.locales          enable row level security;
alter table public.miembros         enable row level security;
alter table public.local_miembros   enable row level security;
alter table public.accesos          enable row level security;
alter table public.pagos            enable row level security;
alter table public.disciplinas      enable row level security;
alter table public.altas_pendientes enable row level security;  -- sin políticas: solo vía RPC

drop policy if exists "Profiles lectura autenticados" on public.profiles;
drop policy if exists "Profiles update propio" on public.profiles;
drop policy if exists "Locales lectura autenticados" on public.locales;
drop policy if exists "Locales update propio" on public.locales;
drop policy if exists "Miembros lectura autenticados" on public.miembros;
drop policy if exists "Miembros update propio" on public.miembros;
drop policy if exists "Local_miembros lectura autenticados" on public.local_miembros;
drop policy if exists "Accesos lectura autenticados" on public.accesos;
drop policy if exists "Pagos lectura autenticados" on public.pagos;

-- profiles: cada uno el suyo
drop policy if exists acuva_profiles_select on public.profiles;
drop policy if exists acuva_profiles_update on public.profiles;
create policy acuva_profiles_select on public.profiles
  for select to authenticated using (id = auth.uid());
create policy acuva_profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- locales: el dueño; el socio ve los locales donde está activo
drop policy if exists acuva_locales_select on public.locales;
drop policy if exists acuva_locales_update on public.locales;
create policy acuva_locales_select on public.locales
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.local_miembros lm
      where lm.local_id = locales.id
        and lm.status = 'activo'
        and lm.miembro_id = public.acuva_mi_miembro_id()
    )
  );
create policy acuva_locales_update on public.locales
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- miembros: la persona misma o el local donde está activa
drop policy if exists acuva_miembros_select on public.miembros;
drop policy if exists acuva_miembros_update on public.miembros;
create policy acuva_miembros_select on public.miembros
  for select to authenticated
  using (profile_id = auth.uid() or public.acuva_es_socio_de_mi_local(id));
create policy acuva_miembros_update on public.miembros
  for update to authenticated
  using (profile_id = auth.uid() or public.acuva_es_socio_de_mi_local(id))
  with check (profile_id = auth.uid() or public.acuva_es_socio_de_mi_local(id));

-- local_miembros: el local edita la membresía; el socio la ve.
-- Altas y bajas solo por RPC / trigger.
drop policy if exists acuva_lm_select on public.local_miembros;
drop policy if exists acuva_lm_update on public.local_miembros;
create policy acuva_lm_select on public.local_miembros
  for select to authenticated
  using (local_id = public.acuva_mi_local_id() or miembro_id = public.acuva_mi_miembro_id());
create policy acuva_lm_update on public.local_miembros
  for update to authenticated
  using (local_id = public.acuva_mi_local_id())
  with check (local_id = public.acuva_mi_local_id());

-- accesos
drop policy if exists acuva_accesos_select on public.accesos;
drop policy if exists acuva_accesos_insert on public.accesos;
drop policy if exists acuva_accesos_delete on public.accesos;
create policy acuva_accesos_select on public.accesos
  for select to authenticated
  using (local_id = public.acuva_mi_local_id() or miembro_id = public.acuva_mi_miembro_id());
create policy acuva_accesos_insert on public.accesos
  for insert to authenticated
  with check (local_id = public.acuva_mi_local_id() and public.acuva_es_socio_de_mi_local(miembro_id));
create policy acuva_accesos_delete on public.accesos
  for delete to authenticated
  using (local_id = public.acuva_mi_local_id());

-- pagos
drop policy if exists acuva_pagos_select on public.pagos;
drop policy if exists acuva_pagos_insert on public.pagos;
drop policy if exists acuva_pagos_update on public.pagos;
drop policy if exists acuva_pagos_delete on public.pagos;
create policy acuva_pagos_select on public.pagos
  for select to authenticated
  using (local_id = public.acuva_mi_local_id() or miembro_id = public.acuva_mi_miembro_id());
create policy acuva_pagos_insert on public.pagos
  for insert to authenticated
  with check (local_id = public.acuva_mi_local_id() and public.acuva_es_socio_de_mi_local(miembro_id));
create policy acuva_pagos_update on public.pagos
  for update to authenticated
  using (local_id = public.acuva_mi_local_id())
  with check (local_id = public.acuva_mi_local_id());
create policy acuva_pagos_delete on public.pagos
  for delete to authenticated
  using (local_id = public.acuva_mi_local_id());

-- disciplinas: solo el local
drop policy if exists acuva_disciplinas_all on public.disciplinas;
create policy acuva_disciplinas_all on public.disciplinas
  for all to authenticated
  using (local_id = public.acuva_mi_local_id())
  with check (local_id = public.acuva_mi_local_id());

-- Para revisar:
-- select name, slug, linked_members_count, max_members from public.locales;
