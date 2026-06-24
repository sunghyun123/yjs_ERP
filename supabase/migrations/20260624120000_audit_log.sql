-- 변경내역 추적: 모든 대상 테이블의 INSERT/UPDATE/DELETE를 audit_log에 적재.
-- 레거시 ERP 이중입력을 위한 한시적 운영 보조. (수개월 후 프루닝/드롭 대상)

create table public.audit_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  operation   text not null check (operation in ('INSERT', 'UPDATE', 'DELETE')),
  row_id      bigint,
  old_data    jsonb,
  new_data    jsonb,
  changed_at  timestamptz not null default now()
);

-- 기간 조회용 인덱스 (기본 정렬 = changed_at desc)
create index audit_log_changed_at_idx on public.audit_log (changed_at desc);

-- 범용 트리거 함수.
-- security definer 이유: audit_log에 RLS를 켜면, 일반 사용자의 mutation이
-- 트리거로 audit_log에 INSERT를 시도할 때 RLS에 막혀 원래 작업까지 실패한다.
-- 함수를 소유자(postgres) 권한으로 실행해 RLS를 우회한다.
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
    values (tg_table_name, tg_op, old.id, to_jsonb(old), null);
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
    values (tg_table_name, tg_op, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  else -- INSERT
    insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
    values (tg_table_name, tg_op, new.id, null, to_jsonb(new));
    return new;
  end if;
end;
$$;

-- 대상 테이블마다 트리거 부착
create trigger audit_수주          after insert or update or delete on public.수주          for each row execute function public.audit_trigger();
create trigger audit_기성          after insert or update or delete on public.기성          for each row execute function public.audit_trigger();
create trigger audit_공사이력      after insert or update or delete on public.공사이력      for each row execute function public.audit_trigger();
create trigger audit_투입실적      after insert or update or delete on public.투입실적      for each row execute function public.audit_trigger();
create trigger audit_투입실적상세  after insert or update or delete on public.투입실적상세  for each row execute function public.audit_trigger();
create trigger audit_공사현장      after insert or update or delete on public.공사현장      for each row execute function public.audit_trigger();
create trigger audit_거래처        after insert or update or delete on public.거래처        for each row execute function public.audit_trigger();
create trigger audit_공사단가      after insert or update or delete on public.공사단가      for each row execute function public.audit_trigger();
create trigger audit_공무담당자    after insert or update or delete on public.공무담당자    for each row execute function public.audit_trigger();

-- RLS: admin만 조회. INSERT/UPDATE/DELETE 정책 없음(클라이언트 직접 조작 불가).
alter table public.audit_log enable row level security;

create policy audit_log_admin_select on public.audit_log
  for select using ((select public.is_admin()));

comment on table public.audit_log is
  '변경내역 추적(레거시 ERP 이중입력용 한시적 도구). 트리거 audit_trigger가 적재.';
