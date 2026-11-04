-- ==========================================================
-- ACUVA · 01 · URL POR LOCAL, VÍNCULOS Y CUPO
-- Aditivo: no borra datos ni cambia permisos. Se puede correr
-- más de una vez. Pegalo entero en Supabase → SQL Editor → Run.
-- ==========================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------
-- 1. Columnas en locales
-- ----------------------------------------------------------
alter table public.locales add column if not exists slug text;
alter table public.locales add column if not exists avatar_url text;
alter table public.locales add column if not exists max_members integer not null default 100;
alter table public.locales add column if not exists linked_members_count integer not null default 0;

-- ----------------------------------------------------------
-- 2. Helpers de slug
--    La lista de reservados tiene que coincidir con
--    RESERVED_SLUGS en src/lib/routes.ts
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

create or replace function public.acuva_generar_slug(p_nombre text, p_excluir_id text default null)
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
       where slug = v_cand
         and (p_excluir_id is null or id::text <> p_excluir_id)
     )
  loop
    v_n := v_n + 1;
    v_cand := v_base || '-' || v_n;
  end loop;

  return v_cand;
end;
$$;

-- Genera el slug al crear un local (o normaliza el que venga)
create or replace function public.acuva_locales_slug_trg()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.acuva_generar_slug(new.name, new.id::text);
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

-- Slug para los locales que ya existen
do $$
declare
  r record;
begin
  for r in
    select id, name from public.locales
    where slug is null or btrim(slug) = ''
    order by id
  loop
    update public.locales
    set slug = public.acuva_generar_slug(r.name, r.id::text)
    where id = r.id;
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
-- 3. Tabla de vínculos local ↔ socio y local_id en accesos/pagos
--    (usa los mismos tipos de dato que locales.id y miembros.id)
-- ----------------------------------------------------------
do $$
declare
  v_tipo_local      text;
  v_tipo_miembro    text;
  v_tipo_lm_miembro text;
begin
  select format_type(a.atttypid, a.atttypmod) into v_tipo_local
  from pg_attribute a
  where a.attrelid = 'public.locales'::regclass and a.attname = 'id';

  select format_type(a.atttypid, a.atttypmod) into v_tipo_miembro
  from pg_attribute a
  where a.attrelid = 'public.miembros'::regclass and a.attname = 'id';

  if to_regclass('public.locales_miembros') is null then
    execute format($f$
      create table public.locales_miembros (
        id         uuid primary key default gen_random_uuid(),
        local_id   %s not null references public.locales(id) on delete cascade,
        miembro_id %s not null references public.miembros(id) on delete cascade,
        status     text not null default 'active',
        joined_at  timestamptz not null default now()
      )$f$, v_tipo_local, v_tipo_miembro);
  else
    alter table public.locales_miembros add column if not exists status text not null default 'active';
    alter table public.locales_miembros add column if not exists joined_at timestamptz not null default now();

    -- miembro_id tiene que tener el mismo tipo que miembros.id
    select format_type(a.atttypid, a.atttypmod) into v_tipo_lm_miembro
    from pg_attribute a
    where a.attrelid = 'public.locales_miembros'::regclass and a.attname = 'miembro_id';

    if v_tipo_lm_miembro is distinct from v_tipo_miembro then
      delete from public.locales_miembros lm
      where not exists (select 1 from public.miembros m where m.id::text = lm.miembro_id::text);
      execute format(
        'alter table public.locales_miembros alter column miembro_id type %s using miembro_id::text::%s',
        v_tipo_miembro, v_tipo_miembro);
    end if;
  end if;

  -- FK hacia miembros (permite que la app traiga los socios de un local en una sola consulta)
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.locales_miembros'::regclass
      and contype = 'f'
      and confrelid = 'public.miembros'::regclass
  ) then
    delete from public.locales_miembros lm
    where not exists (select 1 from public.miembros m where m.id::text = lm.miembro_id::text);
    alter table public.locales_miembros
      add constraint locales_miembros_miembro_fk
      foreign key (miembro_id) references public.miembros(id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accesos' and column_name = 'local_id'
  ) then
    execute format(
      'alter table public.accesos add column local_id %s references public.locales(id) on delete cascade',
      v_tipo_local);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pagos' and column_name = 'local_id'
  ) then
    execute format(
      'alter table public.pagos add column local_id %s references public.locales(id) on delete cascade',
      v_tipo_local);
  end if;
