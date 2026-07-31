import { captureClientException } from './src/lib/analytics/client-exception'

if (process.env.NODE_ENV === 'production') {
  window.addEventListener('error', (event) => {
    captureClientException(event.error ?? event.message)
  })
  window.addEventListener('unhandledrejection', (event) => {
    captureClientException(event.reason)
  })
}
