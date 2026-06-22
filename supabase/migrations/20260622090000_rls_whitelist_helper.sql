-- supabase/migrations/20260622090000_rls_whitelist_helper.sql
-- 현재 세션 사용자의 kakao_id가 whitelist에 있으면 true.
-- auth.identities는 GoTrue가 관리하며 사용자가 수정할 수 없으므로,
-- user_metadata 대신 여기서만 kakao_id를 읽어 위조를 막는다.
-- kakao_id 우선순위는 src/lib/whitelist.ts extractKakaoId()와 동일:
--   identities.provider_id(컬럼) → identity_data->>'provider_id' → identity_data->>'sub'

create or replace function public.is_whitelisted()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.identities i
    join public.whitelist w
      on w.kakao_id = coalesce(
           i.provider_id,
           i.identity_data->>'provider_id',
           i.identity_data->>'sub'
         )
    where i.user_id = auth.uid()
      and i.provider = 'kakao'
  );
$$;

-- 익명(anon)에는 부여하지 않는다 — 로그인된 사용자만 평가 대상.
revoke all on function public.is_whitelisted() from public;
grant execute on function public.is_whitelisted() to authenticated;

comment on function public.is_whitelisted() is
  '현재 세션의 kakao_id(auth.identities 기준)가 public.whitelist에 있으면 true. RLS 정책 전용.';
