// src/app/(dashboard)/progress/_lib/update-공사이력.ts
/**
 * 공사이력 쓰기의 단일 통로 (이력 수정 시트 · 공무 페이지 미지정 담당 지정)
 *
 * ⚠️ RLS(is_whitelisted)에 막히거나 그 사이 삭제된 행은 에러가 아니라 "0행 수정 = 성공"으로 온다.
 *    .select('id')로 실제로 바뀐 행을 돌려받아 1행이 아니면 실패로 본다 — 안 그러면 화면이
 *    "저장됐습니다"라고 거짓말한다.
 * ⚠️ 바꿀 칸만 보낸다(부분 업데이트). 폼 전체를 덮어쓰지 않는다.
 * 클라이언트는 호출부가 넘긴다 — 테스트에서 가짜를 꽂으려는 것.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type 공사이력Patch = Partial<{
  작업일자: string
  성과금액: number | null
  담당공무_id: number | null
}>

export type 실패사유 = 'error' | 'not-updated'
export type 저장결과 = { ok: true } | { ok: false; reason: 실패사유 }

type 결과 = { data: { id: number }[] | null; error: unknown }

function 판정({ data, error }: 결과, 작업: string, id: number): 저장결과 {
  if (error) {
    // 사용자에겐 "실패"만 보이므로 원인은 콘솔에 남긴다 — 안 남기면 운영에서 왜 실패했는지 알 길이 없다
    console.error(`[공사이력 ${작업} 실패]`, { id, error })
    return { ok: false, reason: 'error' }
  }
  if (!data || data.length !== 1) return { ok: false, reason: 'not-updated' }
  return { ok: true }
}

export async function update공사이력(
  supabase: SupabaseClient<Database>,
  id: number,
  patch: 공사이력Patch,
): Promise<저장결과> {
  // 보낼 칸이 없으면 PostgREST가 0행을 돌려줘 "권한 없음"으로 오진된다 — 바꿀 게 없으니 성공으로 본다
  if (Object.values(patch).every((v) => v === undefined)) return { ok: true }
  const res = await supabase.from('공사이력').update(patch).eq('id', id).select('id')
  return 판정(res, '수정', id)
}

export async function delete공사이력(supabase: SupabaseClient<Database>, id: number): Promise<저장결과> {
  const res = await supabase.from('공사이력').delete().eq('id', id).select('id')
  return 판정(res, '삭제', id)
}

export function 저장실패메시지(reason: 실패사유): string {
  return reason === 'not-updated'
    ? '저장되지 않았습니다 (권한이 없거나 이미 삭제된 이력).'
    : '저장에 실패했습니다.'
}
