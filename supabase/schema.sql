-- ============================================================================
-- A-TIER MANAGEMENT: TEAM CLIENT HUNTING, FINANCE & ATTENDANCE SCHEMA (SUPABASE)
-- ============================================================================

-- 1. Tabel Profiles (Terhubung dengan auth.users, termasuk siklus hidup & target karir)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text not null default '',
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'probation', 'leave', 'inactive')),
  tier text not null default 'Junior Hunter',
  target_daily_hours numeric(5, 2) not null default 6,
  target_daily_prospects integer not null default 10,
  custom_commission_rate numeric(5, 4) not null default 0.15,
  evaluation_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pastikan kolom lifecycle tersedia jika tabel sudah dibuat sebelumnya
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists tier text not null default 'Junior Hunter';
alter table public.profiles add column if not exists target_daily_hours numeric(5, 2) not null default 6;
alter table public.profiles add column if not exists target_daily_prospects integer not null default 10;
alter table public.profiles add column if not exists custom_commission_rate numeric(5, 4) not null default 0.15;
alter table public.profiles add column if not exists evaluation_notes text not null default '';

-- 2. Tabel Prospects (Prospek, Keuangan Deal, Renewal, Project Pipeline & Audit Admin)
create table if not exists public.prospects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  created_by_username text not null default 'tim',
  client_name text not null,
  source_platform text not null default 'Google Maps'
    check (source_platform in (
      'Google Maps', 'Instagram', 'TikTok', 'Facebook',
      'LinkedIn', 'WhatsApp', 'Website', 'Lainnya'
    )),
  social_handle text not null default '',
  whatsapp_number text default '',
  status text not null default 'Baru'
    check (status in ('Baru', 'Dihubungi', 'Follow Up', 'Negosiasi', 'Deal', 'Batal')),
  management_type text not null default 'full_managed'
    check (management_type in ('full_managed', 'project_only')),
  notes text default '',
  -- Kolom Keuangan Khusus Klien Deal (Jasa Web Design)
  currency text not null default 'IDR' check (currency in ('IDR', 'USD')),
  project_value numeric(15, 2) not null default 0,
  dp_amount numeric(15, 2) not null default 0,
  payment_status text not null default 'Belum DP'
    check (payment_status in ('Belum DP', 'DP Masuk', 'Lunas')),
  deal_date timestamptz,
  -- Fitur Reminder & Follow-Up
  next_follow_up_date date,
  follow_up_notes jsonb not null default '[]'::jsonb,
  -- Fitur Delivery Proyek & Asset Vault (Live URL, Staging, Kredensial, Checklist)
  delivery_assets jsonb default '{}'::jsonb,
  -- Fitur Komisi & Bagi Hasil Tim Hunter
  commission jsonb default '{}'::jsonb,
  -- Fitur Langganan & Perpanjangan Domain / Cloud Hosting (Full Managed)
  renewal_enabled boolean not null default false,
  renewal_cycle text not null default 'Yearly' check (renewal_cycle in ('Yearly', 'Monthly')),
  renewal_service_name text default 'Perpanjangan Domain & Cloud Hosting Tahunan',
  renewal_price numeric(15, 2) not null default 0,
  renewal_cost numeric(15, 2) not null default 0,
  renewal_due_date date,
  renewal_total_collected numeric(15, 2) not null default 0,
  renewal_total_net_profit numeric(15, 2) not null default 0,
  renewal_history jsonb not null default '[]'::jsonb,
  -- Fitur Manajemen Project Agensi (Admin Pipeline & PIC)
  project_status text not null default 'briefing'
    check (project_status in ('briefing', 'design', 'development', 'review', 'completed')),
  project_assignee text default '',
  -- Fitur Audit Keaslian Kerja Harian Admin
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  verification_notes text default '',
  verified_by text default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pastikan kolom tambahan prospects tersedia jika tabel sudah dibuat sebelumnya
