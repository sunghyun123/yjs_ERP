// 서버 측 에러 추적 (Next.js 16 onRequestError 훅).
// 서버 컴포넌트 렌더 / 라우트 핸들러 / 서버 액션에서 던져진 에러를 PostHog로 보낸다.
// 클라이언트 에러는 instrumentation-client.ts(capture_exceptions)·global-error.tsx가 담당.
import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // 분석 비활성(개발/토큰 없음) 환경에선 조용히 무시 — 기존 분석 모듈과 동일한 게이트.
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (process.env.NODE_ENV !== 'production' || !token || !host) return

  // posthog-node는 Node 런타임 전용. Edge 런타임에선 import 자체가 실패하므로 건너뛴다.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    // 동적 import: 에러 발생 시에만 로드해 정상 경로의 콜드스타트 비용을 피한다.
    const { PostHog } = await import('posthog-node')
    // server.ts와 동일 설정: 즉시 1건 flush 후 종료 (서버리스/요청 단위 수명 대응).
    const client = new PostHog(token, { host, flushAt: 1, flushInterval: 0 })

    // distinctId는 'server' 고정. 에러는 예외 지문으로 묶이므로 사용자 식별이 불필요하고,
    // onRequestError 컨텍스트에서 cookies() 접근은 불안정해 사용자 해시 조회를 시도하지 않는다.
    client.captureException(err, 'server', {
      path: request.path,
      method: request.method,
      router_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
    })
    await client.shutdown()
  } catch {
    // 에러 핸들러가 절대 에러를 던지면 안 된다 — 원본 에러 처리를 방해하지 않는다.
  }
}
