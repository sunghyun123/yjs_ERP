'use client'

export function captureClientException(error: unknown) {
  if (process.env.NODE_ENV !== 'production') return

  const normalized =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'Error', message: String(error) }

  void fetch('/api/analytics/client-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(normalized),
    keepalive: true,
  })
    .catch(() => {
      // Analytics must never trigger another unhandled error.
    })
}
