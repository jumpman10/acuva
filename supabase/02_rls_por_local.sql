-- ==========================================================
-- ACUVA · 02 · PERMISOS POR LOCAL (RLS)
-- Correlo DESPUÉS del 01 y después de desplegar el frontend nuevo.
-- Cierra el acceso público: cada local ve solo sus socios, accesos
-- y pagos, y cada socio solo lo suyo.
--
-- Antes de correrlo: mirá el resultado de 00_inspeccion.sql. Si en
-- miembros, accesos, pagos o locales hay OTRAS políticas abiertas
-- (USING true) además de las que se borran acá, borralas también:
-- en Postgres las políticas se suman y una abierta deja todo abierto.
-- ==========================================================

-- ----------------------------------------------------------
-- miembros
-- ----------------------------------------------------------
drop policy if exists "Permitir todo acceso público a miembros" on public.miembros;
drop policy if exists acuva_miembros_select on public.miembros;
drop policy if exists acuva_miembros_insert on public.miembros;
drop policy if exists acuva_miembros_update on public.miembros;
drop policy if exists acuva_miembros_delete on public.miembros;

alter table public.miembros enable row level security;

create policy acuva_miembros_select on public.miembros
  for select to authenticated
  using (
    id = public.acuva_mi_miembro_id()
    or public.acuva_es_socio_de_mi_local(id)
  );

-- El local da de alta la ficha; el vínculo se crea con link_member_to_local()
create policy acuva_miembros_insert on public.miembros
  for insert to authenticated
  with check (public.acuva_mi_local_id() is not null);

create policy acuva_miembros_update on public.miembros
  for update to authenticated
  using (public.acuva_es_socio_de_mi_local(id))
  with check (public.acuva_es_socio_de_mi_local(id));

create policy acuva_miembros_delete on public.miembros
  for delete to authenticated
  using (public.acuva_es_socio_de_mi_local(id));

-- ----------------------------------------------------------
-- accesos
-- ----------------------------------------------------------
drop policy if exists "Permitir todo acceso público a accesos" on public.accesos;
drop policy if exists acuva_accesos_select on public.accesos;
drop policy if exists acuva_accesos_write on public.accesos;

alter table public.accesos enable row level security;

create policy acuva_accesos_select on public.accesos
  for select to authenticated
  using (
    local_id::text = public.acuva_mi_local_id()
    or member_id = public.acuva_mi_miembro_id()
  );

create policy acuva_accesos_write on public.accesos
  for all to authenticated
  using (local_id::text = public.acuva_mi_local_id())
  with check (local_id::text = public.acuva_mi_local_id());

-- ----------------------------------------------------------
-- pagos
-- ----------------------------------------------------------
drop policy if exists "Permitir todo acceso público a pagos" on public.pagos;
drop policy if exists acuva_pagos_select on public.pagos;
drop policy if exists acuva_pagos_write on public.pagos;

alter table public.pagos enable row level security;

create policy acuva_pagos_select on public.pagos
  for select to authenticated
  using (
    local_id::text = public.acuva_mi_local_id()
    or member_id = public.acuva_mi_miembro_id()
  );

create policy acuva_pagos_write on public.pagos
  for all to authenticated
  using (local_id::text = public.acuva_mi_local_id())
  with check (local_id::text = public.acuva_mi_local_id());

-- ----------------------------------------------------------
-- locales_miembros: solo lectura; las altas y bajas van por RPC
-- ----------------------------------------------------------
drop policy if exists acuva_lm_select on public.locales_miembros;

alter table public.locales_miembros enable row level security;

create policy acuva_lm_select on public.locales_miembros
  for select to authenticated
  using (
    local_id::text = public.acuva_mi_local_id()
    or miembro_id = public.acuva_mi_miembro_id()
  );

-- ----------------------------------------------------------
-- locales: el dueño ve y edita el suyo; el socio ve los locales
-- a los que está vinculado. La página pública usa get_local_by_slug().
-- ----------------------------------------------------------
drop policy if exists acuva_locales_select on public.locales;
drop policy if exists acuva_locales_update on public.locales;
drop policy if exists acuva_locales_insert on public.locales;

alter table public.locales enable row level security;

create policy acuva_locales_select on public.locales
  for select to authenticated
  using (
    id::text = public.acuva_mi_local_id()
    or exists (
      select 1 from public.locales_miembros lm
      where lm.local_id = locales.id
        and lm.status = 'active'
        and lm.miembro_id = public.acuva_mi_miembro_id()
    )
  );

create policy acuva_locales_update on public.locales
  for update to authenticated
  using (id::text = public.acuva_mi_local_id())
  with check (id::text = public.acuva_mi_local_id());

create policy acuva_locales_insert on public.locales
  for insert to authenticated
  with check (profile_id::text = auth.uid()::text);

-- El cupo y el contador no los puede tocar el local desde el cliente
-- (el contador lo mantiene el trigger acuva_lm_contador, que corre como dueño)
create or replace function public.acuva_locales_proteger_cupo_trg()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.max_members := old.max_members;
    new.linked_members_count := old.linked_members_count;
  end if;
  return new;
end;
$$;

drop trigger if exists acuva_locales_proteger_cupo on public.locales;
create trigger acuva_locales_proteger_cupo
  before update on public.locales
  for each row execute function public.acuva_locales_proteger_cupo_trg();

-- ----------------------------------------------------------
-- Nota: disciplinas queda pública como hoy (es una tabla global,
-- no tiene local_id). Ver resumen del cambio.
-- ----------------------------------------------------------

-- Prueba rápida después de correrlo:
-- 1) Ingresá como local en /login → tenés que ver solo tus socios.
-- 2) Registrá un local nuevo. Si falla con "row-level security",
--    tu trigger de alta (ej. handle_new_user) tiene que ser
--    SECURITY DEFINER: alter function public.handle_new_user() security definer;
