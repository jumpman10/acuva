-- ==========================================================
-- ACUVA · 00 · INSPECCIÓN (solo lectura, no cambia nada)
-- Correlo antes de los scripts 01 y 02 para ver el estado real
-- de tu base. Si algo del 01 falla, pasame el resultado de esto.
-- ==========================================================

-- Columnas de las tablas que toca la migración
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('locales', 'miembros', 'locales_miembros', 'profiles', 'accesos', 'pagos')
order by table_name, ordinal_position;

-- Políticas RLS actuales (el 02 borra las "Permitir todo acceso público…")
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Qué tablas tienen RLS activado hoy
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;

-- Triggers y funciones que ya existen (ej. handle_new_user, claim_member_account)
select event_object_schema, event_object_table, trigger_name, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth');

select p.proname, p.prosecdef as security_definer
from pg_proc p
where p.pronamespace = 'public'::regnamespace
order by p.proname;
