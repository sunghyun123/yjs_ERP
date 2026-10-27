# yj-erp — ERP 조회 MCP 중계 (Claude Desktop 확장)

사장님 PC의 Claude Desktop에서 "올해 완결된 공사 몇 건?", "이번 달 손익 플러스/마이너스 나눠줘"를 쓰기 위한 중계.

```
Claude Desktop → yj-erp(이 확장) → HTTPS + Bearer → ERP /api/mcp/* → Supabase(service_role)
```

| 도구 | ERP 라우트 | 내용 |
|---|---|---|
| `get_constructions(completed_year?)` | `GET /api/mcp/constructions` | 지중no·공사명·준공여부·준공일. 준공 연도 필터 |
| `get_profit(year?, month?)` | `GET /api/mcp/profit` | 공사별 성과·투입·손익(원). 매출손익 화면과 같은 함수(`src/app/(dashboard)/_lib/공사별손익.ts`) |

- **계산하지 않는다.** 손익 공식은 ERP 서버 한 곳에만 있다. relay는 JSON을 받아 넘긴다.
- **읽기 전용.** GET만 있다.
- **키는 전용.** `ERP_MCP_API_KEY`는 대시보드 키와 다르다. 이 PC에서 새도 열리는 건 `/api/mcp/*` 뿐이다.
- 신원 단위는 사람이 아니라 '키를 가진 프로그램'이다. 이 PC에서 키를 읽을 수 있는 프로그램은 누구든 이 API를 부를 수 있다.
- 도구 결과(공사별 금액)는 Anthropic의 Claude로 전송된다.

## 개발

```powershell
cd mcp
npm install
npm test
```

## 패키징 (`dist/yj-erp.mcpb`, git에 올리지 않음)

```powershell
npm run pack
```

- **코드를 바꾸면 `manifest.json`과 `package.json`의 `version`을 올린 뒤 패키징한다.** 버전이 같으면 설치된 확장이 새것으로 인식되지 않는다.
- `.mcpbignore`의 패턴은 반드시 `/`로 시작(루트 고정)한다. `dist/`처럼 쓰면 `node_modules/**/dist/`까지 빠져 SDK 코드가 없는 패키지가 만들어진다.
- 패키징 후 압축을 풀어 `node server/index.js`가 모듈 에러 없이 뜨는지 확인한다.

## 설치

1. `yj-erp.mcpb`를 더블클릭 → Claude Desktop 설치 화면
2. 서버 주소(기본 `https://erp.yjsboard.com`) 확인, ERP MCP 키 입력
3. 새 대화에서 "올해 완결된 공사 몇 건?"으로 확인. 답에 기준 연도가 나오는지 본다

## 응답에서 볼 것

| 표시 | 뜻 |
|---|---|
| `401` | 확장 설정의 키가 서버 `ERP_MCP_API_KEY`와 다름 |
| `404` | 서버에 MCP 라우트가 아직 배포되지 않음 |
| `500` | ERP 조회 실패. 숫자를 믿지 말 것 |
| `응답이 너무 큽니다` | 15만 자 초과. 월을 지정해 다시 조회 |
| `제외` 건수 | 그 기간 성과·투입이 0이라 목록에서 뺀 공사 수(합계에는 포함) |
