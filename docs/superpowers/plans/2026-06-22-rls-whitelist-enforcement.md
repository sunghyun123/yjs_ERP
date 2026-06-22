# RLS 화이트리스트 강제 (방향 A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 업무 테이블의 RLS 정책을 `using(true)`에서 "현재 세션의 kakao_id가 whitelist에 있을 때만 허용"으로 바꿔, 앱을 우회한 직접 API 호출(anon key + 세션)로 데이터를 읽거나 변조하는 구멍을 DB 레벨에서 닫는다.

**Architecture:** GoTrue가 관리하는 `auth.identities`(사용자가 위조 불가)에서 kakao_id를 읽어 `public.whitelist`와 대조하는 `SECURITY DEFINER` 함수 `public.is_whitelisted()`를 만든다. 각 업무 테이블의 4개 정책(select/insert/update/delete)을 이 함수 호출로 교체한다. 성능을 위해 정책 안에서 `(select public.is_whitelisted())`로 감싸 쿼리당 1회만 평가되게 한다. 앱 코드는 변경 없음 — 화이트리스트 사용자는 그대로 통과하고, 비화이트리스트/퇴사자만 DB 레벨에서 차단된다.

**Tech Stack:** Supabase (PostgreSQL 15 + GoTrue), RLS policies, plpgsql/sql functions. 적용은 Supabase SQL Editor 또는 Supabase CLI 마이그레이션.

---

## 배경 / 현재 상태 (실행 전 반드시 읽기)

- **인증 흐름:** 카카오 OAuth로 로그인하면 누구나 Supabase 세션이 발급된다. 화이트리스트 검사는 앱 레이어(`src/app/(dashboard)/layout.tsx`, `src/app/auth/callback/route.ts`)에서만 한다.
- **구멍:** 입력 폼들(`InputForm`, `GongmuClient`, `RatesClient`, `ProgressInputForm`)은 브라우저에서 **anon key로 DB에 직접 쓰기**를 한다. 실질적 방어선은 RLS 하나뿐인데 모든 업무 테이블 정책이 `using(true)/with check(true)`라 **인증만 되면 전부 허용**. → 화이트리스트에 없는(또는 퇴사 처리된) 사람이 세션만 들고 PostgREST에 직접 요청하면 모든 테이블을 읽고/쓰고/지울 수 있다.
- **kakao_id 추출 로직(앱):** `src/lib/whitelist.ts`의 `extractKakaoId()` — kakao identity의 `identity_data.provider_id` → `sub` → `identity.id` → `user_metadata` 순. RLS 함수도 **이 우선순위를 그대로** 따른다. 단, `user_metadata`는 사용자가 `supabase.auth.updateUser()`로 수정 가능하므로 **RLS에서는 절대 user_metadata를 신뢰하지 않고** GoTrue가 관리하는 `auth.identities`만 본다.
- **클라이언트 3종:**
  - `src/lib/supabase/admin.ts` — service role. **RLS를 우회**한다(`dashboard-sync` 라우트, 동기화/백업 스크립트). 영향 없음.
  - `src/lib/supabase/server.ts` / `client.ts` — 사용자 세션(authenticated role). **RLS 적용 대상**. 화이트리스트 사용자는 통과하므로 정상 동작.
- **whitelist 테이블 정책은 유지:** `supabase/whitelist.sql`의 `whitelist_select_authenticated`(authenticated `using(true)`)는 그대로 둔다. 콜백/레이아웃이 본인의 화이트리스트 여부를 조회해야 하기 때문. (명단은 이름 목록이라 노출 위험이 낮고, 이게 막히면 로그인 자체가 깨진다.)

## 적용 대상 테이블 (database.ts 기준, 14종)

`사용자`, `거래처`, `공사단가`, `수주`, `기성`, `공사이력`, `투입실적`, `투입실적상세`, `시스템설정`, `계획금액`, `dashboard_공사`, `공무담당자`, `공무_월간계획`, `공무_주간보고`

> `whitelist`는 제외(위 설명 참고). `auth.*` 스키마는 손대지 않는다.

## File Structure

