-- 투입실적 상세 테이블 추가 및 기존 고정 컬럼 백필.
-- 적용: Supabase SQL Editor에서 이 파일 전체를 실행하거나 Supabase CLI 마이그레이션으로 적용.
--
-- 기존 투입실적 테이블은 공사+투입일 헤더로 유지하고, 투입구분별 주/야 수량은
-- 투입실적상세에 저장한다. 기존 고정 컬럼은 호환 기간 동안 삭제하지 않는다.

create table if not exists public."투입실적상세" (
  id bigserial primary key,
  "투입실적_id" bigint not null references public."투입실적"(id) on delete cascade,
  "투입구분" text not null,
  "주간수량" numeric not null default 0,
  "야간수량" numeric not null default 0,
  "생성일" timestamptz not null default now(),
  constraint "투입실적상세_투입실적_id_투입구분_key" unique ("투입실적_id", "투입구분")
);

create index if not exists "idx_투입실적상세_투입실적_id"
  on public."투입실적상세" ("투입실적_id");

create index if not exists "idx_투입실적상세_투입구분"
  on public."투입실적상세" ("투입구분");

alter table public."투입실적상세" enable row level security;

-- 운영 DB의 기존 업무 테이블 정책이 더 엄격하면 아래 정책명을 유지한 채 USING/WITH CHECK만 조정한다.
drop policy if exists "투입실적상세_select_authenticated" on public."투입실적상세";
create policy "투입실적상세_select_authenticated"
  on public."투입실적상세"
  for select
  to authenticated
  using (true);

drop policy if exists "투입실적상세_insert_authenticated" on public."투입실적상세";
create policy "투입실적상세_insert_authenticated"
  on public."투입실적상세"
  for insert
  to authenticated
  with check (true);

drop policy if exists "투입실적상세_update_authenticated" on public."투입실적상세";
create policy "투입실적상세_update_authenticated"
  on public."투입실적상세"
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "투입실적상세_delete_authenticated" on public."투입실적상세";
create policy "투입실적상세_delete_authenticated"
  on public."투입실적상세"
  for delete
  to authenticated
  using (true);

insert into public."투입실적상세" ("투입실적_id", "투입구분", "주간수량", "야간수량")
select t.id, v."투입구분", v."주간수량", v."야간수량"
from public."투입실적" t
cross join lateral (
  values
    ('상용직', t."상용직_주", t."상용직_야"),
    ('일용직', t."일용직_주", t."일용직_야"),
    ('모범신호수', t."모범신호수_주", t."모범신호수_야"),
    ('6W', t."w6_주", t."w6_야"),
    ('3W', t."w3_주", t."w3_야"),
    ('덤프15T', t."덤프15t_주", t."덤프15t_야"),
    ('크레인', t."크레인_주", t."크레인_야"),
    ('물청소차', t."물청소차_주", t."물청소차_야"),
    ('MCM', t."mcm_주", t."mcm_야"),
    ('접속', t."접속_주", t."접속_야")
) as v("투입구분", "주간수량", "야간수량")
on conflict ("투입실적_id", "투입구분") do update
set
  "주간수량" = excluded."주간수량",
  "야간수량" = excluded."야간수량";
