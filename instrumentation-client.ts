import posthog from 'posthog-js'
import { sanitizePostHogEvent } from './src/lib/analytics/safe-properties'

if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
  process.env.NEXT_PUBLIC_POSTHOG_HOST
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    // 미처리 예외·Promise 거부를 자동으로 $exception 이벤트로 캡처.
    // (단, React 렌더 에러는 경계가 삼키므로 global-error.tsx에서 별도 캡처)
    capture_exceptions: true,
    before_send: (event) => sanitizePostHogEvent(event),
  })
}