alter table public.prospects add column if not exists management_type text not null default 'full_managed';
alter table public.prospects add column if not exists renewal_enabled boolean not null default false;
alter table public.prospects add column if not exists renewal_cycle text not null default 'Yearly';
alter table public.prospects add column if not exists renewal_service_name text default 'Perpanjangan Domain & Cloud Hosting Tahunan';
alter table public.prospects add column if not exists renewal_price numeric(15, 2) not null default 0;
alter table public.prospects add column if not exists renewal_cost numeric(15, 2) not null default 0;
alter table public.prospects add column if not exists renewal_due_date date;
alter table public.prospects add column if not exists renewal_total_collected numeric(15, 2) not null default 0;
alter table public.prospects add column if not exists renewal_total_net_profit numeric(15, 2) not null default 0;
alter table public.prospects add column if not exists renewal_history jsonb not null default '[]'::jsonb;
alter table public.prospects add column if not exists project_status text not null default 'briefing';
alter table public.prospects add column if not exists project_assignee text default '';
alter table public.prospects add column if not exists verification_status text not null default 'pending';
alter table public.prospects add column if not exists verification_notes text default '';
alter table public.prospects add column if not exists verified_by text default '';
alter table public.prospects add column if not exists verified_at timestamptz;

-- 3. Tabel Payment Accounts (Metode Pembayaran / Rekening Tim Maksimal 10 Akun)
create table if not exists public.payment_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  provider_type text not null default 'international' check (provider_type in ('international', 'local_bank', 'ewallet', 'other')),
  provider_name text not null,
  account_name text not null,
  account_number text not null,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Tabel Attendance Logs (Absensi & Stopwatch Jam Kerja Harian User)
create table if not exists public.attendance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  username text not null,
  work_date date not null default current_date,
  status text not null default 'running'
    check (status in ('running', 'paused', 'completed')),
  accumulated_seconds integer not null default 0,
  last_started_at timestamptz,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  notes text default '',
  focus_tag text not null default 'Hunting Prospek',
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

alter table public.attendance_logs add column if not exists focus_tag text not null default 'Hunting Prospek';

-- 5. Tabel Studio Settings (Konfigurasi Global Studio & Target Default)
create table if not exists public.studio_settings (
  id integer primary key default 1 check (id = 1),
  studio_name text not null default 'A-TIER WEB DESIGN STUDIO',
  studio_contact text not null default 'Email: billing@atier-studio.com | WhatsApp: +62 812-3456-7801',
  hunter_rate numeric(5, 4) not null default 0.15,
  designer_dev_rate numeric(5, 4) not null default 0.60,
  studio_treasury_rate numeric(5, 4) not null default 0.25,
  usd_exchange_rate numeric(15, 2) not null default 16000,
  daily_target_hours numeric(5, 2) not null default 6,
  daily_target_prospects integer not null default 10,
  updated_at timestamptz not null default now()
);

insert into public.studio_settings (id)
values (1)
on conflict (id) do nothing;

-- ============================================================================
-- HELPER FUNCTIONS UNTUK RLS & AUTENTIKASI TIM
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.get_my_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles
  where id = auth.uid()
  limit 1;
$$;

-- Fungsi lookup email berdasarkan username agar user bisa login memakai Username maupun Email
create or replace function public.get_email_by_username(lookup_username text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.profiles
  where lower(username) = lower(trim(lookup_username))
  limit 1;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- Fungsi khusus Admin untuk mereset password anggota tim di Supabase Auth
create or replace function public.admin_reset_user_password(target_user_id uuid, new_password text)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: Hanya Admin yang dapat mereset password anggota.';
  end if;

  if length(trim(coalesce(new_password, ''))) < 4 then
    raise exception 'Password baru minimal 4 karakter.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(trim(new_password), extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;
end;
$$;

grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;

-- Fungsi khusus Admin untuk menghapus akun anggota tim dari Supabase Auth & Profiles
create or replace function public.admin_delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak: Hanya Admin yang dapat menghapus akun anggota.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Tidak dapat menghapus akun Admin yang sedang digunakan.';
  end if;

  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user_account(uuid) to authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.prospects enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.studio_settings enable row level security;

-- Policies untuk profiles
drop policy if exists "Team members can view all profiles" on public.profiles;
create policy "Team members can view all profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can update their own profile without privilege escalation" on public.profiles;
create policy "Users can update their own profile without privilege escalation"
  on public.profiles for update
  using (
    auth.uid() = id or public.is_admin()
  )
  with check (
    public.is_admin()
    or (
      auth.uid() = id
      and role = public.get_my_role()
    )
  );

drop policy if exists "Users can insert their own non-admin profile" on public.profiles;
create policy "Users can insert their own non-admin profile"
  on public.profiles for insert
  with check (
    public.is_admin()
    or (auth.uid() = id and role = 'user')
  );

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id or public.is_admin());

