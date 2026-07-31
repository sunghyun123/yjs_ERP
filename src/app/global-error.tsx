'use client'

// App Router 전역 에러 경계.
// React 렌더 중 발생한 에러는 경계(error boundary)가 가로채 window.onerror로 흘러가지 않는다.
// 따라서 전역 브라우저 리스너로는 누락되고, 여기서 명시적으로 PostHog에 보낸다.
// global-error는 루트 레이아웃을 대체하므로 <html>/<body>를 직접 렌더해야 한다.
import { useEffect } from 'react'
import { captureClientException } from '@/lib/analytics/client-exception'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureClientException(error)
  }, [error])

  return (
    <html lang="ko">
      <body style={{ backgroundColor: '#f1f4fb', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            fontFamily: 'system-ui, sans-serif',
            color: '#1f2937',
            padding: '24px',
          }}
        >
          <h1 style={{ fontSize: '20px', fontWeight: 600 }}>문제가 발생했습니다</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
            오류가 자동으로 보고되었습니다. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: 'white',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