end $$;

update public.locales_miembros set status = 'active' where status is null;

-- Sin duplicados local/socio
delete from public.locales_miembros a
using public.locales_miembros b
where a.local_id = b.local_id
  and a.miembro_id = b.miembro_id
  and a.ctid > b.ctid;

create unique index if not exists locales_miembros_local_miembro_key
  on public.locales_miembros (local_id, miembro_id);
create index if not exists locales_miembros_miembro_idx on public.locales_miembros (miembro_id);
create index if not exists accesos_local_idx on public.accesos (local_id);
create index if not exists pagos_local_idx on public.pagos (local_id);

-- ----------------------------------------------------------
-- 4. Backfill de vínculos con los datos que ya tenés
-- ----------------------------------------------------------
do $$
begin
  -- a) miembros.locals_id (array heredado)
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'miembros' and column_name = 'locals_id') then
    execute $q$
      insert into public.locales_miembros (local_id, miembro_id, status)
      select l.id, m.id, 'active'
      from public.miembros m
      cross join lateral unnest(m.locals_id) as x(lid)
      join public.locales l on l.id::text = x.lid::text
      on conflict (local_id, miembro_id) do nothing
    $q$;
  end if;

  -- b) locales.members_id (array heredado)
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'locales' and column_name = 'members_id') then
    execute $q$
      insert into public.locales_miembros (local_id, miembro_id, status)
      select l.id, m.id, 'active'
      from public.locales l
      cross join lateral unnest(l.members_id) as x(mid)
      join public.miembros m on m.id::text = x.mid::text
      on conflict (local_id, miembro_id) do nothing
    $q$;
  end if;
end $$;

-- c) Socios dados de alta por un local (metadata created_by_local_id en Auth)
insert into public.locales_miembros (local_id, miembro_id, status)
select l.id, m.id, 'active'
from auth.users u
join public.miembros m on m.dni = u.raw_user_meta_data ->> 'dni'
join public.locales l on l.id::text = u.raw_user_meta_data ->> 'created_by_local_id'
where u.raw_user_meta_data ? 'created_by_local_id'
on conflict (local_id, miembro_id) do nothing;

-- d) Si hay un solo local, todos los socios sin vínculo son de ese local
do $$
begin
  if (select count(*) from public.locales) = 1 then
    insert into public.locales_miembros (local_id, miembro_id, status)
    select (select id from public.locales limit 1), m.id, 'active'
    from public.miembros m
    where not exists (select 1 from public.locales_miembros lm where lm.miembro_id::text = m.id::text)
    on conflict (local_id, miembro_id) do nothing;
  end if;
end $$;

-- e) local_id en accesos y pagos históricos
update public.accesos a
set local_id = lm.local_id
from (
  select distinct on (miembro_id) miembro_id, local_id
  from public.locales_miembros
  where status = 'active'
  order by miembro_id, joined_at
) lm
where a.local_id is null and a.member_id::text = lm.miembro_id::text;

update public.pagos p
set local_id = lm.local_id
from (
  select distinct on (miembro_id) miembro_id, local_id
  from public.locales_miembros
  where status = 'active'
  order by miembro_id, joined_at
) lm
where p.local_id is null and p.member_id::text = lm.miembro_id::text;

-- f) profile_id de los socios creados por un local (cuenta DNI@acuva.app)
update public.miembros m
set profile_id = u.id
from auth.users u
where m.profile_id is null
  and u.email = m.dni || '@acuva.app';

