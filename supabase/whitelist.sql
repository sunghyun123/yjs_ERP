-- 카카오 화이트리스트: 로그인 허용 직원 명단 (원본은 kakao_whitelist.json)
create table if not exists public.whitelist (
  kakao_id   text primary key,
  user_name  text not null,
  role       text not null default 'worker',
  updated_at timestamptz not null default now()
);

alter table public.whitelist enable row level security;

-- 로그인한 사용자(콜백/레이아웃의 세션)는 명단을 조회할 수 있어야 검증이 동작한다.
-- 동기화 스크립트는 service-role 키라 RLS를 우회하므로 별도 정책 불필요.
drop policy if exists "whitelist_select_authenticated" on public.whitelist;
create policy "whitelist_select_authenticated"
  on public.whitelist
  for select
  to authenticated
  using (true);
