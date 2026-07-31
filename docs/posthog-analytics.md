# PostHog Analytics

This ERP uses PostHog for production-only product analytics. The goal is to
prove real employee usage without sending private business data.

## Environment

Set these only in production runtime config:

```env
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_USER_HASH_SALT=long_random_server_only_secret
```

Local and development builds do not send events because analytics checks
`NODE_ENV === "production"`.

## Privacy Rules

Never send:
- Customer names
- Project names
- Raw business identifiers
- Personal names
- Phone numbers
- Emails
- Addresses or site names
- Exact financial amounts
- Notes, comments, or free text
- Supabase tokens, service-role keys, or env values

Allowed properties are sanitized by allowlist in
`src/lib/analytics/safe-properties.ts`.

## Event Flow

- The browser does not load `posthog-js`; client events are batched to the
  server in a microtask and sent by `posthog-node`.
- Autocapture, automatic pageview, pageleave, and session replay are disabled.
- Client exceptions are sent to `/api/analytics/client-error`; the server-side
  PostHog SDK creates the exception event, so the full browser error SDK is not
  part of the client bundle.
- The browser sends only allowlisted properties, so raw URLs and referrers are
  never added to analytics events.
- `PageViewTracker` manually captures `page_viewed` with `route_key`,
  `page_group`, and `filter_count` only.
- The server hashes `Supabase user.id` with `POSTHOG_USER_HASH_SALT`; the hash
  is never returned to the browser during normal analytics flow.
- `/api/analytics/capture` lets client workflows confirm server-side success
  events without exposing private row data.
- `/api/analytics/client-error` accepts bounded error fields and forwards them
  through the server-side PostHog SDK.

## Implemented Events

- `page_viewed`
- `dashboard_viewed`
- `order_list_viewed`
- `construction_status_viewed`
- `work_log_list_viewed`
- `profit_loss_viewed`
- `admin_page_viewed`
- `excel_export_started`
- `excel_exported`
- `excel_export_failed`
- `admin_action_performed`

The event taxonomy also reserves:
- `order_created`
- `order_updated`
- `order_deleted`
- `work_log_created`
- `work_log_updated`

Those should be captured after future CRUD flows are moved from direct client
Supabase calls to server actions or server-backed API routes.

## Portfolio Usage

Useful PostHog screenshots:
- Trends: `page_viewed` by `page_group`
- Trends: `*_viewed` events over 30 days
- Trends: `excel_exported` count
- Active users over time
- Feature usage breakdown by `route_key`

Before publishing screenshots, verify that the PostHog dashboard does not show
personally identifying user properties or raw URLs.