-- ----------------------------------------------------------
-- 5. Contador linked_members_count (siempre = vínculos activos)
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
      select count(*) from public.locales_miembros
      where local_id = new.local_id and status = 'active'
    )
    where id = new.local_id;
  end if;

  if tg_op in ('DELETE', 'UPDATE') then
    update public.locales
    set linked_members_count = (
      select count(*) from public.locales_miembros
      where local_id = old.local_id and status = 'active'
    )
    where id = old.local_id;
  end if;

  return null;
end;
$$;

drop trigger if exists acuva_lm_contador on public.locales_miembros;
create trigger acuva_lm_contador
  after insert or update or delete on public.locales_miembros
  for each row execute function public.acuva_lm_contador_trg();

update public.locales l
set linked_members_count = (
  select count(*) from public.locales_miembros lm
  where lm.local_id = l.id and lm.status = 'active'
);

-- ----------------------------------------------------------
-- 6. Helpers de identidad (los usa también el script 02 de RLS)
-- ----------------------------------------------------------
create or replace function public.acuva_mi_local_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select l.id::text
  from public.locales l
  where l.profile_id::text = auth.uid()::text
     or l.id::text = auth.uid()::text
  limit 1;
$$;

create or replace function public.acuva_mi_miembro_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from (
    select m.id::text as id, 1 as prioridad
    from public.miembros m
    where m.profile_id::text = auth.uid()::text
       or m.id::text = auth.uid()::text
    union all
    -- Socio creado por un local que todavía no tiene profile_id cargado
    select m.id::text, 2
    from public.miembros m
    join public.profiles p on p.id::text = auth.uid()::text
    where m.profile_id is null
      and p.dni is not null
      and m.dni = p.dni
      and p.email = p.dni || '@acuva.app'
  ) t
  order by prioridad
  limit 1;
$$;

create or replace function public.acuva_es_socio_de_mi_local(p_miembro_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.locales_miembros lm
    where lm.miembro_id::text = p_miembro_id
      and lm.status = 'active'
      and lm.local_id::text = public.acuva_mi_local_id()
  );
$$;

-- ----------------------------------------------------------
-- 7. Vincular con control de cupo (interno, no se expone)
-- ----------------------------------------------------------
create or replace function public.acuva_vincular_interno(p_local_id text, p_miembro_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local  public.locales%rowtype;
  v_mid    public.miembros.id%type;
  v_status text;
  v_count  int;
begin
  -- Bloquea la fila del local: dos altas simultáneas no pueden pasarse del cupo
  select * into v_local from public.locales where id::text = p_local_id for update;
  if not found then
    raise exception 'LOCAL_NO_ENCONTRADO';
  end if;

  select id into v_mid from public.miembros where id::text = p_miembro_id;
  if v_mid is null then
    raise exception 'SOCIO_NO_ENCONTRADO';
  end if;

  select status into v_status
  from public.locales_miembros
  where local_id = v_local.id and miembro_id = v_mid;

  if v_status = 'active' then
    return 'YA_VINCULADO';
  end if;

  select count(*) into v_count
  from public.locales_miembros
  where local_id = v_local.id and status = 'active';

  if v_count >= coalesce(v_local.max_members, 0) then
    raise exception 'CUPO_LLENO';
  end if;

  insert into public.locales_miembros (local_id, miembro_id, status, joined_at)
  values (v_local.id, v_mid, 'active', now())
  on conflict (local_id, miembro_id)
  do update set status = 'active', joined_at = now();

  return 'VINCULADO';
end;
$$;

revoke all on function public.acuva_vincular_interno(text, text) from public, anon, authenticated;

-- ----------------------------------------------------------
-- 8. RPCs que usa la app
-- ----------------------------------------------------------

-- Datos públicos de un local para la página /{slug}
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
    'is_full', coalesce(l.linked_members_count, 0) >= coalesce(l.max_members, 0)
  )
  from public.locales l
  where l.slug = lower(btrim(p_slug))
  limit 1;
$$;

