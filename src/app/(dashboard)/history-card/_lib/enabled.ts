// 이력 카드 생성 기능 스위치 (2026-11-26 비활성화).
// 사장님이 제미나이 Gem(공사이력카드 자동 생성)을 쓰기로 해서 ERP판은 꺼 둔다.
// false면 메뉴에서 빠지고, 페이지는 404, API는 OpenAI를 부르기 전에 410으로 끝난다.
// 되살리려면 true + Sidebar/MobileTabBar 메뉴 항목 복구. 레포 정리 때 이 폴더째 삭제 예정.
export const HISTORY_CARD_ENABLED = false
