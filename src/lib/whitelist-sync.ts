export interface WhitelistUser {
  kakao_id: string
  user_name: string
  role: string
}

export interface ReconcilePlan {
  /** JSON에 있는 사용자 전체 (upsert 시 정보 변경도 반영됨) */
  toUpsert: WhitelistUser[]
  /** DB에는 있으나 JSON에 없는 kakao_id (퇴사자 등) */
  toDelete: string[]
}

/**
 * JSON 명단을 기준으로 DB 상태를 맞추기 위한 계획을 계산한다.
 * @param jsonUsers kakao_whitelist.json에서 파싱한 사용자 목록
 * @param dbKakaoIds 현재 whitelist 테이블에 존재하는 kakao_id 목록
 */
export function reconcileWhitelist(
  jsonUsers: WhitelistUser[],
  dbKakaoIds: string[]
): ReconcilePlan {
  const jsonIds = new Set(jsonUsers.map((u) => u.kakao_id))
  const toDelete = dbKakaoIds.filter((id) => !jsonIds.has(id))
  return { toUpsert: jsonUsers, toDelete }
}
