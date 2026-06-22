-- supabase/migrations/20260622090200_rls_whitelist_rollback.sql
-- 비상 롤백 전용 — 평상시 적용 금지.
-- _whitelisted 정책을 제거하고 기존 authenticated using(true) 정책으로 되돌린다.
-- (is_whitelisted 매칭 오류로 정상 사용자까지 차단되는 사고 시 즉시 복구용)
do $$
declare
  t text;
  tables text[] := array[
    '사용자','거래처','공사단가','수주','기성','공사이력',
    '투입실적','투입실적상세','시스템설정','계획금액',
    'dashboard_공사','공무담당자','공무_월간계획','공무_주간보고'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I;', t || '_select_whitelisted', t);
    execute format('drop policy if exists %I on public.%I;', t || '_insert_whitelisted', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update_whitelisted', t);
    execute format('drop policy if exists %I on public.%I;', t || '_delete_whitelisted', t);

    execute format($f$
      create policy %I on public.%I for select to authenticated using (true);
    $f$, t || '_select_authenticated', t);
    execute format($f$
      create policy %I on public.%I for insert to authenticated with check (true);
    $f$, t || '_insert_authenticated', t);
    execute format($f$
      create policy %I on public.%I for update to authenticated using (true) with check (true);
    $f$, t || '_update_authenticated', t);
    execute format($f$
      create policy %I on public.%I for delete to authenticated using (true);
    $f$, t || '_delete_authenticated', t);
  end loop;
end $$;