- **Create:** `supabase/migrations/20260622090000_rls_whitelist_helper.sql` — `is_whitelisted()` 헬퍼 함수 + grant.
- **Create:** `supabase/migrations/20260622090100_rls_whitelist_policies.sql` — 14개 업무 테이블의 정책 교체.
- **Create:** `supabase/migrations/20260622090200_rls_whitelist_rollback.sql` — 비상 롤백(정책을 `using(true)`로 복원). 적용하지 않고 보관만; 사고 시 실행.
- **Modify:** `supabase/migrations/20260618110500_add_input_result_details.sql` — 수정하지 않음. (이 파일의 `투입실적상세` 정책은 새 마이그레이션이 `drop ... if exists` 후 재생성하므로 덮어쓰기됨. 파일 자체는 히스토리로 남긴다.)

---

## Task 1: `is_whitelisted()` 헬퍼 함수 작성

세션의 auth user → kakao identity → whitelist 존재 여부를 boolean으로 반환하는 함수. `auth.identities`(신뢰 가능)에서만 kakao_id를 읽는다.

**Files:**
- Create: `supabase/migrations/20260622090000_rls_whitelist_helper.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
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
```

- [ ] **Step 2: SQL Editor에서 함수 생성 실행**

Supabase 대시보드 → SQL Editor에 위 파일 전체를 붙여넣고 실행.
Expected: `Success. No rows returned`

- [ ] **Step 3: 함수가 실제 사용자에 대해 올바르게 동작하는지 검증**

먼저 화이트리스트에 있는 실제 auth user의 uid와, (있다면) 화이트리스트에 없는 auth user의 uid를 확보한다:

```sql
-- 화이트리스트에 매칭되는 사용자 (true가 나와야 할 대상)
select i.user_id, w.user_name
from auth.identities i
join public.whitelist w
  on w.kakao_id = coalesce(i.provider_id, i.identity_data->>'provider_id', i.identity_data->>'sub')
where i.provider = 'kakao'
limit 5;

-- 화이트리스트에 없는 카카오 사용자 (false가 나와야 할 대상)
select i.user_id
from auth.identities i
left join public.whitelist w
  on w.kakao_id = coalesce(i.provider_id, i.identity_data->>'provider_id', i.identity_data->>'sub')
where i.provider = 'kakao' and w.kakao_id is null
limit 5;
```

그다음 세션을 흉내 내어 함수를 호출한다(위에서 얻은 uid로 `<UID>` 치환):

```sql
-- 화이트리스트 사용자: true 기대
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<WHITELISTED_UID>","role":"authenticated"}';
  select public.is_whitelisted() as should_be_true;
rollback;

-- 비화이트리스트 사용자: false 기대
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<NON_WHITELISTED_UID>","role":"authenticated"}';
  select public.is_whitelisted() as should_be_false;
rollback;
```

Expected: 첫 블록 `should_be_true = true`, 둘째 블록 `should_be_false = false`.

> 만약 첫 블록이 false면 kakao_id 매칭이 틀린 것이다. Step 3 첫 쿼리의 join이 0건이면 `auth.identities`에 `provider_id` 컬럼이 없는 구(舊) GoTrue일 수 있으니, `i.provider_id`를 빼고 `identity_data->>'provider_id'` / `->>'sub'`만으로 매칭되는지 확인한 뒤 함수의 coalesce를 그에 맞게 조정한다. **Task 2로 넘어가기 전에 이 검증이 반드시 통과해야 한다.**

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260622090000_rls_whitelist_helper.sql
git commit -m "feat(rls): add is_whitelisted() helper reading auth.identities"
```

---

## Task 2: 업무 테이블 14종 정책 교체 마이그레이션 작성

각 테이블에 대해 기존 `..._authenticated` 정책을 드롭하고, `(select public.is_whitelisted())`로 감싼 정책으로 재생성한다. `(select ...)` 래핑은 Postgres가 행마다 함수를 호출하지 않고 쿼리당 1회만 평가(initplan)하게 해 성능을 지킨다.

**Files:**
- Create: `supabase/migrations/20260622090100_rls_whitelist_policies.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260622090100_rls_whitelist_policies.sql
-- 모든 업무 테이블의 RLS를 "화이트리스트 사용자만"으로 교체.
-- (select public.is_whitelisted())로 감싸 쿼리당 1회만 평가(성능).
-- whitelist 테이블은 제외(콜백/레이아웃이 본인 여부 조회에 필요).

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
```

- [ ] **Step 2: 적용 전, 현재 정책 스냅샷 저장(롤백 대비)**

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```
결과를 복사해 PR 설명이나 메모에 붙여둔다. (Task 4 롤백의 근거.)