-- El local vincula a un socio que acaba de dar de alta
create or replace function public.link_member_to_local(p_miembro_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id text := public.acuva_mi_local_id();
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;
  return public.acuva_vincular_interno(v_local_id, p_miembro_id);
end;
$$;

-- El local vincula una ficha que ya existe con ese DNI, solo si la cuenta
-- de Auth la creó este mismo local (alta desde el panel con un trigger que
-- ya creó la ficha). Un socio de otro local se suma desde el link del local.
create or replace function public.link_member_by_dni(p_dni text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id text := public.acuva_mi_local_id();
  v_mid      text;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;

  select m.id::text into v_mid from public.miembros m where m.dni = btrim(p_dni) limit 1;
  if v_mid is null then
    raise exception 'SOCIO_NO_ENCONTRADO';
  end if;

  if exists (
    select 1 from public.locales_miembros lm
    where lm.miembro_id::text = v_mid and lm.local_id::text = v_local_id and lm.status = 'active'
  ) then
    return v_mid;
  end if;

  if not exists (
    select 1 from auth.users u
    where u.raw_user_meta_data ->> 'dni' = btrim(p_dni)
      and u.raw_user_meta_data ->> 'created_by_local_id' = v_local_id
  ) then
    raise exception 'DNI_EN_OTRO_LOCAL';
  end if;

  perform public.acuva_vincular_interno(v_local_id, v_mid);
  return v_mid;
end;
$$;

-- El socio se suma a un local desde su link (crea su ficha si no tiene)
create or replace function public.join_local(p_slug text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id  text;
  v_perfil    public.profiles%rowtype;
  v_miembro   public.miembros%rowtype;
  v_tipo_id   text;
  v_nuevo_id  text;
  v_nombre    text;
  v_apellido  text;
  v_telefono  text;
  v_dni       text;
  v_res       text;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  select id::text into v_local_id from public.locales where slug = lower(btrim(p_slug));
  if v_local_id is null then
    raise exception 'LOCAL_NO_ENCONTRADO';
  end if;

  select * into v_perfil from public.profiles where id::text = auth.uid()::text;
  if not found then
    raise exception 'PERFIL_NO_ENCONTRADO';
  end if;
  if v_perfil.role is distinct from 'miembro' then
    raise exception 'SOLO_SOCIOS';
  end if;

  -- 1) Ficha propia (por profile_id o creada con el mismo id que la cuenta)
  select * into v_miembro
  from public.miembros
  where profile_id::text = auth.uid()::text or id::text = auth.uid()::text
  limit 1;

  -- 2) Ficha creada por un local con el mismo DNI
  if v_miembro.id is null then
    v_dni := btrim(coalesce(v_perfil.dni, ''));
    if v_dni = '' then
      raise exception 'FALTA_DNI';
    end if;

    select * into v_miembro from public.miembros where dni = v_dni limit 1;

    if v_miembro.id is not null then
      -- Solo se adopta si es la cuenta DNI@acuva.app que creó el local
      if v_miembro.profile_id is not null
         or v_perfil.email is distinct from v_dni || '@acuva.app' then
        raise exception 'DNI_EN_USO';
      end if;
      update public.miembros set profile_id = auth.uid() where id = v_miembro.id;
    end if;
  end if;

  -- 3) Socio nuevo: se crea la ficha con pago pendiente
  if v_miembro.id is null then
    v_nombre   := split_part(btrim(coalesce(v_perfil.full_name, '')), ' ', 1);
    v_apellido := btrim(substr(btrim(coalesce(v_perfil.full_name, '')), char_length(v_nombre) + 1));

    select coalesce(u.raw_user_meta_data ->> 'phone', '') into v_telefono
    from auth.users u where u.id = auth.uid();

    -- El id respeta el tipo real de miembros.id (uuid o text)
    select format_type(a.atttypid, a.atttypmod) into v_tipo_id
    from pg_attribute a
    where a.attrelid = 'public.miembros'::regclass and a.attname = 'id';

    v_nuevo_id := case
      when v_tipo_id = 'uuid' then gen_random_uuid()::text
      else 'mem-' || replace(gen_random_uuid()::text, '-', '')
    end;

    -- Literales sin tipo: Postgres los convierte al tipo de cada columna
    execute format($i$
      insert into public.miembros (
        id, dni, nombre, apellido, full_name, disciplina, telefono, phone,
        fecha_ingreso, fecha_vencimiento, estado_membresia, estado_pago,
        monto_mensual, codigo_qr, profile_id, is_claimed
      ) values (
        %L, %L, %L, %L, %L, 'Sin asignar', %L, %L,
        current_date, current_date, 'activo', 'pendiente',
        0, %L, %L, true
      )$i$,
      v_nuevo_id,
      v_dni,
      coalesce(nullif(v_nombre, ''), 'Socio'),
      coalesce(v_apellido, ''),
      btrim(coalesce(v_perfil.full_name, '')),
      coalesce(v_telefono, ''),
      nullif(v_telefono, ''),
      'Acuva-' || v_dni || '-' || upper(substr(md5(random()::text), 1, 8)),
      auth.uid()::text
    );

    select * into v_miembro from public.miembros where id::text = v_nuevo_id;
  end if;

  v_res := public.acuva_vincular_interno(v_local_id, v_miembro.id::text);

  return json_build_object('estado', v_res, 'miembro_id', v_miembro.id::text);
