-- ============================================================================
-- MIGRATION: Add User Lifecycle Suspended Until & Update Status Check Constraint
-- ============================================================================

-- 1. Tambah kolom suspended_until pada profiles jika belum ada
alter table public.profiles add column if not exists suspended_until timestamptz default null;

-- 2. Lepas check constraint lama jika ada dan buat baru agar mendukung 'suspended' dan 'banned'
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('active', 'probation', 'leave', 'inactive', 'suspended', 'banned'));

-- 3. Ubah default target_daily_hours menjadi 3
alter table public.profiles alter column target_daily_hours set default 3;
