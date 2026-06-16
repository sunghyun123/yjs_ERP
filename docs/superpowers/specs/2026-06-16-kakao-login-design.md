# 카카오 단일 로그인 + 화이트리스트 설계

- **작성일:** 2026-06-16
- **대상:** YEC ERP 로그인 시스템
- **스택:** Next.js 16, React 19, Supabase Auth (@supabase/ssr), TypeScript, Vitest

## 배경 / 목표

외부에서도 접근 가능한 ERP 웹사이트의 로그인을 설계한다. 핵심 제약:

1. **접근성 최우선** — 직원 다수가 비IT 직군(현장직). 로그인이 조금만 복잡해도 사용 난항. 비밀번호 관리 부담을 없애야 한다.
2. **외부 접근 차단** — 인터넷에 노출되므로, 등록된 직원만 들어와야 한다.

기존에 비밀번호 방식(초기값 `1234`)을 고려했으나, "인터넷 노출 + 예측 가능한 이메일 + 고정 초기 비밀번호"는 사실상 공개 ERP가 되는 심각한 취약점이라 폐기한다. 대신 한국 비IT 직군에게 가장 친숙하고 비밀번호가 아예 없는 **카카오 로그인**으로 통일한다. 접근 권한은 다른 사내 프로그램에서 가져온 **카카오 화이트리스트**로 통제한다.

## 결정 사항 요약

| 항목 | 결정 |
|---|---|
| 인증 수단 | **카카오 OAuth 단일** (이메일/비밀번호 로그인 제거) |
| 외부 차단 | 카카오 로그인 후 **화이트리스트(kakao_id) 대조**, 미등록자 거부 |
| 명단의 주인 | **다른 사내 프로그램**(등록·승인 거기서 처리). ERP는 소비자 |
| 명단 저장 | Supabase Postgres `whitelist` 테이블. 원본은 `kakao_whitelist.json` |
| 명단 갱신 | 수동 — 갱신된 JSON을 받아 **동기화 스크립트**로 reconcile |
| 권한 구분 | **없음**. 로그인 통과 = 전 화면 접근. `role`은 저장만 (향후 대비) |
| 차단 검사 위치 | 카카오 **콜백 라우트** + 대시보드 레이아웃 매 요청 재확인 |

## 아키텍처

- **인증:** Supabase Auth의 Kakao OAuth 공급자(신규 카카오 앱). 비밀번호 방식 전면 제거.
- **명단:** `whitelist` 테이블. `kakao_whitelist.json`이 원본(source of truth), 동기화 스크립트로 DB를 JSON에 맞춤.
- **출입 통제:** 카카오 로그인 직후 콜백 라우트에서 `kakao_id`를 명단과 대조. 기존 `proxy.ts`는 세션 갱신·검사 역할을 유지.

## 데이터 모델 — `whitelist` 테이블

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `kakao_id` | text, PK | 카카오 회원번호. 동의항목에 의존하지 않는 안정적 매칭 키 |
| `user_name` | text | 직원 이름 |
| `role` | text | `admin` / `worker`. 지금은 저장만, 권한 구분에 사용하지 않음 |
| `updated_at` | timestamptz, default now() | 마지막 동기화 시각 |

- 관리자 계정도 별도 취급 없이 이 테이블의 한 행(`role: admin`)으로 존재한다.
- 별도 `profiles` 테이블은 만들지 않는다(역할 구분을 하지 않으므로 YAGNI). 모든 검증은 `kakao_id`로 `whitelist`를 조회한다.
- 비상 출입구: 앱 로그인이 막혀도 명단 관리·동기화는 앱 로그인과 무관하게 Supabase 대시보드 / service-role 키로 가능하다.

### kakao_id 추출

Supabase에서 카카오 OAuth 로그인 후, 카카오 회원번호는 인증 사용자의 Kakao identity에 담긴다(`user.identities`에서 `provider === 'kakao'`인 항목의 provider 사용자 id / `identity_data`). 정확한 필드명은 구현 시 `@supabase/supabase-js` 타입과 실제 응답으로 확정한다.

## 로그인 흐름

```
/login
 └─ [카카오로 로그인]   ← 화면에 이 버튼 하나만

카카오 클릭
 → signInWithOAuth({ provider: 'kakao', options: { redirectTo: '/auth/callback' } })
 → 카카오 동의 화면
 → /auth/callback  (Route Handler)
      ├ exchangeCodeForSession(code)
      ├ getUser() → 카카오 identity에서 kakao_id 추출
      ├ whitelist 에서 kakao_id 조회
      │   ├ 있음 → '/' 로 리다이렉트 (ERP 진입)
      │   └ 없음 → signOut() + '/login?error=not_allowed' 로 리다이렉트
```