- [ ] **Step 3: SQL Editor에서 정책 교체 실행**

위 마이그레이션 파일 전체를 SQL Editor에서 실행.
Expected: `Success. No rows returned`

- [ ] **Step 4: 정책이 모두 교체됐는지 확인**

```sql
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and policyname like '%_whitelisted'
group by tablename
order by tablename;
```
Expected: 14개 테이블 각각 `policy_count = 4`.

```sql
-- 남아있는 _authenticated 업무정책이 없는지 (whitelist 테이블 것만 남아야 함)
select tablename, policyname
from pg_policies
where schemaname='public' and policyname like '%_authenticated';
```
Expected: `whitelist / whitelist_select_authenticated` 한 줄만.

- [ ] **Step 5: 커밋**

```bash
git add supabase/migrations/20260622090100_rls_whitelist_policies.sql
git commit -m "feat(rls): gate all business tables behind is_whitelisted()"
```

---

## Task 3: 동작 검증 (화이트리스트 통과 / 비화이트리스트 차단)

실제 PostgREST 경로에서 화이트리스트 사용자는 통과하고 비화이트리스트는 막히는지 확인한다.

**Files:** (코드 변경 없음 — 검증만)

- [ ] **Step 1: SQL 레벨 RLS 시뮬레이션 — 화이트리스트 사용자(읽기 가능)**

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<WHITELISTED_UID>","role":"authenticated"}';
  select count(*) as visible_rows from public."수주";   -- >0 또는 실제 건수
  insert into public."공무담당자"("이름") values ('RLS_TEST_OK') returning id;  -- 성공해야 함
rollback;  -- 테스트 행은 롤백으로 제거
```
Expected: select는 실제 건수 반환, insert는 `id` 반환(성공). `rollback`으로 테스트 행 정리.

- [ ] **Step 2: SQL 레벨 RLS 시뮬레이션 — 비화이트리스트 사용자(차단)**

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<NON_WHITELISTED_UID>","role":"authenticated"}';
  select count(*) as visible_rows from public."수주";   -- 0 기대
  -- insert는 with check 위반으로 에러가 나야 한다
  insert into public."공무담당자"("이름") values ('RLS_TEST_BLOCKED');
rollback;
```
Expected: `visible_rows = 0`, insert는 `new row violates row-level security policy` 에러.

> `<NON_WHITELISTED_UID>`가 없으면(전원 화이트리스트라면) 임시로 본인 kakao_id를 whitelist에서 지웠다가 테스트 후 복원하거나, 존재하지 않는 임의 uuid(`'00000000-0000-0000-0000-000000000000'`)로 대체한다. 임의 uuid는 identity가 없어 false가 되어야 한다.

- [ ] **Step 3: 실제 앱 스모크 테스트 (화이트리스트 사용자)**

`npm run dev` 후 본인 카카오 계정으로 로그인하여:
- 대시보드/매출손익/공정 페이지가 정상 렌더(서버 컴포넌트 = authenticated role 읽기) 되는지
- `/input`에서 투입실적 1건 저장 → 성공 토스트, 새로고침 후 유지되는지
- `/admin/rates`에서 단가 수정 → 성공하는지

Expected: 모두 정상. (실패 시 콘솔/네트워크 탭에서 PostgREST 401/`row-level security` 응답 확인 → is_whitelisted 매칭 디버그.)

- [ ] **Step 4: 우회 차단 확인 (선택, 강력 권장)**

화이트리스트에 없는 별도 카카오 계정으로 로그인 시도 → `/auth/signout?reason=not_allowed`로 튕기는지(기존 동작). 그 계정의 access token으로 PostgREST에 직접 호출했을 때 빈 결과/403이 오는지 확인:

```bash
# <PROJECT_REF>, <ANON_KEY>, <NON_WHITELISTED_ACCESS_TOKEN> 치환
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/수주?select=*" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <NON_WHITELISTED_ACCESS_TOKEN>"
```
Expected: `[]` (빈 배열). 정책 적용 전이라면 전체 행이 반환됐을 자리.

