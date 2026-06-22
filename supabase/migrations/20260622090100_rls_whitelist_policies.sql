-- supabase/migrations/20260622090100_rls_whitelist_policies.sql
-- 모든 업무 테이블의 RLS를 "화이트리스트 사용자만"으로 교체.
-- (select public.is_whitelisted())로 감싸 쿼리당 1회만 평가(성능).
-- whitelist 테이블은 제외(콜백/레이아웃이 본인 여부 조회에 필요).
-- 선행: 20260622090000_rls_whitelist_helper.sql (is_whitelisted 함수)

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
    -- RLS 보장
    execute format('alter table public.%I enable row level security;', t);

    -- 기존 *_authenticated 정책 제거 (이름 규칙: <table>_<op>_authenticated)
    execute format('drop policy if exists %I on public.%I;', t || '_select_authenticated', t);
    execute format('drop policy if exists %I on public.%I;', t || '_insert_authenticated', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update_authenticated', t);
    execute format('drop policy if exists %I on public.%I;', t || '_delete_authenticated', t);
    -- 과거에 만들었을 수 있는 통합 정책도 정리
    execute format('drop policy if exists %I on public.%I;', t || '_all_authenticated', t);

    -- 화이트리스트 전용 정책 재생성
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using ((select public.is_whitelisted()));
    $f$, t || '_select_whitelisted', t);

    execute format($f$
      create policy %I on public.%I
        for insert to authenticated
        with check ((select public.is_whitelisted()));
    $f$, t || '_insert_whitelisted', t);

    execute format($f$
      create policy %I on public.%I
        for update to authenticated
        using ((select public.is_whitelisted()))
        with check ((select public.is_whitelisted()));
    $f$, t || '_update_whitelisted', t);

    execute format($f$
      create policy %I on public.%I
        for delete to authenticated
        using ((select public.is_whitelisted()));
    $f$, t || '_delete_whitelisted', t);
  end loop;
end $$;