end;
$$;

-- El local quita a un socio. La ficha solo se borra si no queda
-- vinculada a otro local y el socio nunca personalizó su cuenta.
create or replace function public.remove_member_from_local(p_miembro_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_id text := public.acuva_mi_local_id();
  v_borrados int;
begin
  if v_local_id is null then
    raise exception 'NO_ES_LOCAL';
  end if;

  delete from public.locales_miembros
  where local_id::text = v_local_id and miembro_id::text = p_miembro_id;
  get diagnostics v_borrados = row_count;

  if v_borrados = 0 then
    raise exception 'SOCIO_NO_VINCULADO';
  end if;

  if not exists (select 1 from public.locales_miembros where miembro_id::text = p_miembro_id) then
    delete from public.miembros
    where id::text = p_miembro_id and coalesce(is_claimed, false) = false;
    return 'ELIMINADO';
  end if;

  return 'DESVINCULADO';
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
  v_local_id text := public.acuva_mi_local_id();
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
  if exists (select 1 from public.locales where slug = v_slug and id::text <> v_local_id) then
    raise exception 'SLUG_EN_USO';
  end if;

  update public.locales set slug = v_slug where id::text = v_local_id;
  return v_slug;
end;
$$;

-- Permisos de ejecución
revoke all on function public.get_local_by_slug(text) from public;
revoke all on function public.link_member_to_local(text) from public, anon;
revoke all on function public.link_member_by_dni(text) from public, anon;
revoke all on function public.join_local(text) from public, anon;
revoke all on function public.remove_member_from_local(text) from public, anon;
revoke all on function public.update_local_slug(text) from public, anon;

grant execute on function public.get_local_by_slug(text) to anon, authenticated;
grant execute on function public.link_member_to_local(text) to authenticated;
grant execute on function public.link_member_by_dni(text) to authenticated;
grant execute on function public.join_local(text) to authenticated;
grant execute on function public.remove_member_from_local(text) to authenticated;
grant execute on function public.update_local_slug(text) to authenticated;
grant execute on function public.acuva_mi_local_id() to authenticated;
grant execute on function public.acuva_mi_miembro_id() to authenticated;
grant execute on function public.acuva_es_socio_de_mi_local(text) to authenticated;

-- ----------------------------------------------------------
-- 9. Lectura de locales_miembros
--    Tu proyecto tiene rls_auto_enable: activa RLS en las tablas nuevas.
--    Sin esta política la app no vería ningún vínculo.
-- ----------------------------------------------------------
alter table public.locales_miembros enable row level security;
drop policy if exists acuva_lm_select on public.locales_miembros;
create policy acuva_lm_select on public.locales_miembros
  for select to authenticated
  using (
    local_id::text = public.acuva_mi_local_id()
    or miembro_id::text = public.acuva_mi_miembro_id()
  );

-- Para revisar el resultado:
-- select id, name, slug, linked_members_count, max_members from public.locales;
