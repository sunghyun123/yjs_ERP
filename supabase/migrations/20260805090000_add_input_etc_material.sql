-- 투입실적에 기타재료비 컬럼 추가.
-- 적용: Supabase SQL Editor에서 이 파일 전체를 한 번에 실행한다.
--
-- 외주1/외주2와 같은 성격의 칸이다 — 일반관리비 6%가 붙지 않고 입력한 금액을 그대로 쓴다.
-- 기존 행은 default 0으로 채워지므로 과거 합계는 이 컬럼 때문에 달라지지 않는다.
-- RLS는 테이블 단위로 걸려 있어 컬럼 추가만으로 기존 정책이 그대로 적용된다.

alter table public."투입실적"
  add column if not exists "기타재료비" numeric not null default 0;