-- Policies untuk prospects
drop policy if exists "Team can view all shared prospects" on public.prospects;
create policy "Team can view all shared prospects"
  on public.prospects for select
  using (auth.role() = 'authenticated');

drop policy if exists "Team can insert prospects" on public.prospects;
create policy "Team can insert prospects"
  on public.prospects for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Team can update shared prospects" on public.prospects;
create policy "Team can update shared prospects"
  on public.prospects for update
  using (auth.role() = 'authenticated');

drop policy if exists "Only owner or admin can delete shared prospects" on public.prospects;
create policy "Only owner or admin can delete shared prospects"
  on public.prospects for delete
  using (
    auth.uid() = user_id or public.is_admin()
  );

-- Policies untuk payment_accounts
drop policy if exists "Team can view payment accounts" on public.payment_accounts;
create policy "Team can view payment accounts"
  on public.payment_accounts for select
  using (auth.role() = 'authenticated');

drop policy if exists "Only admin can insert payment accounts" on public.payment_accounts;
create policy "Only admin can insert payment accounts"
  on public.payment_accounts for insert
  with check (public.is_admin());

drop policy if exists "Only admin can update payment accounts" on public.payment_accounts;
create policy "Only admin can update payment accounts"
  on public.payment_accounts for update
  using (public.is_admin());

drop policy if exists "Only admin can delete payment accounts" on public.payment_accounts;
create policy "Only admin can delete payment accounts"
  on public.payment_accounts for delete
  using (public.is_admin());

-- Policies untuk attendance_logs
drop policy if exists "Team and admin can view all attendance logs" on public.attendance_logs;
create policy "Team and admin can view all attendance logs"
  on public.attendance_logs for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users can insert own attendance or admin" on public.attendance_logs;
create policy "Users can insert own attendance or admin"
  on public.attendance_logs for insert
  with check (
    auth.uid() = user_id or public.is_admin()
  );

drop policy if exists "Users can update own attendance or admin" on public.attendance_logs;
create policy "Users can update own attendance or admin"
  on public.attendance_logs for update
  using (
    auth.uid() = user_id or public.is_admin()
  );

drop policy if exists "Only admin can delete attendance logs" on public.attendance_logs;
create policy "Only admin can delete attendance logs"
  on public.attendance_logs for delete
  using (public.is_admin());

-- Policies untuk studio_settings
drop policy if exists "Team can view studio settings" on public.studio_settings;
create policy "Team can view studio settings"
  on public.studio_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "Only admin can update studio settings" on public.studio_settings;
create policy "Only admin can update studio settings"
  on public.studio_settings for update
  using (public.is_admin());

drop policy if exists "Only admin can insert studio settings" on public.studio_settings;
create policy "Only admin can insert studio settings"
  on public.studio_settings for insert
  with check (public.is_admin());

-- ============================================================================
-- TRIGGERS OTOMATIS SUPABASE AUTH -> PROFILES
-- ============================================================================

-- Auto-confirm email saat registrasi internal agar anggota tim bisa langsung login
create or replace function public.auto_confirm_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  before insert on auth.users
  for each row execute procedure public.auto_confirm_auth_user();

-- Buat baris profile otomatis saat user baru dibuat di auth.users
-- User pertama yang mendaftar di studio (jika belum ada admin) otomatis menjadi Admin utama
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  has_admin boolean;
  assigned_role text;
  assigned_tier text;
  clean_uname text;
begin
  select exists (select 1 from public.profiles where role = 'admin') into has_admin;
  clean_uname := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '\s+', '_', 'g'));

  if not has_admin or clean_uname = 'leo_syafiq' then
    assigned_role := 'admin';
    assigned_tier := 'Core Partner';
  else
    assigned_role := 'user';
    assigned_tier := 'Junior Hunter';
  end if;

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
    evaluation_notes
  )
  values (
    new.id,
    clean_uname,
    new.email,
    assigned_role,
    'active',
    assigned_tier,
    6,
    10,
    0.15,
    ''
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- AKTIFKAN SUPABASE REALTIME PUBLICATION
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.prospects;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.payment_accounts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.attendance_logs;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.studio_settings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
