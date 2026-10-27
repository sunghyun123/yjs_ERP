// 사장님 PC의 Claude Desktop ↔ ERP 서버 사이 중계.
// 계산하지 않는다. 손익 공식은 ERP 서버(_lib/공사별손익) 한 곳에만 있고, 여기선 JSON을 받아 넘긴다.

export const REQUEST_TIMEOUT_MS = 30_000;
// 넘치면 Claude 쪽에서 응답 뒷부분이 조용히 잘릴 수 있다 → 자르지 않고 에러로 알린다
export const MAX_RESPONSE_CHARS = 150_000;

export class RelayError extends Error {}

export function parseServerUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? "").trim());
  } catch {
    throw new RelayError("ERP 서버 주소 형식이 올바르지 않습니다. 확장 설정에서 주소를 확인해 주세요.");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  // 키와 회사 금액이 오가는 통로라 https만 허용한다. 개발 PC의 로컬 서버 시험만 예외.
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new RelayError("ERP 서버 주소는 https:// 로 시작해야 합니다.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url;
}

export function parseApiKey(raw) {
  const key = String(raw ?? "").trim();
  if (!key) {
    throw new RelayError("ERP 키가 설정되지 않았습니다. 확장 설정에서 키를 넣어 주세요.");
  }
  return key;
}

export function buildUrl(base, path, params = {}) {
  // 끝 슬래시를 떼고 붙인다. "//api/..."가 되면 URL이 'api'를 호스트 이름으로 읽는다.
  const prefix = base.pathname.replace(/\/+$/, "");
  const url = new URL(`${prefix}${path}`, base.origin);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }
  return url;
}

// 상태코드로 '누구 쪽 문제인지'를 갈라 사용자가 할 수 있는 조치를 알려준다.
export function describeHttpFailure(status, serverMessage) {
  const detail = serverMessage ? ` — ${serverMessage}` : "";
  if (status === 400) return `요청 값이 잘못되었습니다(400)${detail}`;
  if (status === 401) {
    return "ERP가 키를 거절했습니다(401). 확장 설정의 키가 서버의 ERP_MCP_API_KEY와 같은지 확인해 주세요.";
  }
  if (status === 404) return "ERP에 조회 기능이 아직 배포되지 않았습니다(404). 관리자에게 알려 주세요.";
  if (status >= 500) return `ERP 서버에서 오류가 났습니다(${status})${detail}. 잠시 후 다시 시도해 주세요.`;
  return `요청이 거절되었습니다(${status})${detail}`;
}

export async function fetchJson(
  base,
  path,
  params,
  apiKey,
  { fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {},
) {
  const url = buildUrl(base, path, params);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
      // 리다이렉트를 따라가면 Authorization 헤더(키)가 다른 서버로 실려 갈 수 있다
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new RelayError("ERP 조회가 시간 안에 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }
    throw new RelayError("ERP 서버에 연결하지 못했습니다. 이 PC의 인터넷 연결을 확인해 주세요.");
  }
  if (!response.ok) {
    let message = "";
    try {
      message = (await response.json())?.error ?? "";
    } catch {
      // 본문이 JSON이 아니면 상태코드만으로 설명한다
    }
    throw new RelayError(describeHttpFailure(response.status, message));
  }
  return response.json();
}

export function toText(result, { maxChars = MAX_RESPONSE_CHARS } = {}) {
  const text = JSON.stringify(result, null, 1);
  if (text.length > maxChars) {
    throw new RelayError(
      `응답이 너무 큽니다(${text.length}자, 한도 ${maxChars}자). 월을 지정하거나 조건을 좁혀 다시 조회해 주세요.`,
    );
  }
  return text;
}

export const CONSTRUCTIONS_DESCRIPTION = [
  "ERP 수주(공사) 목록을 읽기 전용으로 가져온다. 각 공사의 지중no·공사명·준공여부·준공일.",
  "completed_year: 'current'(올해) 또는 연도 숫자. 주면 그 해에 준공된 공사만(준공여부=true이고 준공일이 그 해). '완결된 공사'는 준공된 공사를 뜻한다. 안 주면 전체.",
  "'올해'는 연도를 계산해 넘기지 말고 'current'로 넘긴다(서버가 한국 시간으로 정한다).",
  "답할 때: 1) 건수는 응답의 '건수'를 그대로 쓰고 행을 직접 세지 않는다 2) 응답 '기준'의 연도를 밝힌다 3) '제외'에 '준공됐지만 준공일 없음' 건수가 있으면, 준공일이 비어 어느 해로도 셀 수 없는 준공 공사가 그만큼 더 있다고 알린다.",
].join("\n");

export const PROFIT_DESCRIPTION = [
  "ERP 매출손익 화면과 같은 공식으로 계산한 공사별 성과·투입·손익(원 단위)을 읽기 전용으로 가져온다.",
  "year: 'current' 또는 연도 숫자(기본 올해). month: 'current'(이번 달) 또는 1~12. month를 안 주면 연간.",
  "'이번 달'·'올해'는 날짜를 계산해 넘기지 말고 'current'로 넘긴다(서버가 한국 시간으로 정한다).",
  "행은 손익 큰 순(플러스가 위, 마이너스가 아래). 준공반영액은 그 기간 성과 중 준공 처리로 얹힌 금액이며 성과에 이미 포함돼 있다.",
  "답할 때: 1) 응답 '기준'의 연도·월을 밝힌다 2) 전체 합계는 '합계'를 그대로 쓰고 행을 더해 새로 계산하지 않는다 3) '제외'에 건수가 있으면 그 기간 성과·투입이 모두 0이라 목록에서 뺀 공사가 그만큼 있다고 알린다 4) 금액은 억·만 원 단위로 읽기 쉽게 바꿔 말한다.",
].join("\n");