- [ ] **Step 5: 검증 결과 기록 커밋(문서)**

```bash
git add docs/superpowers/plans/2026-06-22-rls-whitelist-enforcement.md
git commit -m "docs(rls): record whitelist RLS verification results"
```

---

## Task 4: 롤백 스크립트 준비 (적용하지 않고 보관)

사고(예: is_whitelisted 매칭 오류로 정상 사용자까지 차단) 시 즉시 복구할 수 있는 스크립트를 만들어 둔다.

**Files:**
- Create: `supabase/migrations/20260622090200_rls_whitelist_rollback.sql`

- [ ] **Step 1: 롤백 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260622090200_rls_whitelist_rollback.sql
-- 비상 롤백 전용 — 평상시 적용 금지.
-- _whitelisted 정책을 제거하고 기존 authenticated using(true) 정책으로 되돌린다.
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
```

- [ ] **Step 2: 파일만 커밋(실행하지 않음)**

```bash
git add supabase/migrations/20260622090200_rls_whitelist_rollback.sql
git commit -m "chore(rls): add emergency rollback for whitelist policies"
```

---

## Task 5 (선택): 관리자 전용 테이블 쓰기 제한

방향 A의 핵심(화이트리스트)은 Task 1~4로 끝난다. 더 엄격히 가고 싶을 때만 진행. `거래처`(clients)·`공사단가`(rates)는 admin만 쓰도록 좁힌다. 읽기는 전 화이트리스트 사용자 허용 유지.

**Files:**
- Create: `supabase/migrations/20260622090300_rls_admin_writes.sql`

- [ ] **Step 1: is_admin() 헬퍼 + admin 쓰기 정책 작성**

```sql
-- supabase/migrations/20260622090300_rls_admin_writes.sql
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
      on w.kakao_id = coalesce(i.provider_id, i.identity_data->>'provider_id', i.identity_data->>'sub')
    where i.user_id = auth.uid()
      and i.provider = 'kakao'
      and w.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

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
```

- [ ] **Step 2: 실행 및 검증**

SQL Editor에서 실행 후, admin 계정으로 `/admin/rates` 수정 성공 / 비-admin 화이트리스트 계정으로는 단가 insert가 `row-level security` 위반인지 확인(Task 3 Step 1~2 방식으로 `w.role`이 다른 uid 사용).

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260622090300_rls_admin_writes.sql
git commit -m "feat(rls): restrict clients/rates writes to admins"
```

---

## Self-Review 결과

- **스펙 커버리지:** 구멍의 핵심(anon key 직접 우회)은 Task 2가 14개 테이블 전체에 is_whitelisted 게이트를 걸어 닫는다. kakao_id 매핑 신뢰성은 Task 1(auth.identities 사용)로 해결. 검증은 Task 3, 복구는 Task 4. 역할 세분화는 Task 5(선택).
- **플레이스홀더:** `<WHITELISTED_UID>` 등은 환경 의존 값이라 의도적으로 치환 지시와 함께 남김(실제 SQL/명령은 모두 완성형).
- **타입/이름 일관성:** 정책 이름 규칙 `<table>_<op>_whitelisted`, 함수명 `is_whitelisted`/`is_admin`을 전 태스크에서 동일하게 사용. 롤백은 원래 이름 `<table>_<op>_authenticated`로 복원.

## 주의/리스크

- **앱 코드 변경 없음.** 화이트리스트 사용자에겐 무영향이어야 한다. 만약 Task 3 스모크에서 정상 사용자가 막히면 원인은 거의 항상 Task 1의 kakao_id 매칭 — `auth.identities`의 `provider_id` 컬럼 유무/값을 먼저 확인.
- **service role 경로(admin.ts, dashboard-sync, 스크립트)는 RLS를 우회**하므로 영향 없음. 다만 그만큼 그 경로의 인증(API 키)은 계속 중요.
- **마이그레이션 적용 순서:** Task 1 → 2 → (검증) → 4 파일 보관 → (선택)5. Task 1 검증 통과 전에는 Task 2를 적용하지 말 것.
