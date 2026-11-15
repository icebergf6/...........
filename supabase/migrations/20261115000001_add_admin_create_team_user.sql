-- ============================================================================
-- MIGRATION: Tambah fungsi admin_create_team_user untuk pendaftaran anggota tim oleh Admin
-- ============================================================================

create or replace function public.admin_create_team_user(
  new_email text,
  new_password text,
  new_username text,
  new_role text default 'user',
  new_tier text default 'Junior Hunter',
  new_hours numeric default 6,
  new_prospects integer default 10,
  new_comm_rate numeric default 0.15,
  new_notes text default ''
)
returns uuid
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  new_user_id uuid;
  clean_uname text;
  clean_email text;
  assigned_role text;
  assigned_tier text;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: Hanya Admin yang dapat mendaftarkan anggota tim baru.';
  end if;

  clean_uname := lower(regexp_replace(trim(new_username), '\s+', '_', 'g'));
  clean_email := lower(trim(new_email));
  assigned_role := case when lower(trim(new_role)) = 'admin' then 'admin' else 'user' end;
  assigned_tier := coalesce(nullif(trim(new_tier), ''), case when assigned_role = 'admin' then 'Core Partner' else 'Junior Hunter' end);

  if exists (select 1 from public.profiles where lower(username) = clean_uname or lower(email) = clean_email) then
    raise exception 'Username atau email sudah digunakan oleh anggota lain.';
  end if;

  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    clean_email,
    extensions.crypt(trim(new_password), extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', clean_uname, 'role', assigned_role),
    now(),
    now()
  );

  insert into public.profiles (
    id,
    username,
    email,
    role,
    status,
    tier,
    target_daily_hours,
    target_daily_prospects,
    custom_commission_rate,
    evaluation_notes,
    created_at,
    updated_at
  )
  values (
    new_user_id,
    clean_uname,
    clean_email,
    assigned_role,
    'active',
    assigned_tier,
    coalesce(new_hours, 6),
    coalesce(new_prospects, 10),
    coalesce(new_comm_rate, 0.15),
    coalesce(new_notes, ''),
    now(),
    now()
  )
  on conflict (id) do update
  set role = excluded.role,
      status = excluded.status,
      tier = excluded.tier,
      target_daily_hours = excluded.target_daily_hours,
      target_daily_prospects = excluded.target_daily_prospects,
      custom_commission_rate = excluded.custom_commission_rate,
      evaluation_notes = excluded.evaluation_notes,
      updated_at = now();

  return new_user_id;
end;
$$;

grant execute on function public.admin_create_team_user(text, text, text, text, text, numeric, integer, numeric, text) to authenticated;
