/**
 * 사내 대시보드(yjs_Dashboard) 주소 — ERP → 대시보드 바로가기가 참조하는 단일 지점.
 *
 * 소비자가 사이드바·모바일 탭바 둘이라 주소를 각자 적으면 갈라진다 → 여기 한 곳에 둔다.
 *
 * 기본값을 두는 이유: NEXT_PUBLIC_ 값은 런타임 조회가 아니라 **빌드 때 문자열로 박힌다.**
 * 그래서 서버 .env.production 에 줄을 빠뜨리면(또는 넣고 재빌드를 안 하면) 링크가
 * 에러 없이 조용히 사라진다 — 없어진 걸 알아챌 신호가 화면 어디에도 없다.
 * 주소가 바뀌면 env 로 덮고, 안 덮어도 동작은 유지된다.
 */
export const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://yjsboard.com'
