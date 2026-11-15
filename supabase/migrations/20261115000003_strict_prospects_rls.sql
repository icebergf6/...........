-- ============================================================================
-- MIGRATION: Pengerasan Row Level Security (RLS) Tabel Prospects (SEC-01)
-- ============================================================================

-- 1. Cabut policy lama yang terlalu permisif
drop policy if exists "Team can view all shared prospects" on public.prospects;
drop policy if exists "Team can update shared prospects" on public.prospects;
drop policy if exists "Strict prospect access control" on public.prospects;
drop policy if exists "Strict prospect update control" on public.prospects;

-- 2. Kebijakan SELECT yang ketat:
-- - Pembuat prospek (owner) dapat melihat datanya sendiri
-- - Seluruh tim dapat melihat prospek yang sudah berstatus 'Deal' (untuk alur pengerjaan PIC web & hosting bersama)
-- - Administrator dapat melihat seluruh prospek tim untuk pengawasan & audit
create policy "Strict prospect access control"
  on public.prospects for select
  using (
    auth.uid() = user_id
    or status = 'Deal'
    or public.is_admin()
  );

-- 3. Kebijakan UPDATE yang ketat:
-- - Hanya pemilik prospek (owner), PIC project yang ditugaskan (jika status Deal), atau Admin yang boleh mengubah data
create policy "Strict prospect update control"
  on public.prospects for update
  using (
    auth.uid() = user_id
    or (
      status = 'Deal'
      and exists (
        select 1 from public.profiles
        where id = auth.uid()
        and lower(username) = lower(public.prospects.project_assignee)
      )
    )
    or public.is_admin()
  );

-- 4. Fungsi Deteksi Duplikat Aman Privasi (Security Definer)
-- Memeriksa apakah nomor WhatsApp atau nama bisnis sudah terdaftar tanpa membocorkan isi catatan/detail pribadi hunter lain
create or replace function public.check_prospect_duplicate(
  p_client_name text,
  p_whatsapp_number text default '',
  p_social_handle text default ''
)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_clean_wa text;
  v_match record;
begin
  v_clean_wa := regexp_replace(coalesce(p_whatsapp_number, ''), '\D', '', 'g');

  select id, user_id, created_by_username, client_name, whatsapp_number, created_at, status
  into v_match
  from public.prospects
  where
    (
      v_clean_wa <> '' and length(v_clean_wa) >= 8 and
      regexp_replace(coalesce(whatsapp_number, ''), '\D', '', 'g') = v_clean_wa
    )
    or
    (
      trim(lower(p_client_name)) <> '' and
      trim(lower(client_name)) = trim(lower(p_client_name))
    )
  order by created_at asc
  limit 1;

  if v_match.id is not null then
    return jsonb_build_object(
      'isDuplicate', true,
      'isOwner', (v_match.user_id = auth.uid()),
      'ownerUsername', coalesce(v_match.created_by_username, 'tim'),
      'status', v_match.status,
      'matchedField', case when v_clean_wa <> '' and regexp_replace(coalesce(v_match.whatsapp_number, ''), '\D', '', 'g') = v_clean_wa then 'Nomor WhatsApp' else 'Nama Bisnis' end
    );
  end if;

  return jsonb_build_object('isDuplicate', false);
end;
$$;

grant execute on function public.check_prospect_duplicate(text, text, text) to authenticated;
