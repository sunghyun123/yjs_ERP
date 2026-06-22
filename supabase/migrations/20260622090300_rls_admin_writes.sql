-- supabase/migrations/20260622090300_rls_admin_writes.sql
-- 거래처(clients)·공사단가(rates) '쓰기'를 admin 화이트리스트만 허용.
-- 읽기(select_whitelisted)는 전 화이트리스트 사용자 유지.
-- 선행: 20260622090000_rls_whitelist_helper.sql, 20260622090100_rls_whitelist_policies.sql

create or replace function public.is_admin()
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
      and w.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is
  '현재 세션의 kakao_id(auth.identities 기준)가 whitelist에 있고 role=admin이면 true. RLS 정책 전용.';

do $$
declare
  t text;
  tables text[] := array['거래처','공사단가'];
begin
  foreach t in array tables loop
    -- 쓰기 정책만 admin으로 교체 (select_whitelisted는 유지)
    execute format('drop policy if exists %I on public.%I;', t || '_insert_whitelisted', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update_whitelisted', t);
    execute format('drop policy if exists %I on public.%I;', t || '_delete_whitelisted', t);

    execute format($f$
      create policy %I on public.%I for insert to authenticated
        with check ((select public.is_admin()));
    $f$, t || '_insert_admin', t);
    execute format($f$
      create policy %I on public.%I for update to authenticated
        using ((select public.is_admin())) with check ((select public.is_admin()));
    $f$, t || '_update_admin', t);
    execute format($f$
      create policy %I on public.%I for delete to authenticated
        using ((select public.is_admin()));
    $f$, t || '_delete_admin', t);
  end loop;
end $$;
