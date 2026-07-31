import { describe, it, expect } from 'vitest'
import { extractKakaoId, extractKakaoIdFromClaims } from './whitelist'
import type { User } from '@supabase/supabase-js'

// 테스트용 최소 User 형태 (필요한 필드만 채운 부분 객체)
const makeUser = (partial: Partial<User>): User => partial as User

describe('extractKakaoId', () => {
  it('카카오 identity의 provider_id에서 kakao_id를 추출한다', () => {
    const user = makeUser({
      identities: [
        // @ts-expect-error 테스트용 부분 객체
        { provider: 'kakao', id: 'abc', identity_data: { provider_id: '4834516923' } },
      ],
    })
    expect(extractKakaoId(user)).toBe('4834516923')
  })

  it('provider_id가 없으면 identity_data.sub를 사용한다', () => {
    const user = makeUser({
      // @ts-expect-error 테스트용 부분 객체
      identities: [{ provider: 'kakao', id: 'abc', identity_data: { sub: '777' } }],
    })
    expect(extractKakaoId(user)).toBe('777')
  })

  it('identity_data가 비면 identity.id로 폴백한다', () => {
    const user = makeUser({
      // @ts-expect-error 테스트용 부분 객체
      identities: [{ provider: 'kakao', id: '555', identity_data: {} }],
    })
    expect(extractKakaoId(user)).toBe('555')
  })

  it('user_metadata.provider_id로도 추출한다(identity 없을 때)', () => {
    const user = makeUser({ user_metadata: { provider_id: '123' } })
    expect(extractKakaoId(user)).toBe('123')
  })

  it('카카오 정보가 전혀 없으면 null을 반환한다', () => {
    expect(extractKakaoId(makeUser({ identities: [], user_metadata: {} }))).toBeNull()
    expect(extractKakaoId(null)).toBeNull()
  })

  it('숫자로 들어와도 문자열로 정규화한다', () => {
    const user = makeUser({
      // @ts-expect-error 테스트용 부분 객체
      identities: [{ provider: 'kakao', identity_data: { provider_id: 4834516923 } }],
    })
    expect(extractKakaoId(user)).toBe('4834516923')
  })
})

describe('extractKakaoIdFromClaims', () => {
  it('검증된 claims의 provider_id를 사용한다', () => {
    expect(
      extractKakaoIdFromClaims({
        user_metadata: { provider_id: '4834516923', sub: 'fallback' },
      }),
    ).toBe('4834516923')
  })

  it('provider_id가 없으면 metadata의 sub로 폴백한다', () => {
    expect(extractKakaoIdFromClaims({ user_metadata: { sub: 777 } })).toBe('777')
  })

  it('카카오 식별 정보가 없으면 null을 반환한다', () => {
    expect(extractKakaoIdFromClaims({ user_metadata: {} })).toBeNull()
    expect(extractKakaoIdFromClaims(null)).toBeNull()
  })
})