- **세션 유지 중인 퇴사자/미등록자 차단:** 대시보드 레이아웃(서버 컴포넌트)에서 매 요청마다 `getUser → kakao_id → whitelist 재확인`. 명단에서 빠졌으면 `signOut` 후 로그인으로. 퇴사자는 명단 동기화 직후부터 차단된다.
- 이미 로그인된 사용자가 `/login` 접근 시 `/`로 보내는 기존 동작 유지.

## 로그인 화면 UI

- 기존 화면 구조(연한 배경 + YEC 로고 + 카드) 재사용.
- 카드 내용은 **"카카오로 로그인" 버튼 하나**로 단순화(카카오 브랜드 색/로고 적용). 기존 이메일·비밀번호 폼과 검증 로직은 제거.
- `?error=not_allowed` 파라미터가 있으면: "등록되지 않은 사용자입니다. 전산담당자에게 문의하세요." 배너 표시.
- `?error=oauth` 등 그 외 실패: "로그인이 취소되었거나 실패했습니다. 다시 시도해 주세요." 배너 표시.

## 화이트리스트 동기화 스크립트

- 파일: `scripts/sync-whitelist.ts`, 실행: `npm run sync:whitelist`
- 동작:
  1. `kakao_whitelist.json` 읽기
  2. `whitelist` 테이블과 비교(reconcile): JSON에 있는 사람은 upsert, JSON에 없는 행(퇴사자)은 삭제
  3. 추가/갱신/삭제 건수 요약 출력
- Supabase **service-role 키** 사용 (기존 `src/lib/supabase/admin.ts` 활용).
- 초기 시드도 이 스크립트가 겸한다.
- 운영: 다른 프로그램에서 명단 최신화 → 갱신된 JSON을 레포에 반영 → `npm run sync:whitelist` 실행(또는 Claude에게 "화이트리스트 최신화" 요청).

## 컴포넌트 경계

| 단위 | 책임 | 의존 |
|---|---|---|
| `app/login/page.tsx` | 로그인 화면 렌더, 에러 배너 | 없음(정적) |
| `app/login/KakaoLoginButton.tsx` (client) | 카카오 OAuth 시작 | supabase client |
| `app/auth/callback/route.ts` | 코드 교환 → kakao_id 추출 → 명단 검증 → 분기 | supabase server, `isWhitelisted` |
| `lib/whitelist.ts` | `isWhitelisted(kakaoId)` 순수/얇은 조회 함수, kakao_id 추출 헬퍼 | supabase server |
| `scripts/sync-whitelist.ts` | JSON ↔ DB reconcile | supabase admin, `reconcileWhitelist` |
| `lib/whitelist-sync.ts` | `reconcileWhitelist(jsonUsers, dbRows)` → {upsert, delete} 순수 계산 | 없음 |
| `app/(dashboard)/layout.tsx` | 매 요청 화이트리스트 재확인 | supabase server, `isWhitelisted` |

## 에러 처리

- **미등록자:** 콜백에서 로그아웃 + `error=not_allowed` 안내.
- **카카오 동의 취소 / OAuth 실패:** 콜백에 code가 없거나 교환 실패 시 `error=oauth` 안내.
- **세션 중 명단 이탈(퇴사자):** 대시보드 레이아웃에서 잡아 로그아웃.

## 테스트 (Vitest)

- `reconcileWhitelist` 순수 함수: JSON과 DB 상태 조합 → 올바른 upsert/delete 목록 산출 (신규/삭제/유지/이름변경 케이스).
- kakao_id 추출 헬퍼: 다양한 Supabase user 형태 입력 → 올바른 kakao_id 또는 null.
- `isWhitelisted`: 조회 클라이언트를 목으로 주입해 있음/없음 → true/false.
- 실제 카카오 OAuth 왕복은 외부 의존이므로 앱 설정 후 수동 확인.

## 외부 설정 (구현과 별개로 사용자가 수행)

1. **카카오 개발자 콘솔:** 앱 생성 → REST API 키 발급 → Redirect URI에 Supabase 콜백 주소 등록.
2. **Supabase 대시보드:** Authentication → Kakao 공급자 활성화 + 키 입력.
3. **DB:** `whitelist` 테이블 생성 (마이그레이션 SQL은 구현 시 제공).
4. 최초 `npm run sync:whitelist` 실행으로 초기 명단 시드.

## 범위 밖 (YAGNI / 향후)

- 역할 기반 접근 제어(`/admin/*` 제한 등) — 지금은 안 함, `role`만 저장.
- ERP 내 사용자 관리 화면 — 명단의 주인은 다른 프로그램이므로 불필요.
- 미등록자 가입 요청/승인 플로우 — 다른 프로그램이 담당.
- 두 프로그램 간 자동 명단 동기화(공유 DB/API) — 입·퇴사가 드물어 수동 동기화로 충분.
